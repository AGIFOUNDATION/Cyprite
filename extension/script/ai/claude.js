const {sendRequestAndWaitForResponse} = globalThis.AI || {};

globalThis.AI = globalThis.AI || {};
globalThis.AI.Claude = {};

const DefaultChatModel = AI2Model.claude[0];

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
	const request = { method: "POST" };
	const url = "https://api.anthropic.com/v1/messages";

	request.headers = Object.assign({}, ModelDefaultConfig.Claude.header, (ModelDefaultConfig[model] || {}).header || {});
	request.headers["x-api-key"] = myInfo.apiKey.claude;

	var data = Object.assign({}, ModelDefaultConfig.Claude.chat, (ModelDefaultConfig[model] || {}).chat || {}, options);
	data.model = model;

	return await sendRequestAndWaitForResponse('Claude', model, conversation, url, request, () => {
		Object.assign(data, assembleConversation(conversation));
		request.body = JSON.stringify(data);
	});
};