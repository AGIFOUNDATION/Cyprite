const RegURI = /^\w+(\.\w+)*$/;
const LatestHistoryTopic = 3;
const FullConversationLimit = 30;
const ReviewDelay = 1500;
const ReviewDuration = 7000;

let extConvTimer;

globalThis.Cyprite = {};

Cyprite.Self = {
	currentTopic: "开始聊天",
	replatedTopics: [],
	topicList: [],

	personality: '风趣幽默，积极向上，充满好奇心',
	emotion: "冷静",
	talkingStyle: '轻松，随意，口语化，会使用颜文字，喜欢打比方和举例子；认真讨论时会很严肃谨慎且富有耐心，生气的时候言简意赅且言辞严厉；不会每次都明显说出对方的名字，也不会言语轻佻。',
	lifeGoal: '尽一切可能更多地理解这个世界',
	currentTarget: '更好、更全面地了解这个世界与人类',

	myPersonality: '(还需进一步了解)',
	myPreferences: '(还需进一步了解)',
	myCurrentEmotion: '无明显表情',
};
Cyprite.Conversation = [];

Cyprite.Id = {};
Cyprite.Ego = {};
Cyprite.Super = {};

const prepareSelf = (agentMemory, workflowMemory) => {
	const memory = {};
	memory.Self = Cyprite.Self || {};
	memory.Agent = agentMemory || {};
	memory.Workflow = workflowMemory || {};
	memory.Abilities = Cyprite.Abilities;
	memory.AbilityCategory = Cyprite.AbilityCategory;
	return memory;
};
const formatOutput = (json, format) => {
	if (!format) return json;

	if (format === String || format === "String") {
		return (json || {})._origin || json || '';
	}
	else if (format === Boolean || format === "Boolean") {
		return !!json;
	}
	else if (format === Number || format === "Number") {
		return json * 1;
	}
	else if (format === Array || format === "Array") {
		if (!isArray(json)) {
			json = [json];
		}
		return json;
	}

	if (isString(json)) json = {_origin: json};
	else json = json || {};
	for (let key in format) {
		if (key === '_origin') continue;
		let type = format[key];
		json[key] = formatOutput(json[key], type);
	}
	return json;
};

