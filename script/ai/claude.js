globalThis.AI = globalThis.AI || {};
globalThis.AI.Claude = {};

const DefaultChatModel = AI2Model.claude[0];

const convertClaudeChinese = content => {
	if (!content) return '';
	content = content.trim();
	if (!content) return '';

	content = content.split(/\r*\n\r*/);
	content = content.map(line => {
		line = line.replace(/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]\s*[\(\)]|[\(\)]\s*[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/gi, (m) => {
			m = m.replace(/\s*([\(\)])\s*/g, (m, o) => {
				if (o === ',') return '，';
				if (o === ':') return '：';
				if (o === ';') return '；';
				if (o === '?') return '？';
				if (o === '!') return '！';
				if (o === '(') return '（';
				if (o === ')') return '）';
				return o;
			});
			return m;
		});
		line = line.replace(/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]\s*[,:;\?\!]/gi, (m) => {
			m = m.replace(/\s*([,:;\?\!\(\)])\s*/g, (m, o) => {
				if (o === ',') return '，';
				if (o === ':') return '：';
				if (o === ';') return '；';
				if (o === '?') return '？';
				if (o === '!') return '！';
				if (o === '(') return '（';
				if (o === ')') return '）';
				return o;
			});
			return m;
		});
		line = line.replace(/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]\s*\.+/gi, (m) => {
			m = m.replace(/\s*(\.+)\s*/g, (m, o) => {
				if (o.length === 1) return '。';
				return "……";
			});
			return m;
		});
		line = line.replace(/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]\s*\-{2,}|\-{2,}\s*[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/gi, (m) => {
			m = m.replace(/\s*(\-{2,})\s*/g, (m, o) => {
				return "——";
			});
			return m;
		});
		line = line.replace(/[\(（]\s*([\w\d_\-\+\*\\\/:;,\.\?\!@%#\^\&\(\)=]+)\s*[\)）]/g, (m, a) => '(' + a + ')');
		return line;
	});
	content = content.join('\n');

	return content;
};
const assembleConversation = conversation => {
	var data = { messages: [] };
	conversation.forEach(item => {
		if (item[0] === 'system') {
			data.system = item[1];
		}
		else if (item[0] === 'human') {
			data.messages.push({
				role: 'user',
				content: item[1]
			});
		}
		else if (item[0] === 'ai') {
			data.messages.push({
				role: "assistant",
				content: item[1]
			});
		}
	});
	if (data.messages[data.messages.length - 1].role !== 'assistant') {
		data.messages.push({
			role: 'assistant',
			content: ''
		});
	}
	return data;
};

AI.Claude.chat = async (conversation, model=DefaultChatModel, options={}) => {
	var header = Object.assign({}, ModelDefaultConfig.Claude.header, (ModelDefaultConfig[model] || {}).header || {});
	header["x-api-key"] = myInfo.apiKey.claude;
	var url = "https://api.anthropic.com/v1/messages";
	var data = Object.assign({}, ModelDefaultConfig.Claude.chat, (ModelDefaultConfig[model] || {}).chat || {}, options);
	data.model = model;
	Object.assign(data, assembleConversation(conversation));
	var request = {
		method: "POST",
		headers: header,
		body: JSON.stringify(data),
	};

	var replies = [], usage = { count: 0, input: 0, output: 0 }, isFirst = true, time = Date.now(), loop = 0;
	while (true) {
		let response;
		try {
			await requestRateLimitLock(model);
			updateRateLimitLock(model, true);
			response = await waitUntil(fetchWithCheck(url, request));
			updateRateLimitLock(model, false);
		}
		catch (err) {
			updateRateLimitLock(model, false);
			throw err;
		}

		response = await response.json();
		logger.info('Claude', response);

		let usg = response.usage;
		usage.count ++;
		if (!!usg) {
			usage.input += usg.input_tokens;
			usage.output += usg.output_tokens;
		}
		let reply = response.content;
		if (!!reply) reply = reply[0];
		if (!reply) {
			reply = "";
			let errMsg = response.error?.message || 'Error Occur!';
			logger.error('Claude', errMsg);
			throw new Error(errMsg);
		}
		else {
			reply = convertClaudeChinese(reply.text);
			replies.push(reply);
		}

		let reason = response.stop_reason || '';
		if (reason.toLowerCase() !== 'max_tokens') {
			break;
		}
		else {
			if (isFirst) {
				conversation.push(['ai', reply]);
				conversation.push(['human', PromptLib.continueOutput]);
				isFirst = false;
			}
			else {
				conversation[conversation.length - 2][1] = replies.join(' ');
			}
		}
		Object.assign(data, assembleConversation(conversation));
		request.body = JSON.stringify(data);
		loop ++;
		if (loop >= ModelContinueRequestLoopLimit) break;
	}
	time = Date.now() - time;
	logger.info('Claude', 'Timespent: ' + (time / 1000) + 's; Input: ' + usage.input + '; Output: ' + usage.output);
	recordAIUsage(model, 'Claude', usage);

	return replies.join(' ');
};