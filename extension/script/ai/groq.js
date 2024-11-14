const {sendRequestAndWaitForResponse} = globalThis.AI || {};

globalThis.AI = globalThis.AI || {};
globalThis.AI.Groq = {};

const DefaultGroqChatModel = AI2Model.groq[0];

const assemblePayload = (conversation) => {
	var payload = [];

	conversation.forEach(item => {
		var content = item[1];
		if (item[0] === 'system') {
			payload.push({
				role: 'system',
				content
			});
		}
		else if (item[0] === 'human') {
			payload.push({
				role: 'user',
				content
			});
		}
		else if (item[0] === 'ai') {
			payload.push({
				role: 'assistant',
				content
			});
		}
		else if (item[0] === 'call') {
			payload.push({
				role: 'assistant',
				tool_calls: item[1],
			});
		}
		else if (item[0] === 'tool') {
			payload.push({
				role: 'tool',
				tool_call_id: item[1].id,
				name: item[1].name,
				content: item[1].content,
			});
		}
	});
	return payload;
};
const appendToolsToRequest = (data, tools) => {
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
		return fun;
	});
	data.tool_choice = 'auto';
};

AI.Groq.chat = async (conversation, model, tools=[], tid) => {
	const request = { method: "POST" };
	const url = 'https://api.groq.com/openai/v1/chat/completions';
	const apiKey = myInfo.apiKey.groq || '';
	const AI = Model2AI[model];

	tools = AI.prepareToolList(tools);
	request.headers = Object.assign({}, ModelDefaultConfig[AI].header, (ModelDefaultConfig[model] || {}).header || {}, {
		"Authorization": "Bearer " + apiKey
	});
	var payload = Object.assign({}, ModelDefaultConfig[AI].chat, (ModelDefaultConfig[model] || {}).chat || {}, {model});
	appendToolsToRequest(payload, tools);

	return await sendRequestAndWaitForResponse('Groq', model, conversation, url, request, () => {
		payload.messages = assemblePayload(conversation);
		request.body = JSON.stringify(payload);
	}, tools, tid);
};