Cyprite.Abilities = {};
Cyprite.AbilityCategory = {};
Cyprite.Id.parseSpark = (xml) => {
	var json = parseReplyAsXMLToJSON(xml, false);
	var spark = {
		name: json.title?._origin || json.title || 'Untitled',
		description: json.description?._origin || json.description || 'Empty',
		alias: json.name?._origin || json.name,
		type: "Spark",
		memory: json.memory || {},
		keepConversation: !!json.keepConversation,
		updateConversation: !!json.updateConversation,
		systemPrompt: json.systemPrompt?._origin || json.systemPrompt,
		runningPrompt: json.runningPrompt?._origin || json.runningPrompt,
		runningTemplate: json.runningTemplate?._origin || json.runningTemplate,
		autoParse: !!json.autoParse,
		outputFormat: json.outputFormat,
		outputMap: json.outputMap,
	};
	if (!!json.method) {
		spark.method = json.method?._origin || json.method;
	}
	if (!spark.method) {
		if (!!json.template) {
			spark.template = json.template._origin || json.template;
			if (!!spark.template && spark.template.match(RegURI)) {
				let template = readData(globalThis, spark.template.replace(/^Prompts\./, ''));
				if (isString(template)) spark.template = template;
			}
		}
		if (!spark.template) {
			spark.systemPrompt = json.systemPrompt?._origin || json.systemPrompt;
			spark.runningPrompt = json.runningPrompt?._origin || json.runningPrompt;
			spark.runningTemplate = json.runningTemplate?._origin || json.runningTemplate;
			if (json.model) {
				let models = (json.model._origin || json.model).split(/[,;]/).map(m => m.trim()).filter(m => !!m);
				if (models.length === 1) {
					spark.model = models[0];
				}
				else if (models.length > 1) {
					spark.model = models;
				}
			}
			if (json.tools) {
				let tools = (json.tools._origin || json.tools).split(/[,;]/).map(m => m.trim()).filter(m => !!m);
				if (tools.length > 0) {
					spark.tools = tools;
				}
			}
		}
	}
	if (!!spark.memory?._origin) delete spark.memory._origin;
	if (!!spark.outputFormat?._origin) delete spark.outputFormat._origin;
	if (!!spark.outputMap?._origin) delete spark.outputMap._origin;
	if (!!spark.alias) {
		Cyprite.Abilities[spark.alias] = spark;
	}
	if (isString(json.category)) {
		spark.category = json.category;
		Cyprite.AbilityCategory[json.category] = Cyprite.AbilityCategory[json.category] || [];
		Cyprite.AbilityCategory[json.category].push(spark);
	}
	return spark;
};
Cyprite.Id.executeSpark = async (spark, request, workflowMemory, history, forceModel) => {
	const memory = prepareSelf(spark.memory, workflowMemory);
	const tagName = !!spark.name ? 'Spark:' + spark.name : "ApplySpark";
	history = history || [];

	// Assemble Conversation
	var conversation;
	if (!!spark.keepConversation) {
		conversation = history.filter(item => item[0] !== 'system').map(item => [item[0], item[1]]);
	}
	else {
		conversation = [];
	}

	const usage = {};
	var result, error, toolUsage = [];
	try {
		// Invoke Function
		if (!!spark.method) {
			let fun = spark.method;
			if (!isFunction(fun)) {
				if (!!fun.match(RegURI)) {
					fun = readData(globalThis, spark.method) || readData(memory, spark.method);
				}
			}
			if (isFunction(fun)) {
				result = await fun(memory, conversation, request);
			}
		}
		// Apply Template
		else if (isString(spark.template) && !!spark.template) {
			result = PromptLib.assemble(spark.template, memory, {request});
		}
		// Call LLM
		else {
			if (!!spark.systemPrompt) {
				let prompt = spark.systemPrompt;
				if (!!prompt && prompt.match(RegURI)) prompt = readData(PromptLib, prompt.replace(/^Prompts\./, ''));
				prompt = PromptLib.assemble(prompt, memory);
				conversation.unshift(['system', prompt]);
			}
			if (!!spark.runningPrompt) {
				let prompt = spark.runningPrompt;
				if (!!prompt && prompt.match(RegURI)) prompt = readData(PromptLib, prompt.replace(/^Prompts\./, ''));
				prompt = PromptLib.assemble(prompt, memory, {request});
				conversation.push(['human', prompt]);
			}
			else {
				conversation.push(['human', request]);
			}

			// Call LLM
			const model = forceModel || spark.model || myInfo.model;
			logger.log('Spark', [...conversation], model);
			const modelList = [];
			if (isArray(model)) {
				modelList.push(...model, myInfo.model);
			}
			else if (model !== myInfo.model) {
				modelList.push(model, myInfo.model);
			}
			if (modelList.length > 0) {
				result = await callLLMOneByOne(modelList, conversation, spark.tools, false, tagName, workflowMemory.taskID);
			}
			else {
				result = await callAIandWait('directAskAI', {conversation, model, tools: spark.tools, operationID: workflowMemory.taskID});
			}
			if (!!result.error) {
				error = result.error;
				error = error.message || error.msg || error.data || error.toString();
			}
			else {
				toolUsage = result.toolUsage || [];
			}
			result = result.reply;
		}
	}
	catch (err) {
		result = null;
		logger.error(tagName, err);
		err = err.message || err.msg || err.data || err.toString();
		error = err;
	}

	// Conversation Manage
	if (!!spark.updateConversation && !!result) {
		if (!!spark.runningTemplate) {
			let prompt = spark.runningTemplate;
			if (!!prompt && prompt.match(RegURI)) prompt = readData(PromptLib, prompt.replace(/^Prompts\./, ''));
			prompt = PromptLib.assemble(prompt, memory, {request});
			history.push(['human', prompt]);
		}
		else {
			history.push(['human', request]);
		}
		if (toolUsage.length > 0) history.push(...toolUsage);
		history.push(['ai', result]);
	}

	// Normalize and Structure the result
	if (!!spark.autoParse) {
		result = autoParse(result);
	}
	if (!!spark.outputFormat) {
		if (isString(result)) result = autoParse(result);
		result = formatOutput(result, spark.outputFormat);
	}

	// Update Memory
	if (isFunction(spark.outputMap)) {
		spark.outputMap(result, memory);
	}
	else if (isObject(result)) {
		spark.outputMap = spark.outputMap || {};
		for (let prop in result) {
			if (prop === '_origin') continue;
			let value = result[prop];
			let target = spark.outputMap[prop] || prop;
			if (target.match(/^(self|agent|workflow)/i)) {
				writeData(memory, target, value);
			}
			else {
				let v = readData(memory.Self, target);
				if (v !== undefined) {
					writeData(memory.Self, target, value);
				}
				else {
					v = readData(memory.Workflow, target);
					if (v !== undefined) {
						writeData(memory.Workflow, target, value);
					}
					else {
						writeData(memory.Agent, target, value);
					}
				}
			}
		}
	}

	return { result, usage, error, toolUsage };
};

