const {requestRateLimitLock, updateRateLimitLock, sendRequestAndWaitForResponse} = globalThis.AI || {};

globalThis.AI = globalThis.AI || {};
globalThis.AI.OpenAI = {};
globalThis.AI.Mixtral = {};
globalThis.AI.Grok = {};

const DefaultOpenAIChatModel = AI2Model.openai[0];
const DefaultOpenAIDrawModel = 'dall-e-3';
const DefaultMixtralChatModel = AI2Model.mixtral[0];
const DefaultGrokChatModel = AI2Model.grok[0];

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
	const isO1Preview = model === 'o1-preview' || model === 'o1-mini';
	const request = { method: "POST" };
	const url = "https://api.openai.com/v1/chat/completions";

	var [header, data] = assembleDataPack(model, options, myInfo.apiKey.openai);
	if (isO1Preview) {
		data.max_completion_tokens = data.max_tokens;
		delete data.max_tokens;
	}
	request.headers = header;

	return await sendRequestAndWaitForResponse('OpenAI', model, conversation, url, request, () => {
		data.messages = assembleMessages(conversation, true, !isO1Preview);
		request.body = JSON.stringify(data);
	});
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
	const request = { method: "POST" };
	const url = 'https://api.mistral.ai/v1/chat/completions';

	var [header, data] = assembleDataPack(model, options, myInfo.apiKey.mixtral);
	request.headers = header;

	return await sendRequestAndWaitForResponse('Mixtral', model, conversation, url, request, () => {
		data.messages = assembleMessages(conversation, false);
		request.body = JSON.stringify(data);
	});
};

AI.Grok.list = async () => {
	var request = {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
			"Authorization": 'Bearer ' + myInfo.apiKey.grok
		},
	};
	var url = 'https://api.x.ai/v1/models';

	var response, time = Date.now();
	try {
		response = await waitUntil(fetchWithCheck(url, request));
	}
	catch (err) {
		throw err;
	}
	time = Date.now() - time;
	logger.info('Grok', 'List: ' + (time / 1000) + 's');

	response = await response.json();
	response = response.data || response;
	return response;
};
AI.Grok.chat = async (conversation, model=DefaultGrokChatModel, options={}) => {
	const request = { method: "POST" };
	const url = "https://api.x.ai/v1/chat/completions";

	var [header, data] = assembleDataPack(model, options, myInfo.apiKey.grok);
	request.headers = header;

	return await sendRequestAndWaitForResponse('Grok', model, conversation, url, request, () => {
		data.messages = assembleMessages(conversation, false);
		request.body = JSON.stringify(data);
	});
};
