const {sendRequestAndWaitForResponse} = globalThis.AI || {};

globalThis.AI = globalThis.AI || {};
globalThis.AI.Gemini = {};

const DefaultChatModel = AI2Model.gemini[0];
const DefaultSearchModel = "gemini-1.5-flash-002";
const DefaultEmbeddingModel = 'text-embedding-004';

const combineObject = (...objs) => {
	var keys = [];
	objs.forEach(obj => {
		Object.keys(obj).forEach(key => {
			if (!keys.includes(key)) keys.push(key);
		});
	});

	var value = {};
	keys.forEach(key => {
		var list = [];
		var needCombine = false;
		objs.forEach(obj => {
			var v = obj[key];
			if (v !== undefined) {
				list.push(v);
				needCombine = isObject(v);
			}
		});
		if (list.length === 0) return;
		if (list.length === 1) {
			value[key] = list[0];
		}
		else if (needCombine) {
			list = list.filter(v => isObject(v));
			if (list.length === 1) {
				value[key] = list[0];
			}
			else {
				value[key] = combineObject(...list);
			}
		}
		else {
			value[key] = list[list.length - 1];
		}
	});

	return value;
};
const getRequestHeader = (model) => {
	var header = Object.assign(ModelDefaultConfig.Gemini.header, (ModelDefaultConfig[model]|| {}).header || {});
	return header;
};
const getRequestPackage = (model, action) => {
	var request = combineObject(ModelDefaultConfig.Gemini[action], (ModelDefaultConfig[model]|| {})[action] || {});
	return request;
};
const assembleConversation = conversation => {
	var sp = '';
	var prompt = [];
	conversation.forEach(item => {
		if (item[0] === 'system') {
			sp = {
				parts: {
					text: item[1]
				}
			};
		}
		else if (item[0] === 'human') {
			prompt.push({
				role: "user",
				parts: [
					{
						text: item[1]
					}
				]
			});
		}
		else if (item[0] === 'ai') {
			prompt.push({
				role: "model",
				parts: [
					{
						text: item[1]
					}
				]
			});
		}
		else if (item[0] === 'call') {
			prompt.push({
				role: "model",
				parts: [
					{
						functionCall: {
							name: item[1][0].name,
							args: item[1][0].arguments,
						}
					}
				]
			});
		}
		else if (item[0] === 'tool') {
			prompt.push({
				role: "user",
				parts: [
					{
						functionResponse: {
							name: item[1].name,
							response: {
								name: item[1].name,
								content: item[1].content,
							}
						}
					}
				]
			});
		}
	});
	prompt = {
		contents: prompt
	};
	if (!!sp) {
		prompt.system_instruction = sp;
	}
	return prompt;
};
const appendToolsToRequest = (data, tools) => {
	if (!isArray(tools) || tools.length === 0) return;
	data.tools = [{
		function_declarations: []
	}];
	tools.forEach(tool => {
		const fun = {
			name: tool.name,
			description: tool.description,
			parameters: {
				type: tool.parameters.type,
				properties: tool.parameters.properties,
				required: tool.parameters.required,
			},
		};
		data.tools[0].function_declarations.push(fun);
	});
	data.tool_config = {
		function_calling_config: {
			mode: "auto"
		}
	};
};
const scoreContent = content => {
	var score = 0;
	content = content.replace(/[a-zA-Z]+/g, () => {
		score += 2.5;
		return ' ';
	});
	content = content.replace(/[\d\.]+/g, () => {
		score += 1;
		return ' ';
	});
	content = content.replace(/[\u4e00-\u9fa5]/g, () => {
		score += 1;
		return ' ';
	});
	return Math.floor(score);
};