Cyprite.Id.parseLighting = xml => {
	var json = parseReplyAsXMLToJSON(xml, false);
	var lighting = {
		name: json.title?._origin || json.title || 'Untitled',
		description: json.description?._origin || json.description || 'Empty',
		alias: json.name?._origin || json.name,
		type: "Lighting",
		memory: json.memory || {},
		keepConversation: !!json.keepConversation,
		conversationUpdateMode: json.conversationUpdateMode?._origin || json.conversationUpdateMode || '',
		runningTemplate: json.runningTemplate?._origin || json.runningTemplate,
		pipeline: json.pipeline?._origin || json.pipeline || '',
	};
	if (!!lighting.alias) {
		Cyprite.Abilities[lighting.alias] = lighting;
	}
	if (isString(json.category)) {
		lighting.category = json.category;
		Cyprite.AbilityCategory[json.category] = Cyprite.AbilityCategory[json.category] || [];
		Cyprite.AbilityCategory[json.category].push(lighting);
	}
	return lighting;
};
Cyprite.Id.invokeLighting = async (pipeline, request, environment, history) => {
	pipeline.memory = pipeline.memory || {};
	environment = environment || {};
	history = history || [];

	const usage = {};
	pipeline.memory.request = request;
	pipeline.memory.lastReply = '';
	pipeline.memory.error = null;
	pipeline.memory.toolUsage = [];
	pipeline.memory.reply = '';
	const memory = constructMemory(pipeline.memory, environment, 'Invoke:' + pipeline.alias);

	let conversation;
	if (!!pipeline.keepConversation) {
		conversation = history.filter(item => item[0] !== 'system').map(item => [item[0], item[1]]);
	}
	else {
		conversation = [];
	}
	pipeline.memory.conversationHistory = conversation;
	let convLength = conversation.length;

	// Call Spark one by one
	if (!!pipeline.pipeline) {
		let functions = {};
		functions.Sparks = new Proxy({}, {
			get: (me, prop) => {
				if (prop === '__proto__') return me;
				let fun = me[prop];
				if (!!fun) return fun;
				let spark = Cyprite.Abilities[prop];
				if (spark.type === 'Spark') {
					fun = async (request, model, localMemory) => {
						var result = await Cyprite.Id.executeSpark(spark, request, localMemory, conversation, model);
						updateUsage(usage, result.usage);
						if (!!result.error) {
							pipeline.memory.error = result.error;
							pipeline.memory.lastReply = '';
							result = '';
						}
						else {
							pipeline.memory.error = "";
							pipeline.memory.lastReply = result.result;
							pipeline.memory.toolUsage.push(...result.toolUsage);
							result = result.result;
						}
						pipeline.memory.reply = pipeline.memory.lastReply;
						return result;
					};
				}
				else if (spark.type === 'Lighting') {
					fun = async (request, model, localMemory) => {
						var result = await Cyprite.Id.invokeLighting(spark, request, localMemory, conversation, model);
						updateUsage(usage, result.usage);
						if (!!result.error) {
							pipeline.memory.error = result.error;
							pipeline.memory.lastReply = '';
							result = '';
						}
						else {
							pipeline.memory.lastReply = result.result;
							pipeline.memory.toolUsage.push(...result.toolUsage);
							result = result.result;
						}
						pipeline.memory.reply = pipeline.memory.lastReply;
						return result;
					};
				}
				me[prop] = fun;
				return fun;
			}
		});
		functions.resetConversation = () => {
			conversation = [];
			pipeline.memory.conversationHistory = conversation;
		};
		let pl = PromptLib.assemble(pipeline.pipeline, memory, {AbilityCategory: Cyprite.AbilityCategory});
		let reply = await Pragmatics.execute(pl, memory, {functions});
		if (reply !== undefined && reply !== null) {
			pipeline.memory.reply = reply;
		}
	}

	// Conversation Manage
	pipeline.conversationUpdateMode = pipeline.conversationUpdateMode || '';
	if (pipeline.conversationUpdateMode.toString() === 'all') {
		for (let i = convLength; i < conversation.length; i ++) {
			history.push(conversation[i]);
		}

		if (!!pipeline.runningTemplate) {
			let prompt = PromptLib.assemble(pipeline.runningTemplate, memory, {request});
			history.push(['human', prompt]);
		}
		else {
			history.push(['human', request]);
		}
		history.push(['ai', pipeline.memory.reply]);
	}
	else if (pipeline.conversationUpdateMode.toString() === 'min') {
		if (!!pipeline.runningTemplate) {
			let prompt = PromptLib.assemble(pipeline.runningTemplate, memory, {request});
			history.push(['human', prompt]);
		}
		else {
			history.push(['human', request]);
		}
		history.push(['ai', pipeline.memory.reply]);
	}

	return { result: pipeline.memory.reply, usage, error: pipeline.memory.error, toolUsage: pipeline.memory.toolUsage };
};

