globalThis.AI = globalThis.AI || {};
globalThis.AI.Groq = {};

const DefaultGroqChatModel = AI2Model.groq[0];

const assemblePayload = (model, conversation) => {
	var payload = {
		model,
		messages: [],
	};

	conversation.forEach(item => {
		var role, content = item[1];
		if (item[0] === 'system') role = 'system';
		else if (item[0] === 'human') role = 'user';
		else if (item[0] === 'ai') role = 'assistant';
		payload.messages.push({ role, content });
	});
	return payload;
};

AI.Groq.chat = async (conversation, model, options={}) => {
	const apiKey = myInfo.apiKey.groq || '';
	const AI = Model2AI[model];

	// Assemble Conversation
	var url = 'https://api.groq.com/openai/v1/chat/completions';
	var header = Object.assign({}, ModelDefaultConfig[AI].header, (ModelDefaultConfig[model] || {}).header || {}, {
		"Authorization": "Bearer " + apiKey
	});
	var payload = assemblePayload(model, conversation);
	payload = Object.assign({}, ModelDefaultConfig[AI].chat, (ModelDefaultConfig[model] || {}).chat || {}, options || {}, payload);
	var request = {
		method: "POST",
		headers: header,
		body: JSON.stringify(payload)
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
		logger.info('Groq', response);

		let error = response.error?.message;
		if (!!error) throw new Error(error);

		let usg = response.usage, reply = ((response.choices || [])[0] || {}).message?.content, reason = ((response.choices || [])[0] || {}).finish_reason;
		usage.count ++;
		if (!!usg) {
			usage.input += usg.prompt_tokens;
			usage.output += usg.completion_tokens
		}
		if (!reply) {
			reply = "";
			let errMsg = 'Error Occur!';
			logger.error('Groq', errMsg);
			throw new Error(errMsg);
		}
		else {
			reply = reply.trim();
			replies.push(reply);
		}

		if (reason !== 'length') {
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
			payload.messages = assemblePayload(model, conversation).messages;
			request.body = JSON.stringify(payload);
		}

		loop ++;
		if (loop >= ModelContinueRequestLoopLimit) break;
	}
	time = Date.now() - time;
	logger.info('Groq', 'Timespent: ' + (time / 1000) + 's; Input: ' + usage.input + '; Output: ' + usage.output);
	recordAIUsage(model, 'Groq', usage);

	return replies.join(' ');
};