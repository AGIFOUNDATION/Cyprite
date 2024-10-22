globalThis.AI = globalThis.AI || {};
globalThis.AI.Gemini = {};

const DefaultChatModel = AI2Model.gemini[0];
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
const getRequestPackage = (model, action, options) => {
	var request = combineObject(ModelDefaultConfig.Gemini[action], (ModelDefaultConfig[model]|| {})[action] || {}, options || {});
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
	});
	prompt = {
		contents: prompt
	};
	if (!!sp) {
		prompt.system_instruction = sp;
	}
	return prompt;
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
AI.Gemini.chat = async (conversation, model=DefaultChatModel, options={}) => {
	var request = getRequestPackage(model, 'chat', options);
	Object.assign(request, assembleConversation(conversation));

	var header = getRequestHeader(model);
	const baseUrl = "https://generativelanguage.googleapis.com/"
	const url = baseUrl + "v1beta/models/" + model + ':generateContent?key=' + myInfo.apiKey.gemini;
	var originRequest = request;
	request = {
		method: "POST",
		headers: header,
		body: JSON.stringify(originRequest),
	};

	var replies = [], usage = { count: 0, input: 0, output: 0 }, isFirst = true, time = Date.now(), loop = 0;
	while (true) {
		let response;
		try {
			await requestRateLimitLock(model);
			updateRateLimitLock(model, true);
			response = await waitUntil(fetchWithCheck(url, request, baseUrl));
			updateRateLimitLock(model, false);
		}
		catch (err) {
			updateRateLimitLock(model, false);
			throw err;
		}
		response = await response.json();
		logger.info('Gemini', response);

		let usg = response.usageMetadata;
		usage.count ++;
		if (!!usg) {
			usage.input += usg.promptTokenCount;
			usage.output += usg.candidatesTokenCount;
		}

		let candidate = response.candidates, reason = '', reply = '';
		if (!!candidate) candidate = candidate[0];
		if (!candidate) {
			let errMsg = response.error?.message || 'Error Occur!';
			logger.error('Gemini', errMsg);
			throw new Error(errMsg);
		}
		else {
			reply = candidate.content?.parts;
			reason = candidate.finishReason || "";
			if (!!reply) reply = reply[0];
			if (!reply) {
				reply = "";
				let errMsg = response.error?.message || 'Error Occur!';
				logger.error('Gemini', errMsg);
				throw new Error(errMsg);
			}
			else {
				reply = reply.text || "";
				reply = reply.trim();
			}
		}
		replies.push(reply);
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
			originRequest.contents = assembleConversation(conversation).contents;
			request = {
				method: "POST",
				headers: header,
				body: JSON.stringify(originRequest),
			};
		}

		loop ++;
		if (loop >= ModelContinueRequestLoopLimit) break;
	}
	time = Date.now() - time;
	logger.info('Gemini', 'Timespent: ' + (time / 1000) + 's; Input: ' + usage.input + '; Output: ' + usage.output);

	return {
		reply: replies.join(' '),
		usage,
	};
};
AI.Gemini.embed = async (contents, model=DefaultEmbeddingModel, options={}) => {
	var header = getRequestHeader(model);
	model = 'models/' + model;

	var requests = [], weights = [];
	contents.forEach(item => {
		weights.push(scoreContent(item.content));
		requests.push({
			model,
			taskType: options.taskType || "RETRIEVAL_DOCUMENT",
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