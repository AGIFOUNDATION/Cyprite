const ModelRequestHistory = {};
const ModelRequestPending = {};

const getRateLimitHistory = (model) => {
	var list = ModelRequestHistory[model];
	if (!list) {
		list = {
			start: [],
			finish: [],
		};
		ModelRequestHistory[model] = list;
	}
	return list;
};
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

globalThis.AI = globalThis.AI || {};
globalThis.AI.requestRateLimitLock = (model) => new Promise(async res => {
	var aiName = Model2AI[model] || '';
	var rpm = (ModelRateLimit[model] || {}).rpm || (ModelRateLimit[aiName] || {}).rpm || 0;
	if (rpm <= 0) return res();

	var time = Date.now();
	var rateLimiter = getRateLimitHistory(model);
	var delayS = 0, delayF = 0;
	rateLimiter.start = rateLimiter.start.filter(t => time - t <= OneMinute);
	if (rateLimiter.start.length >= rpm) delayS = OneMinute - time + rateLimiter.start[0];
	rateLimiter.finish = rateLimiter.finish.filter(t => time - t <= OneMinute);
	if (rateLimiter.finish.length >= rpm) delayF = OneMinute - time + rateLimiter.finish[0];

	var delay = Math.max(delayS, delayF);
	logger.strong('RPM', 'RPM ' + model + ' : ' + rpm + ' (' + rateLimiter.start.length + ', ' + rateLimiter.finish.length + ') ' + delay);
	var pending = ModelRequestPending[model];
	if (!pending) {
		pending = [];
		ModelRequestPending[model] = pending;
	}
	pending.push(res);
	if (delay === 0) {
		res = pending[0];
		pending.shift();
		if (!!res) res();
		return;
	}

	logger.strong('RPM', 'RPM Waiting: ' + model);
	while (delay > 0) {
		if (delay > 5000) {
			delay -= 5000;
			await wait(5000);
		}
		else {
			await wait(delay);
			delay = 0;
		}
	}
	await AI.requestRateLimitLock(model);
	logger.strong('RPM', 'RPM Continue: ' + model);
	res = pending[0];
	pending.shift();
	if (!!res) res();
});
globalThis.AI.updateRateLimitLock = (model, isStart, input, output) => {
	var time = Date.now();

	var rateLimiter = getRateLimitHistory(model);
	if (isStart) {
		rateLimiter.start.unshift(time);
	}
	else {
		rateLimiter.finish.unshift(time);
	}
	rateLimiter.start = rateLimiter.start.filter(t => time - t <= OneMinute);
	rateLimiter.finish = rateLimiter.finish.filter(t => time - t <= OneMinute);
};
globalThis.AI.prepareToolList = tools => {
	if (!isArray(tools)) return [];
	tools = tools.map(tool => {
		if (isString(tool)) {
			if (!globalThis.UtilityLib) return;
			return UtilityLib[tool];
		}
		else {
			return tool;
		}
	}).filter(tool => !!tool);
	return tools;
};
globalThis.AI.sendRequestAndWaitForResponse = async (tag, locker, conversation, url, request, assembleConversation, tools, tid) => {
	assembleConversation();

	const toolMap = {};
	if (isArray(tools)) {
		tools.forEach(tool => toolMap[tool.name] = tool);
	}

	var replies = [], usage = { count: 0, input: 0, output: 0 }, isFirst = true, time = Date.now(), loop = 0, toolRecord = [];
	while (true) {
		let response;
		logger.log('sendRequest', tag, [...conversation]);
		try {
			await AI.requestRateLimitLock(locker);
			AI.updateRateLimitLock(locker, true);
			response = await waitUntil(fetchWithCheck(url, request));
			AI.updateRateLimitLock(locker, false);
		}
		catch (err) {
			AI.updateRateLimitLock(locker, false);
			throw err;
		}

		let text = await response.text();
		// Occasionally, abnormal JSON structures may appear in some LLM's returned data, requiring additional processing.
		try {
			let inner = text.match(/^\s*b'\{[\w\W]+\}'\s*$/);
			if (!!inner) {
				text = text.replace(/^\s*b'|'\s*$/g, '').replace(/\\n/g, '\n');
			}
			response = JSON.parse(text);
		}
		catch (err) {
			logger.error(tag, err);
			console.log('Original Response:', text);
			response = {};
		}
		logger.info(tag, response);

		let error = response.error || response.error_msg || response.error?.message;
		if (!!error && !!error.message) throw new Error(error.message);

		let usg = response.usage || response.usageMetadata;
		usage.count ++;
		if (!!usg) {
			usage.input += usg.prompt_tokens || usg.input_tokens || usg.promptTokenCount || 0;
			usage.output += usg.completion_tokens || usg.output_tokens || usg.candidatesTokenCount || 0;
		}

		let reply, stopReason = 'normal', toolList = [];
		// GPT-like
		if (!!response.choices) {
			reply = response.choices;
			if (!!reply) reply = reply[0];

			let reason = (reply.finish_reason || '').toLowerCase(), isToolCall = false;
			if (reason === 'length') {
				stopReason = 'maxToken';
			}
			else if (reason === 'tool_calls') {
				isToolCall = true;
				stopReason = 'toolcall';
			}

			if (isToolCall) {
				(reply.message?.tool_calls || []).forEach(entry => {
					const ent = {
						id: entry.id,
						name: entry.function.name,
						arguments: JSON.parse(entry.function.arguments),
					};
					toolList.push(ent);
				});
			}
			else {
				if (!!reply) reply = reply.message?.content;

				if (!reply) {
					reply = "";
					let errMsg = response.error?.message || 'Error Occur!';
					logger.error(tag, errMsg);
					throw new Error(errMsg);
				}
				else {
					reply = reply.trim();
					replies.push(reply);
				}
			}
		}
		// Claude-like
		else if (!!response.content) {
			reply = [];
			let textList = [];
			response.content.forEach(item => {
				if (item.type === 'text') {
					if (stopReason !== 'normal') return;

					item = convertClaudeChinese(item.text);
					textList.push(item);
					reply.push({
						type: 'text',
						text: item
					});

					let reason = (reply.stop_reason || '').toLowerCase();
					if (reason === 'max_tokens') {
						stopReason = 'maxToken';
					}
				}
				else if (item.type === 'tool_use') {
					if (stopReason === 'maxToken') return;
					stopReason = 'toolcall';

					reply.splice(0);
					textList.splice(0);
					toolList.splice(0);

					// Use one tool in one turn
					toolList.push({
						id: item.id,
						name: item.name,
						arguments: item.input
					});
				}
			});

			if (!textList.length && !toolList.length) {
				reply = "";
				let errMsg = response.error?.message || 'Error Occur!';
				logger.error(tag, errMsg);
				throw new Error(errMsg);
			}
			if (textList.length > 0) {
				replies.push(textList.join('\n\n'));
			}
		}
		// Gemini-like
		else if (!!response.candidates) {
			let candidate = response.candidates;
			if (!!candidate) candidate = candidate[0];
			if (!candidate) {
				let errMsg = response.error?.message || 'Error Occur!';
				logger.error(tag, errMsg);
				throw new Error(errMsg);
			}
			else {
				let list = candidate.content?.parts || [];
				let textList = [];
				list.forEach(item => {
					if (!!item.functionCall) {
						stopReason = 'toolcall';

						textList.splice(0);
						toolList.splice(0);
						toolList.push({
							id: newID(),
							name: item.functionCall.name,
							arguments: item.functionCall.args,
						});
					}
					else if (stopReason === 'normal') {
						item = item.text || "";
						item = item.trim();
						textList.push(item);
					}
				});

				if (stopReason !== 'toolcall') {
					if (textList.length > 0) {
						replies.push(textList.join('\n\n'));
					}
					else {
						reply = "";
						let errMsg = response.error?.message || 'Error Occur!';
						logger.error(tag, errMsg);
						throw new Error(errMsg);
					}
				}
			}

			if (stopReason === 'normal') {
				let reason = (candidate.finishReason || "").toLowerCase();
				if (reason === 'max_tokens') {
					stopReason = 'maxToken';
				}
			}
		}
		else if (!!response.result) {
			reply = response.result;
			if (!!response.is_truncated) stopReason = 'maxToken';
			if (!reply) {
				reply = "";
				let errMsg = 'Error Occur!';
				logger.error(tag, errMsg);
				throw new Error(errMsg);
			}
			else {
				reply = reply.trim();
				replies.push(reply);
			}
		}

		if (stopReason === 'maxToken') {
			if (isFirst) {
				conversation.push(['ai', reply]);
				conversation.push(['human', PromptLib.continueOutput]);
				isFirst = false;
			}
			else {
				conversation[conversation.length - 2][1] = replies.join(' ');
			}
			assembleConversation();
		}
		else if (stopReason === 'toolcall') {
			let replies = [], requests = [];
			for (let quest of toolList) {
				let fid = quest.id;
				let params = quest.arguments;
				let fun = toolMap[quest.name];
				if (!fun) continue;
				try {
					let response = await fun.call(params, locker, tid, fid);
					if (!!response) {
						updateUsage(usage, response.usage);
						response = response.reply || response.result;
						replies.push({
							id: fid,
							name: quest.name,
							content: response
						});
					}
				}
				catch (err) {
					logger.error('AICallFunction[' + quest.name + ']', err);
					continue;
				}
				requests.push(quest);
			}
			if (replies.length > 0) {
				conversation.push(['call', requests]);
				toolRecord.push(['call', requests]);
				replies.forEach(reply => {
					conversation.push(['tool', reply]);
					toolRecord.push(['tool', reply]);
				});
				assembleConversation();
			}
		}
		else {
			break;
		}

		loop ++;
		if (loop >= ModelContinueRequestLoopLimit) break;
	}
	time = Date.now() - time;
	logger.info(tag, 'Timespent: ' + (time / 1000) + 's; Input: ' + usage.input + '; Output: ' + usage.output);

	return {
		reply: replies.join(' '),
		usage,
		toolUsage: toolRecord
	};
};