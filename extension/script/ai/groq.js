const {sendRequestAndWaitForResponse} = globalThis.AI || {};

globalThis.AI = globalThis.AI || {};
globalThis.AI.Groq = {};

const DefaultGroqChatModel = AI2Model.groq[0];

const assemblePayload = (conversation, model, tools) => {
	var payload = [];

	conversation.forEach(item => {
		var role = item[0], content = item[1];
		if (role === 'system') {
			payload.push({
				role: 'system',
				content
			});
		}
		else if (role === 'human' || role === 'inner') {
			payload.push({
				role: 'user',
				content
			});
		}
		else if (role === 'ai') {
			payload.push({
				role: 'assistant',
				content
			});
		}
		else if (role === 'call') {
			if (NoToolModels.includes(model)) return;
			let conv = {
				role: 'assistant',
				tool_calls: [],
			};
			content.forEach(quest => {
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
			payload.push(conv);
		}
		else if (item[0] === 'tool') {
			if (NoToolModels.includes(model)) return;
			let has = tools.some(tool => tool.name === content.name);
			if (!has) return;
			payload.push({
				role: 'tool',
				tool_call_id: content.id,
				name: content.name,
				content: content.content,
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
	const ai = Model2AI[model];

	if (NoToolModels.includes(model)) tools = [];
	else tools = AI.prepareToolList(tools);
	request.headers = Object.assign({}, ModelDefaultConfig[ai].header, (ModelDefaultConfig[model] || {}).header || {}, {
		"Authorization": "Bearer " + apiKey
	});
	var payload = Object.assign({}, ModelDefaultConfig[ai].chat, (ModelDefaultConfig[model] || {}).chat || {}, {model});
	appendToolsToRequest(payload, tools);

	return await sendRequestAndWaitForResponse('Groq', model, conversation, url, request, () => {
		payload.messages = assemblePayload(conversation, model, tools);
		request.body = JSON.stringify(payload);
	}, tools, tid);
};