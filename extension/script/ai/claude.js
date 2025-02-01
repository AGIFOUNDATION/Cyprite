const {sendRequestAndWaitForResponse} = globalThis.AI || {};

globalThis.AI = globalThis.AI || {};
globalThis.AI.Claude = {};

const DefaultChatModel = AI2Model.claude[0];

const convertItem = (role, ctx) => {
	var entry = { role };
	if (isString(ctx)) {
		entry.content = ctx;
	}
	else if (isArray(ctx)) {
		entry.content = ctx.map(item => {
			if (isString(item)) {
				return {
					type: "text",
					text: item
				}
			}
			else {
				return item;
			}
		});
	}
	else {
		entry.content = [ctx];
	}
	return entry;
};
const assembleConversation = (conversation, model, tools) => {
	const data = { messages: [] };
	const toolUses = [];
	conversation.forEach(item => {
		if (toolUses.length > 0) {
			data.messages.push(convertItem('user', toolUses));
			toolUses.splice(0);
		}

		if (item[0] === 'system') {
			data.system = item[1];
		}
		else if (item[0] === 'human' || item[0] === 'inner') {
			data.messages.push(convertItem('user', item[1]));
		}
		else if (item[0] === 'ai') {
			data.messages.push(convertItem('assistant', item[1]));
		}
		else if (item[0] === 'call') {
			if (NoToolModels.includes(model)) return;
			let ctx = item[1][0];
			let has = tools.some(tool => tool.name === ctx.name);
			if (!has) return;
			data.messages.push(convertItem('assistant', {
				"type": "tool_use",
				"id": ctx.id,
				"name": ctx.name,
				"input": ctx.arguments
			}));
		}
		else if (item[0] === 'tool') {
			if (NoToolModels.includes(model)) return;
			let has = tools.some(tool => tool.name === item[1].name);
			if (!has) return;
			toolUses.push({
				"type": "tool_result",
				"tool_use_id": item[1].id,
				"content": item[1].content,
			});
		}
	});
	if (toolUses.length > 0) {
		data.messages.push(convertItem('user', toolUses));
	}
	if (data.messages[data.messages.length - 1].role !== 'assistant') {
		data.messages.push({
			role: 'assistant',
			content: ''
		});
	}
	return data;
};
const appendToolsToRequest = (data, tools) => {
	if (!isArray(tools) || tools.length === 0) return;
	data.tools = tools.map(tool => {
		const fun = {
			name: tool.name,
			description: tool.description,
			input_schema: tool.parameters,
		};
		return fun;
	});
};

AI.Claude.chat = async (conversation, model=DefaultChatModel, tools=[], tid) => {
	const request = { method: "POST" };
	const url = "https://api.anthropic.com/v1/messages";

	if (NoToolModels.includes(model)) tools = [];
	else tools = AI.prepareToolList(tools);
	request.headers = Object.assign({}, ModelDefaultConfig.Claude.header, (ModelDefaultConfig[model] || {}).header || {});
	request.headers["x-api-key"] = myInfo.apiKey.claude;

	var data = Object.assign({}, ModelDefaultConfig.Claude.chat, (ModelDefaultConfig[model] || {}).chat || {});
	data.model = model;
	appendToolsToRequest(data, tools);

	return await sendRequestAndWaitForResponse('Claude', model, conversation, url, request, () => {
		Object.assign(data, assembleConversation(conversation, model, tools));
		request.body = JSON.stringify(data);
	}, tools, tid);
};