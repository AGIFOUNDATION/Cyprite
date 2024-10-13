globalThis.AI = globalThis.AI || {};
globalThis.AI.OpenAI = {};
globalThis.AI.Mixtral = {};

const DefaultOpenAIChatModel = AI2Model.openai[0];
const DefaultOpenAIDrawModel = 'dall-e-3';
const DefaultMixtralChatModel = AI2Model.mixtral[0];

const assembleMessages = (conversation, full=true, useSP=true) => {
	var messages = [];
	conversation.forEach(item => {
		var role, prompt = item[1], extra = null;
		if (item[0] === 'system') {
			if (useSP) {
				role = 'system';
			}
			else {
				role = 'user';
				prompt = item[1] + '\n\nKeep in mind the above requirements and instructions.';
				extra = {
					role: 'assistant',
					content: full ? [{
						type: 'text',
						text: 'I remembered it.'
					}] : 'I remembered it.'
				};
			}
		}
		else if (item[0] === 'human') role = 'user';
		else if (item[0] === 'ai') role = 'assistant';
		var content = full ? [{
			type: "text",
			text: prompt
		}] : prompt;
		messages.push({
			role,
			content
		});
		if (extra) {
			messages.push(extra);
		}
	});
	return messages;
};
const assembleDataPack = (model, options, key) => {
	var AI = Model2AI[model];

	var header = Object.assign({}, ModelDefaultConfig[AI].header, (ModelDefaultConfig[model] || {}).header || {});
	var data = Object.assign({}, ModelDefaultConfig[AI].chat, (ModelDefaultConfig[model] || {}).chat || {}, options || {});

	header.Authorization = 'Bearer ' + key;

	data.model = model;

	return [header, data];
};

AI.OpenAI.list = async () => {
	var request = {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
			"Authorization": 'Bearer ' + myInfo.apiKey.openai
		},
	};
	var url = 'https://api.openai.com/v1/models';

	var response, time = Date.now();
	try {
		response = await waitUntil(fetchWithCheck(url, request));
	}
	catch (err) {
		throw err;
	}
	time = Date.now() - time;
	logger.info('OpenAI', 'List: ' + (time / 1000) + 's');

	response = await response.json();
	response = response.data || response;
	return response;
};
AI.OpenAI.chat = async (conversation, model=DefaultOpenAIChatModel, options={}) => {
	var isO1Preview = model === 'o1-preview' || model === 'o1-mini';
	var messages = assembleMessages(conversation, true, !isO1Preview);
	var [header, data] = assembleDataPack(model, options, myInfo.apiKey.openai);
	data.messages = messages;
	if (isO1Preview) {
		data.max_completion_tokens = data.max_tokens;
		delete data.max_tokens;
	}

	var request = {
		method: "POST",
		headers: header,
		body: JSON.stringify(data),
	};
	var url = "https://api.openai.com/v1/chat/completions";

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

		let text = await response.text();
		// Occasionally, abnormal JSON structures may appear in OpenAI's returned data, requiring additional processing.
		try {
			let inner = text.match(/^\s*b'\{[\w\W]+\}'\s*$/);
			if (!!inner) {
				text = text.replace(/^\s*b'|'\s*$/g, '').replace(/\\n/g, '\n');
			}
			response = JSON.parse(text);
		}
		catch (err) {
			logger.error('OpenAI', err);
			response = {};
		}
		logger.info('OpenAI', response);

		let error = response.error;
		if (!!error && !!error.message) throw new Error(error.message);

		let usg = response.usage, reply = response.choices;
		usage.count ++;
		if (!!usg) {
			usage.input += usg.prompt_tokens;
			usage.output += usg.completion_tokens
		}
		if (!!reply) reply = reply[0];
		let reason = '';
		if (!!reply) {
			reason = reply.finish_reason || '';
			reply = reply.message?.content;
		}
		if (!reply) {
			reply = "";
			let errMsg = response.error?.message || 'Error Occur!';
			logger.error('OpenAI', errMsg);
			throw new Error(errMsg);
		}
		else {
			reply = reply.trim();
			replies.push(reply);
		}

		if (reason.toLowerCase() !== 'length') {
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
			messages = assembleMessages(conversation, true, !isO1Preview);
			data.messages = messages;
			request.body = JSON.stringify(data);
		}

		loop ++;
		if (loop >= ModelContinueRequestLoopLimit) break;
	}
	time = Date.now() - time;
	logger.info('OpenAI', 'Timespent: ' + (time / 1000) + 's; Input: ' + usage.input + '; Output: ' + usage.output);
	recordAIUsage(model, 'OpenAI', usage);

	return replies.join(' ');
};
AI.OpenAI.draw = async (prompt, model=DefaultOpenAIDrawModel, options={}) => {
	var data = {
		model,
		prompt,
		n: options.n || 1,
		quality: options.quality || 'standard', // standard or hd
		size: options.size || "1024x1024",
		style: options.style || 'vivid', // vivid or natural
	};
	var request = {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Authorization": 'Bearer ' + myInfo.apiKey.openai
		},
		body: JSON.stringify(data),
	};
	var url = "https://api.openai.com/v1/images/generations";

	var response, time = Date.now();
	try {
		response = await waitUntil(fetchWithCheck(url, request));
	}
	catch (err) {
		throw err;
	}
	time = Date.now() - time;
	logger.info('OpenAI', 'Chat: ' + (time / 1000) + 's');

	response = await response.json();
	var json = response;
	var reply = response.data;
	if (!reply) {
		let errMsg = json.error?.message || 'Error Occur!';
		logger.error('OpenAI', errMsg);
		throw new Error(errMsg);
	}
	reply = reply.map(item => item.url);
	return reply;
};

AI.Mixtral.chat = async (conversation, model=DefaultMixtralChatModel, options={}) => {
	var messages = assembleMessages(conversation, false);
	var [header, data] = assembleDataPack(model, options, myInfo.apiKey.mixtral);
	data.messages = messages;

	var request = {
		method: "POST",
		headers: header,
		body: JSON.stringify(data),
	};
	var url = 'https://api.mistral.ai/v1/chat/completions';

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
		logger.info('Mixtral', response);

		let error = response.detail;
		if (!!error && !!error[0] && !!error[0].msg) throw new Error(error[0].msg);

		let usg = response.usage, reply = response.choices;
		usage.count ++;
		if (!!usg) {
			usage.input += usg.prompt_tokens;
			usage.output += usg.completion_tokens;
		}
		if (!!reply) reply = reply[0];
		let reason = '';
		if (!!reply) {
			reply = reply.message?.content;
			reason = reply.finish_reason || '';
		}
		if (!reply) {
			reply = "";
			let errMsg = error || 'Error Occur!';
			logger.error('Mixtral', errMsg);
			throw new Error(errMsg);
		}
		else {
			reply = reply.trim();
			replies.push(reply);
		}

		if (reason.toLowerCase() !== 'length') {
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
			messages = assembleMessages(conversation, false);
			data.messages = messages;
			request.body = JSON.stringify(data);
		}

		loop ++;
		if (loop >= ModelContinueRequestLoopLimit) break;
	}
	time = Date.now() - time;
	logger.info('Mixtral', 'Timespent: ' + (time / 1000) + 's; Input: ' + usage.input + '; Output: ' + usage.output);
	recordAIUsage(model, 'Mixtral', usage);

	return replies.join(' ');
};