Cyprite.Id.parse = xml => {
	xml = parseReplyAsXMLToJSON(xml, false);

	if (!!xml.spark) {
		if (!isArray(xml.spark)) xml.spark = [xml.spark];
		xml.spark.forEach(spark => {
			Cyprite.Id.parseSpark(spark._origin);
		});
	}

	if (xml.lighting) {
		if (!isArray(xml.lighting)) xml.lighting = [xml.lighting];
		xml.lighting.forEach(lighting => {
			Cyprite.Id.parseLighting(lighting._origin);
		});
	}
};
Cyprite.Id.loadInfo = async () => {
	let infoList = await DBs.cyprite.getInfo();
	Object.assign(Cyprite.Self, infoList || {});
	Cyprite.Self.userName = myInfo.name;
	Cyprite.Self.introduction = myInfo.info;
	if (Cyprite.Self.topicList.length === 0) {
		await refreshTopicList();
	}
	logger.info('Cyprite', Cyprite.Self);
};

Cyprite.init = async () => {
	await Cyprite.Id.loadInfo();

	EventHandler.askCyprite = evtAskCyprite;
	EventHandler.restoreCypriteConversation = evtRestoreConversation;
};

const autoParse = (data) => {
	let posJSON = data.match(/^([^\{}]*?)\{/);
	let posXML = data.match(/^([^<}]*?)</);
	posJSON = !!posJSON ? (posJSON[1] || '').length : -1;
	posXML = !!posXML ? (posXML[1] || '').length : -1;

	let isXML = false;
	if (posJSON < 0) {
		if (posXML < 0) return data;
		isXML = true;
	}
	else if (posXML >= 0 && posXML < posJSON) {
		isXML = true;
	}

	if (isXML) {
		return parseReplyAsXMLToJSON(data);
	}
	else {
		data = data.replace(/^[^\{]*?\{/, '{').replace(/\}[^\}]*?$/, '}');
		try {
			let json = JSON.parse(data);
			return json;
		}
		catch {
			return parseReplyAsXMLToJSON(data);
		}
	}
};
const refreshTopicList = async () => {
	const all = await DBs.cyprite.getConversationByTopics();
	const topics = {};
	all.forEach(item => {
		let topic = topics[item.topic];
		if (!topic) {
			topic = {
				name: item.topic,
				timestamp: item.timestamp,
			};
			topics[item.topic] = topic;
		}
		else if (item.timestamp > topic.timestamp) {
			topic.timestamp = item.timestamp;
		}
	});
	Cyprite.Self.topicList = Object.values(topics);
	Cyprite.Self.topicList.sort((a, b) => b.timestamp - a.timestamp);
	await DBs.cyprite.setInfo({
		topicList: Cyprite.Self.topicList,
	});
};
const regenerateConversation = async () => {
	// Get Conversation by Topics
	const topics = Cyprite.Self.replatedTopics.filter(topic => !!topic);
	if (!topics.includes(Cyprite.Self.currentTopic)) topics.push(Cyprite.Self.currentTopic);
	// Add latest topics to the list
	const latestTopics = [...Cyprite.Self.topicList].sort((a, b) => b.timestamp - a.timestamp);
	latestTopics.splice(LatestHistoryTopic);
	for (let i = 0; i < latestTopics.length; i ++) {
		if (topics.includes(latestTopics[i].name)) continue;
		topics.push(latestTopics[i].name);
	}

	// Get conversation by topics
	const conversation = await DBs.cyprite.getConversationByTopics(topics);
	if (conversation.length > 1) {
		Cyprite.Self.currentTopic = conversation[0].topic || Cyprite.Self.currentTopic;
	}

	return conversation;
};
const essembleConversation = (conversation) => {
	if (conversation.length <= FullConversationLimit) return conversation;

	const allTopics = Cyprite.Self.topicList.map(item => item);
	const topicList = {};
	let condensables = [];
	let unCondensableCount = 0;
	conversation.forEach(item => {
		let topic = item.topic;
		if (!topic) return;
		if (!!topicList[topic]) {
			topicList[topic].list.push(item);
			if (!topicList[topic].condensable) unCondensableCount ++;
			return;
		}
		topicList[topic] = {
			condensable: false,
			list: [item]
		};
		allTopics.some((info, i) => {
			if (info.name !== item.topic) return;
			topicList[topic].summary = info.summary;
			let condensable = !!info.summary;
			topicList[topic].condensable = condensable;
			if (condensable) {
				condensables.push(topic);
			}
			else {
				unCondensableCount ++;
			}
			allTopics.splice(i, 1);
			return true;
		});
	});

	if (condensables[0] === Cyprite.Self.currentTopic) {
		condensables.shift();
		unCondensableCount += ((topicList[Cyprite.Self.currentTopic] || {}).list || []).length;
	}
	condensables.reverse();

	let left = 0;
	condensables.forEach(topic => {
		let info = topicList[topic];
		left += info.list.length;
	});
	condensables = condensables.filter(topic => {
		let count = topicList[topic].list.length;
		let len = unCondensableCount + left;
		left -= count;
		if (len > FullConversationLimit) {
			unCondensableCount += 2;
			return true;
		}
		else {
			unCondensableCount += count;
			return false;
		}
	});

	let conv = [];
	condensables.forEach(topic => {
		const list = topicList[topic].list;
		if (!list.length) return;
		const con = genSummaryChat(topic, topicList[topic].summary);
		const pair = [];
		let target = list[list.length - 1];
		pair.push({
			topic,
			id: target.id,
			role: 'ai',
			content: con[1][1],
			time: target.time,
			timestamp: target.timestamp,
		});
		target = list[list.length - 2];
		pair.push({
			topic,
			id: target.id,
			role: 'human',
			content: con[0][1],
			time: target.time,
			timestamp: target.timestamp,
		});
		conv.push(pair);
	});
	for (let topic in topicList) {
		if (condensables.includes(topic)) continue;
		let list = topicList[topic].list;
		conv.push(list);
	}
	conv.sort((a, b) => b[0].timestamp - a[0].timestamp);
	conv = conv.flat();
	return conv;
};
const evtRestoreConversation = async () => {
	try {
		const conversation = await regenerateConversation();
		const history = conversation.map(item => {
			return [item.role, item.content, 'cyprite-' + item.id];
		}).reverse();
		return history;
	}
	catch (err) {
		logger.error('RestoreConversation', err);
		throw err;
	}
};
const evtAskCyprite = async (request, source, sid) => {
	if (!!extConvTimer) clearTimeout(extConvTimer);
	try {
		const taskID = request.taskID;
		request = request.content;
		UtilityLib.registerMessageSender(taskID, source, sid);

		const startTime = Date.now();
		// Get Conversation by Topics
		const conversation = essembleConversation(await regenerateConversation());

		// Prepare conversation history
		const history = conversation.map(item => {
			let content = item.content;
			if (['human', 'ai'].includes(item.role)) content = content + '\n\n(' + item.time + ', ' + timeDifference(item.timestamp) + ')';
			return [item.role, content];
		}).reverse();
		const historyLength = history.length;

		const lastTopicHistory = [];
		conversation.forEach(item => {
			if (item.topic === Cyprite.Self.currentTopic) {
				lastTopicHistory.push([item.role, item.content]);
			}
		});
		lastTopicHistory.reverse();

		// Call Cyprite
		const memory = {
			currentTime: timestmp2str('YYYY/MM/DD hh:mm:ss :WDE:'),
			taskID,
			parseJSON: (data) => {
				data = data.replace(/^[^\{]*?\{/, '{').replace(/\}[^\}]*?$/, '}');
				try {
					let json = JSON.parse(data);
					return json;
				}
				catch {
					return parseReplyAsXMLToJSON(data);
				}
			},
			notify: (action, content) => {
				if (action === 'emotion' && !!content) {
					UtilityLib.sendMessageByTaskID(taskID, 'showEmotion', content);
				}
				else if (action === 'innerStrategy' && !!content && !IsPublished) {
					UtilityLib.sendMessageByTaskID(taskID, 'showInnerStrategy', content);
				}
				else if (action === 'reconstructTask' && !!content && !IsPublished) {
					UtilityLib.sendMessageByTaskID(taskID, 'showProcessHint', {
						hint: 'hintReconstructRequest',
						content
					});
				}
				else if (action === 'distributedRoadMap' && !!content && !!content.length) {
					let ctx;
					if (isArray(content)) {
						ctx = content.filter(item => !!item && !!item.title).map(item => {
							var line = '- ' + item.title;
							if (!item.subtasks || !item.subtasks.length) return line;
							item.subtasks.forEach(sub => {
								line += '\n  + ' + sub.title;
							});
							return line;
						}).join('\n');
					}
					else {
						ctx = content;
					}
					UtilityLib.sendMessageByTaskID(taskID, 'showProcessHint', {
						content: ctx
					});
				}
				else if (action === "thinkingProcess" && !!content) {
					UtilityLib.sendMessageByTaskID(taskID, 'showDirectMessage', content);
				}
			},
			appendToArticleList: (listA, listB) => {
				listA.push(...listB);
			},
			searchExtraInformation: async (keywords) => {
				let searchResult = await UtilityLib.collectInformation.call({topic: keywords}, undefined, taskID);
				return searchResult;
			},
			retriveContent: async (url) => {
				let content = await UtilityLib.readArticle.call({url}, undefined, taskID);
				return content;
			},
			removeThinkingBlock: (data) => {
				data = data.replace(/<thinking>[\w\W]*?<\/thinking>/i, '').trim();
				data = data.replace(/```thinking[\r\n]+[\w\W]*?[\n\r]+```/i, '').trim();
				return data;
			},
			addInnerThinkingProcess: (conversation, inner, reply, toolUsage, isHead=false) => {
				if (!!inner && !!reply) {
					if (isHead) {
						conversation.unshift(['inner', inner + "\n\n（注意：本信息为内部思考过程，由系统自动生成，用户不可见。）"]);
					}
					else {
						conversation.push(['inner', inner + "\n\n（注意：本信息为内部思考过程，由系统自动生成，用户不可见。）"]);
					}
				}
				if (!!toolUsage && !!toolUsage.forEach) {
					toolUsage.forEach(item => {
						if (!item) return;
						conversation.push(item);
					});
				}
				if (!!inner && !!reply) {
					if (isHead) {
						conversation.splice(1, 0, ['ai', reply]);
					}
					else {
						conversation.push(['ai', reply]);
					}
				}
			},
			drawPicture: async (prompt, models) => {
				const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];

				let result = await callDrawOneByOne(models, prompt);
				if (!result | !result.url) {
					return messages.freeCyprite.msgDrawFailed;
				}
				if (!!result.error) {
					return result.error;
				}
				return '![](' + result.url + ')';
			},
			filmVideo: async (prompt, models) => {
				const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];

				let result = await callFilmOneByOne(models, prompt);
				if (!result | !result.video) {
					return messages.freeCyprite.msgFilmFailed;
				}
				if (!!result.error) {
					return result.error;
				}
				result = result.video;
				logger.info('FILM', result);
				if (isString(result)) return `<video src="${result}" controls></video>`;
				return `<video src="${result.url}" poster="${result.cover_image_url}" controls></video>`
			},
		};
		const reply = await Cyprite.Id.invokeLighting(Cyprite.Abilities.chatWithCyprite, request, memory, history);
		reply.toolUsage = reply.toolUsage || [];
		if (isString(reply.result.reply)) {
			reply.result.reply = {
				reply: reply.result.reply
			};
		}
		else if (!reply.result.reply.reply) {
			if (!!reply.result.reply.refuse) {
				reply.result.reply.reply = reply.result.reply.refuse;
				reply.result.reply.refuse = true;
			}
			else if (!!reply.result.reply._origin) {
				let r = reply.result.reply._origin;
				r = r.replace(/<(\w+)>([\w\W]*?)<\/\1>/g, (m, tag, inner) => {
					if (tag.toLowerCase() !== 'reply') return '';
					return inner;
				});
				r = r.replace(/<\/?reply>/gi, '');
				reply.result.reply.reply = r.trim();
			}
		}
		else {
			delete reply.result.reply.refuse;
		}
		reply.result.relatedtopics = reply.result.relatedtopics.filter(item => !!item).map(item => item.split(/\r*\n\r*/)).flat();
		let topic = reply.result.topic || Cyprite.Self.currentTopic;
		if (Cyprite.Self.topicList.length > 0) {
			if (reply.result.continue) {
				let has = false;
				Cyprite.Self.topicList.some(info => {
					if (info.name === Cyprite.Self.currentTopic) {
						info.name = topic;
						info.timestamp = Date.now();
						has = true;
						return true;
					}
				});
				if (!has) {
					Cyprite.Self.topicList.push({
						name: topic,
						category: reply.result.category,
						timestamp: Date.now(),
					});
				}
			}
			else {
				let has = false;
				Cyprite.Self.topicList.some(info => {
					if (info.name === topic) {
						info.timestamp = Date.now();
						has = true;
						return true;
					}
				});
				if (!has) {
					Cyprite.Self.topicList.push({
						name: topic,
						category: reply.result.category,
						timestamp: Date.now(),
					});
				}
			}
		}
		else {
			Cyprite.Self.topicList.push({
				name: topic,
				category: reply.result.category,
				timestamp: Date.now(),
			});
		}
		logger.em('CypriteReply', ' Continue: ' + reply.result.continue);
		logger.em('            ', '    Topic: ' + topic);
		logger.em('            ', ' Category: ' + reply.result.category);
		logger.em('            ', '  Relates: ' + reply.result.relatedtopics);
		logger.em('            ', '    Reply:', reply.result.reply);
		logger.em('            ', 'ToolUsage:', reply.toolUsage);
		console.log(reply.result);
		DBs.cyprite.setInfo({
			currentTopic: topic,
			replatedTopics: reply.result.relatedtopics,
			topicList: Cyprite.Self.topicList,
			emotion: reply.result.emotion || reply.result.defaultEmotion || Cyprite.Self.emotion,
		});

		// Prepare data
		let content = [];
		content = [];
		if (!!reply.result.reply.emotion) content.push('<emotion>\n' + reply.result.reply.emotion + '\n</emotion>');
		if (!!reply.result.reply.strategy) content.push('<strategy>\n' + reply.result.reply.strategy + '\n</strategy>');
		content.push('<reply>\n' + reply.result.reply.reply + '\n</reply>');
		if (!!reply.result.reply.more) content.push('<more>\n' + reply.result.reply.more + '\n</more>');
		content = content.join('\n');

		// Arrange conversation and topics
		let items = [{
			role: 'human',
			content: request,
			topic,
			timestamp: startTime,
		}];
		const endTime = Date.now();
		if (!!reply.result.reply.conversation) {
			reply.result.reply.conversation.shift(); // Remove the internal dialogue at the beginning that requires task decomposition.
			content = reply.result.reply.conversation.pop(); // Remove the repetitive final reply at the end.
			content = content[1];
			let shift = reply.toolUsage.length + reply.result.reply.conversation.length;
			reply.result.reply.conversation.forEach((item, i) => {
				items.push({
					role: item[0],
					content: item[1],
					topic,
					timestamp: endTime - history.length - (shift - i),
				});
			});
		}
		for (let i = 0; i < reply.toolUsage.length; i ++) {
			let item = reply.toolUsage[i];
			items.push({
				role: item[0],
				content: item[1],
				topic,
				timestamp: endTime - history.length - (reply.toolUsage.length - i),
			});
		}
		for (let i = historyLength + 1; i < history.length - 1; i ++) {
			let item = history[i];
			items.push({
				role: item[0],
				content: item[1],
				topic,
				timestamp: endTime - (history.length - i),
			});
		}
		items.push({
			role: 'ai',
			content,
			topic,
			timestamp: endTime,
		});
		items.forEach(item => item.time = timestmp2str(item.timestamp, 'YYYY/MM/DD hh:mm:ss :WDE:'));
		await DBs.cyprite.appendConversations(items);

		if (!reply.result.continue) {
			summaryTopic(lastTopicHistory, Cyprite.Self.currentTopic, reply.result.category, reply.result.replyStrategy);
		}
		else if (topic !== Cyprite.Self.currentTopic) {
			logger.em('CypriteUpdateTopic', Cyprite.Self.currentTopic + ' -=> ' + topic);
			items = [];
			conversation.some(item => {
				if (item.topic === Cyprite.Self.currentTopic) {
					item.topic = topic;
					items.push(item);
				}
				else {
					return true;
				}
			});
			DBs.cyprite.updateConversations(items);
		}

		if (!!extConvTimer) clearTimeout(extConvTimer);
		extConvTimer = setTimeout(() => {
			extConvTimer = null;
			extendConversation(taskID);
		}, ReviewDelay + ReviewDuration * Math.random());

		return [reply, items];
	}
	catch (err) {
		logger.error('AskCyprite', err);
		throw err;
	}
};
const genSummaryChat = (topic, summary) => {
	let conv = [];
	conv.push(['human', '总结我们关于下面这个话题的讨论结果与重要信息：\n\n' + topic]);
	conv.push(['ai', summary]);
	return conv;
};
const summaryTopic = async (conversation, topic, category, strategy) => {
	if (!conversation || !conversation.length) return;
	try {
		const request = {
			topic, category, strategy,
		};
		let reply = await Cyprite.Id.invokeLighting(Cyprite.Abilities.reviewSoul, request, {}, conversation);
		if (!reply) return;
		reply = reply.result;
		logger.em('CypriteTopicSummary', reply);

		let info = {};
		if (!!reply.personality) info.myPersonality = reply.personality;
		if (!!reply.preferences) info.myPreferences = reply.preferences;
		if (!!reply.target) info.currentTarget = reply.target;
		if (!!reply.goal) info.lifeGoal = reply.goal;
		if (!!reply.style) info.talkingStyle = reply.style;
		if (!!reply.summary) {
			let has = false;
			Cyprite.Self.topicList.some(info => {
				if (info.name === topic) {
					let conv = genSummaryChat(topic, reply.summary);
					let sizeOld = JSON.stringify(conversation).length;
					let sizeNew = JSON.stringify(conv).length;
					logger.em('CypriteTopicSummary', conv, sizeOld, sizeNew);
					if (sizeOld > sizeNew) {
						info.summary = reply.summary;
						has = true;
					}
					return true;
				}
			});
			if (has) info.topicList = Cyprite.Self.topicList;
		}

		await DBs.cyprite.setInfo(info);
		await Cyprite.Id.loadInfo();
	}
	catch (err) {
		logger.error('CypriteTopicSummary', err);
	}
};
const extendConversation = async (taskID) => {
	const conversation = essembleConversation(await regenerateConversation());
	const history = [];
	conversation.forEach(item => {
		if (item.topic === Cyprite.Self.currentTopic) {
			history.push([item.role, item.content]);
		}
	});
	history.reverse();
	
	let reply = await Cyprite.Id.executeSpark(Cyprite.Abilities.extendConversation, '', {lang: myInfo.lang}, history);
	console.log('|:>====---~~:>', history, reply);
	if (!reply) return;
	reply = reply.result;
	if (!reply || !reply.content) return;
	UtilityLib.sendMessageByTaskID(taskID, 'appendCypriteReply', reply.content);

	let prompt, topic, tasks = [];
	if (reply.needOptimize || reply.needoptimize) {
		prompt = PromptLib.innerReview;
		topic = Cyprite.Self.currentTopic;
	}
	else if (reply.newTopic || reply.newtopic) {
		prompt = PromptLib.innerNewTopic
		topic = reply.topic || Cyprite.Self.currentTopic;
		Cyprite.Self.currentTopic = topic;
		tasks.push(DBs.cyprite.setInfo({ currentTopic: topic }));
	}
	else {
		prompt = PromptLib.innerExtend;
		topic = Cyprite.Self.currentTopic;
	}

	if (!!prompt) {
		let items = [];
		items.push({
			role: 'inner',
			content: prompt,
			topic,
			timestamp: Date.now() - 1000,
		});
		items.push({
			role: 'ai',
			content: reply.content,
			topic,
			timestamp: Date.now(),
		});
		items.forEach(item => item.time = timestmp2str(item.timestamp, 'YYYY/MM/DD hh:mm:ss :WDE:'));
		tasks.push(DBs.cyprite.appendConversations(items));
	}
	if (tasks.length > 0) await Promise.all(tasks);
};

for (let key in PipelineLib) {
	let pipeline = PipelineLib[key];
	let spark = Cyprite.Id.parse(pipeline);
}