AI.Gemini.list = async () => {
	var url = 'https://generativelanguage.googleapis.com/v1beta/models?key=' + myInfo.apiKey.gemini;

	var header = getRequestHeader();
	var request = {
		method: "GET",
		headers: header,
	};

	var response, time = Date.now();
	try {
		response = await waitUntil(fetchWithCheck(url, request));
	}
	catch (err) {
		throw err;
	}
	time = Date.now() - time;
	logger.info('Gemini', 'List: ' + (time / 1000) + 's');

	response = await response.json();
	return response;
};
AI.Gemini.chat = async (conversation, model=DefaultChatModel, tools = [], tid) => {
	const request = { method: "POST" };
	const url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ':generateContent?key=' + myInfo.apiKey.gemini;

	tools = AI.prepareToolList(tools);
	var originRequest = getRequestPackage(model, 'chat');
	request.header = getRequestHeader(model);
	appendToolsToRequest(originRequest, tools);

	var tag = model.match(/\bpro\b/);
	if (!!tag) tag = 'gemini-1.5-pro';
	else tag = 'gemini-1.5-flash';

	return await sendRequestAndWaitForResponse('Gemini', tag, conversation, url, request, () => {
		Object.assign(originRequest, assembleConversation(conversation));
		request.body = JSON.stringify(originRequest);
	}, tools, tid);
};
AI.Gemini.search = async (topic, model=DefaultSearchModel) => {
	const request = { method: "POST" };
	const url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ':generateContent?key=' + myInfo.apiKey.gemini;

	const locker = 'gemini-1.5-flash', tag = 'gemini-google-search';
	const conversation = [['human', PromptLib.assemble(PromptLib.googleSearch, {topic})]];
	const originRequest = getRequestPackage(model, 'chat');
	request.header = getRequestHeader(model);
	// Call Google Search for Grounding
	originRequest.tools = [{google_search_retrieval: {
		dynamic_retrieval_config: {
			mode: "MODE_DYNAMIC",
			dynamic_threshold: 0, // Always search google
		}
	}}];
	Object.assign(originRequest, assembleConversation(conversation));
	request.body = JSON.stringify(originRequest);

	const usage = { count: 0, input: 0, output: 0 };
	var response, time = Date.now();
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

	// Occasionally, abnormal JSON structures may appear in some LLM's returned data, requiring additional processing.
	try {
		let text = await response.text();
		let inner = text.match(/^\s*b'\{[\w\W]+\}'\s*$/);
		if (!!inner) {
			text = text.replace(/^\s*b'|'\s*$/g, '').replace(/\\n/g, '\n');
		}
		response = JSON.parse(text);
	}
	catch (err) {
		logger.error(tag, err);
		response = {};
	}
	logger.info(tag, response);

	let error = response.error || response.error_msg || response.error?.message;
	if (!!error && !!error.message) throw new Error(error.message);

	let usg = response.usageMetadata;
	usage.count ++;
	if (!!usg) {
		usage.input += usg.prompt_tokens || usg.input_tokens || usg.promptTokenCount || 0;
		usage.output += usg.completion_tokens || usg.output_tokens || usg.candidatesTokenCount || 0;
	}

	response = response.candidates[0] || {};
	response = response.content?.parts || [];
	response = response[0];
	if (!!response) {
		let list = response.text;
		if (!!list) {
			list = list.replace(/^\s*\`+[\w\+\-_\.]*\s*|\s*\`+\s*$/gi, '');
			try {
				list = JSON.parse(list);
				list = list.map(item => {
					var record = {};
					for (let k in item) {
						if (!!k.match(/title/i)) {
							record.title = item[k] || '(Untitled)';
						}
						else if (!!k.match(/url/i) && !k.match(/cover/i)) {
							let url = item[k];
							if (!url.match(/^https?:\/\//i)) url = 'https://' + url;
							record.url = url;
						}
						else if (!!k.match(/summary/i)) {
							if (!!item[k]) record.summary = item[k];
						}
						else if (!!k.match(/cover/i)) {
							if (!!item[k]) record.cover = item[k];
						}
					}
					return record;
				});
			}
			catch {
				list = null;
			}
		}
		else {
			list = null;
		}

		if (!list && !!response.groundingMetadata) {
			list = response.groundingMetadata?.groundingChunks || [];
			list = list.map(item => {
				if (!item.web) return;
				return item.web;
			}).filter(item => !!item);
		}

		if (!list || !list.length) {
			let errMsg = 'Search Failed!';
			logger.error(tag, errMsg);
			throw new Error(errMsg);
		}
		else {
			response = list;
		}
	}
	else {
		let errMsg = 'Search Failed!';
		logger.error(tag, errMsg);
		throw new Error(errMsg);
	}

	time = Date.now() - time;
	logger.info(tag, 'Timespent: ' + (time / 1000) + 's; Input: ' + usage.input + '; Output: ' + usage.output);
	recordAIUsage("gemini-google-search", 'Gemini', usage);

	return {
		reply: response,
		usage,
	};
};
AI.Gemini.embed = async (contents, model=DefaultEmbeddingModel) => {
	var header = getRequestHeader(model);
	model = 'models/' + model;

	var requests = [], weights = [];
	contents.forEach(item => {
		weights.push(scoreContent(item.content));
		requests.push({
			model,
			taskType: "RETRIEVAL_DOCUMENT",
			title: item.title,
			content: {
				parts: [{text: item.content}]
			},
			// outputDimensionality: 16,
		});
	});
	requests = {requests};
	requests = {
		method: "POST",
		headers: header,
		body: JSON.stringify(requests),
	};
	const baseUrl = "https://generativelanguage.googleapis.com/"
	const url = baseUrl + "v1beta/" + model + ':batchEmbedContents?key=' + myInfo.apiKey.gemini;

	var response, time = Date.now();
	try {
		response = await waitUntil(fetchWithCheck(url, requests, baseUrl));
	}
	catch (err) {
		throw err;
	}
	time = Date.now() - time;
	logger.info('Gemini', 'Embed: ' + (time / 1000) + 's');

	response = await response.json();
	if (!response.embeddings?.map) {
		logger.error('Gemini', "Abnormal Response:", response);
		return null;
	}
	response = response.embeddings.map((embed, i) => {
		return {
			weight: weights[i],
			vector: embed.values
		};
	});
	return response;
};