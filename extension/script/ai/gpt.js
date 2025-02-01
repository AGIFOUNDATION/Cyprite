const {requestRateLimitLock, updateRateLimitLock, sendRequestAndWaitForResponse} = globalThis.AI || {};

globalThis.AI = globalThis.AI || {};
globalThis.AI.OpenAI = {};
globalThis.AI.Mixtral = {};
globalThis.AI.Grok = {};

const DefaultOpenAIChatModel = AI2Model.openai[0];
const DefaultOpenAIDrawModel = 'dall-e-3';
const DefaultMixtralChatModel = AI2Model.mixtral[0];
const DefaultGrokChatModel = AI2Model.grok[0];

const assembleMessages = (conversation, model, tools, full=true, useSP=true) => {
	var messages = [];
	conversation.forEach(item => {

		var role, prompt = item[1], extra = null, normalAppend = true;
		var content = full ? [{
			type: "text",
			text: prompt
		}] : prompt;

		if (item[0] === 'system') {
			if (useSP) {
				role = 'system';
			}
			else {
				role = 'user';
				prompt = prompt + '\n\nKeep in mind the above requirements and instructions.';
				extra = {
					role: 'assistant',
					content: full ? [{
						type: 'text',
						text: 'I remembered it.'
					}] : 'I remembered it.'
				};
			}
		}
		else if (item[0] === 'human' || item[0] === 'inner') role = 'user';
		else if (item[0] === 'ai') role = 'assistant';
		else if (item[0] === 'call') {
			if (NoToolModels.includes(model)) return;
			let conv = {
				role: 'assistant',
				content: "",
				tool_calls: [],
			};
			prompt.forEach(quest => {
				let has = tools.some(tool => tool.name === quest.name);
				if (!has) return;
				conv.tool_calls.push({
					id: quest.id,
					type: "function",
					function: {
						name: quest.name,
						arguments: JSON.stringify(quest.arguments),
					}
				});
			});
			if (conv.tool_calls.length === 0) return;
			messages.push(conv);
			normalAppend = false;
		}
		else if (item[0] === 'tool') {
			if (NoToolModels.includes(model)) return;
			let has = tools.some(tool => tool.name === prompt.name);
			if (!has) return;
			let conv = {
				role: 'tool',
				tool_call_id: prompt.id,
				content: prompt.content,
			};
			messages.push(conv);
			normalAppend = false;
		}
		if (normalAppend) {
			messages.push({
				role,
				content
			});
			if (extra) {
				messages.push(extra);
			}
		}
	});
	return messages;
};
const assembleDataPack = (model, key) => {
	var AI = Model2AI[model];

	var header = Object.assign({}, ModelDefaultConfig[AI].header, (ModelDefaultConfig[model] || {}).header || {});
	var data = Object.assign({}, ModelDefaultConfig[AI].chat, (ModelDefaultConfig[model] || {}).chat || {});

	header.Authorization = 'Bearer ' + key;

	data.model = model;

	return [header, data];
};
const appendToolsToRequest = (data, tools, needParallel=false, stringParameter=false) => {
	if (!isArray(tools) || tools.length === 0) return;
	data.tools = tools.map(tool => {
		const fun = {
			type: 'function',
			function: {
				name: tool.name,
				description: tool.description,
				parameters: {
					type: tool.parameters.type,
					properties: tool.parameters.properties,
					required: tool.parameters.required,
				},
			}
		};
		if (stringParameter) {
			fun.function.parameters = JSON.stringify(fun.function.parameters);
		}
		return fun;
	});
	data.tool_choice = 'auto';
	if (needParallel) data.parallel_tool_calls = true;
};
const requestAndWaitForLongQuest = async (tag, url, token, stateInit, stateSuccess, stateFailed, statePath, errorPath, dataPath, duration=5000) => {
	let result;
	if (stateInit === stateFailed) {
		return;
	}
	else {
		let request = {
			method: "GET",
			headers: {
				"Content-Type": "application/json",
				"Authorization": 'Bearer ' + token
			},
		};
		if (stateInit === stateSuccess) {
			let resp = await waitUntil(fetchWithCheck(url, request));
			resp = await resp.json();
			logger.log(tag, 'Response: ', resp);
			let err = readData(resp, errorPath);
			if (!!err) {
				throw (err);
			}
			else {
				result = readData(resp, dataPath);
			}
		}
		else {
			while (true) {
				await wait(duration);
				let resp = await waitUntil(fetchWithCheck(url, request));
				resp = await resp.json();
				logger.log(tag, 'Response: ', resp);
				let err = readData(resp, errorPath);
				if (!!err) {
					throw (err);
				}
				let state = readData(resp, statePath);
				if (state === stateSuccess) {
					result = readData(resp, dataPath);
					break;
				}
				else if (state === stateFailed) {
					result = null;
					break;
				}
			}
		}
	}

	return result
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
AI.OpenAI.chat = async (conversation, model=DefaultOpenAIChatModel, tools=[], tid) => {
	const isO1Preview = model === 'o1-preview' || model === 'o1-mini';
	const request = { method: "POST" };
	const url = "https://api.openai.com/v1/chat/completions";

	if (NoToolModels.includes(model)) tools = [];
	else tools = AI.prepareToolList(tools);
	var [header, data] = assembleDataPack(model, myInfo.apiKey.openai);
	request.headers = header;
	if (!isO1Preview) appendToolsToRequest(data, tools, true);
	// max_tokens is deprecated
	data.max_completion_tokens = data.max_tokens;
	delete data.max_tokens;

	return await sendRequestAndWaitForResponse('OpenAI', model, conversation, url, request, () => {
		data.messages = assembleMessages(conversation, model, tools, true, !isO1Preview);
		request.body = JSON.stringify(data);
	}, tools, tid);
};
AI.OpenAI.draw = async (prompt, options={}, model=DefaultOpenAIDrawModel) => {
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
	logger.info('OpenAI', 'Image: ' + (time / 1000) + 's');

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

AI.Mixtral.chat = async (conversation, model=DefaultMixtralChatModel, tools=[], tid) => {
	const request = { method: "POST" };
	const url = 'https://api.mistral.ai/v1/chat/completions';

	if (NoToolModels.includes(model)) tools = [];
	else tools = AI.prepareToolList(tools);
	var [header, data] = assembleDataPack(model, myInfo.apiKey.mixtral);
	request.headers = header;
	appendToolsToRequest(data, tools);

	return await sendRequestAndWaitForResponse('Mixtral', model, conversation, url, request, () => {
		data.messages = assembleMessages(conversation, model, tools, false);
		request.body = JSON.stringify(data);
	}, tools, tid);
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
AI.Grok.chat = async (conversation, model=DefaultGrokChatModel, tools=[], tid) => {
	const request = { method: "POST" };
	const url = "https://api.x.ai/v1/chat/completions";

	if (NoToolModels.includes(model)) tools = [];
	else tools = AI.prepareToolList(tools);
	var [header, data] = assembleDataPack(model, myInfo.apiKey.grok);
	request.headers = header;
	appendToolsToRequest(data, tools);

	return await sendRequestAndWaitForResponse('Grok', model, conversation, url, request, () => {
		data.messages = assembleMessages(conversation, model, tools, false);
		request.body = JSON.stringify(data);
	}, tools, tid);
};

