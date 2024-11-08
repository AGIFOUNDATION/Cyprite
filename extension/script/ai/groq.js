const {sendRequestAndWaitForResponse} = globalThis.AI || {};

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
	const request = { method: "POST" };
	const url = 'https://api.groq.com/openai/v1/chat/completions';
	const apiKey = myInfo.apiKey.groq || '';
	const AI = Model2AI[model];

	request.headers = Object.assign({}, ModelDefaultConfig[AI].header, (ModelDefaultConfig[model] || {}).header || {}, {
		"Authorization": "Bearer " + apiKey
	});

	var payload = Object.assign({}, ModelDefaultConfig[AI].chat, (ModelDefaultConfig[model] || {}).chat || {}, options || {}, payload);
	payload.messages = assemblePayload(model, conversation).messages;
	request.body = JSON.stringify(payload);

	return await sendRequestAndWaitForResponse('Groq', model, conversation, url, request, () => {
		payload.messages = assemblePayload(model, conversation).messages;
		request.body = JSON.stringify(payload);
	});
};