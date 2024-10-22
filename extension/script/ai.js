import "./ai/prompts.js";
import "./ai/gpt.js";
import "./ai/gemini.js";
import "./ai/claude.js";
import "./ai/groq.js";

const ResMap = new Map();
const EmbeddingLimit = 2024;
const embedAIModel = ForceServer ? () => {} : AI.Gemini.embed;

var synchronousCount = 0;

const LLMUsage = {};
const ModelUsage = {};
globalThis.recordAIUsage = (model, ai, usage) => {
	var record = LLMUsage[ai];
	if (!record) {
		record = {
			count: 0,
			input: 0,
			output: 0,
		};
		LLMUsage[ai] = record;
	}
	record.count += usage.count;
	record.input += usage.input;
	record.output += usage.output;

	record = ModelUsage[model];
	if (!record) {
		record = {
			count: 0,
			input: 0,
			output: 0,
		};
		ModelUsage[model] = record;
	}
	record.count += usage.count;
	record.input += usage.input;
	record.output += usage.output;

	var data = {
		'llm_usage_record': LLMUsage,
		'model_usage_record': ModelUsage,
	};
	chrome.storage.local.set(data);
};
globalThis.showAIUsage = async () => {
	await loadAIUsage();
	logger.em('AI USAGE', "LLM Usage:");
	var table = [];
	for (let ai in LLMUsage) {
		let usage = LLMUsage[ai];
		table.push({
			LLM: ai,
			count: usage.count,
			input: usage.input,
			output: usage.output,
		});
	}
	console.table(table, ['LLM', 'count', 'input', 'output']);

	logger.em('AI USAGE', "Model Usage:");
	table = [];
	for (let ai in ModelUsage) {
		let usage = ModelUsage[ai];
		table.push({
			model: ai,
			count: usage.count,
			input: usage.input,
			output: usage.output,
		});
	}
	console.table(table, ['model', 'count', 'input', 'output']);
};
globalThis.resetAIUsage = () => {
	LLMUsage = {};
	ModelUsage = {};
	chrome.storage.local.remove(['llm_usage_record', 'model_usage_record']);
};
globalThis.loadAIUsage = async () => {
	var info = await chrome.storage.local.get(['llm_usage_record', 'model_usage_record']);
	var llm = info['llm_usage_record'], model = info['model_usage_record'];
	if (!!llm) {
		for (let ai in llm) {
			LLMUsage[ai] = llm[ai];
		}
	}
	if (!!model) {
		for (let ai in model) {
			ModelUsage[ai] = model[ai];
		}
	}
};
showAIUsage();

globalThis.callAIandWait = (action, data) => new Promise(async (res, rej) => {
	if (!myInfo.inited) {
		await getWSConfig();
	}

	var taskId = newID();

	// If forcely call AI from server
	if (ForceServer) {
		if (sendMessage === DefaultSendMessage) {
			rej('No AI Server Available');
		}
		else {
			try {
				let reply = await callServer(action, data);
				res(reply);
			}
			catch (err) {
				rej(err);
			}
		}
	}
	else {
		let useEdgeAI = true;
		// Call AI from Server
		if (!myInfo.useLocalKV) {
			if (sendMessage !== DefaultSendMessage) {
				useEdgeAI = false;
				try {
					let reply = await callServer(action, data);
					res(reply);
				}
				catch {
					useEdgeAI = true;
				}
			}
		}
		// Call AI from Extension
		if (useEdgeAI) {
			if (!myInfo.edgeAvailable) {
				const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
				console.error(messages.noAPIKey, JSON.parse(JSON.stringify(myInfo)));
				chrome.notifications.create({
					title: messages.cypriteName,
					message: messages.noAPIKey,
					type: "basic",
					iconUrl: "/images/icon1024.png",
				});
				rej(messages.noAPIKey);
			}
			else {
				let handler = EdgedAI[action];
				if (!handler) {
					let errMsg = 'NO such action: ' + action;
					logger.error('AI', errMsg);
					rej(errMsg);
				}
				else {
					ResMap.set(taskId, [res, rej]);
					handler(taskId, data);
				}
			}
		}
	}
});
const replyRequest = (tid, reply, error) => {
	var res = ResMap.get(tid);
	if (!res) return;
	ResMap.delete(tid);
	if (!!error) res[1](error);
	else res[0](reply);
};
const splitParagraph = (content, mark) => {
	content = '\n' + content;

	var blocks = [], lastPos = 0;
	content.replace(new RegExp('\\n' + mark + '\\s+', 'gi'), (m, pos) => {
		var block = content.substring(lastPos, pos);
		lastPos = pos;
		block = block.trim();
		blocks.push(block);
	});
	blocks.push(content.substring(lastPos).trim());
	blocks = blocks.filter(block => !!block);
	blocks = blocks.map(block => {
		if (block.length > EmbeddingLimit) {
			return [false, block];
		}
		else {
			return [true, block];
		}
	});
	return blocks;
};
const splitSentence = (content, reg, nextLine=false) => {
	var sentences = [], lastPos = 0;
	content.replace(reg, (m, ...args) => {
		var pos;
		args.some(arg => {
			if (isNumber(arg)) {
				pos = arg;
				return true;
			}
		});
		pos += m.length;
		var sub = content.substring(lastPos, pos);
		lastPos = pos;
		sentences.push(sub);
	});
	sentences.push(content.substring(lastPos));
	sentences = sentences.filter(line => !!line.trim());

	var parts = [], size = 0, temp = '', delta = nextLine ? 1 : 0;
	sentences.forEach(line => {
		var len = line.length;
		if (len > EmbeddingLimit) {
			parts.push([true, temp.trim()]);
			temp = '';
			size = 0;
			parts.push([false, line.trim()]);
		}
		else if (size + len + delta > EmbeddingLimit) {
			parts.push([true, temp.trim()]);
			temp = line;
			size = len;
		}
		else {
			if (nextLine) temp = temp + '\n' + line;
			else temp = temp + line;
			size = temp.length;
		}
	});
	if (!!temp.trim()) parts.push([true, temp.trim()]);
	return parts;
};
const batchize = content => {
	content = splitParagraph(content, '#');
	content = content.map(content => {
		if (content[0]) return content[1];
		content = splitParagraph(content[1], '##');
		content = content.map(content => {
			if (content[0]) return content[1];
			content = splitParagraph(content[1], '###');
			content = content.map(content => {
				if (content[0]) return content[1];
				content = splitParagraph(content[1], '####');
				content = content.map(content => {
					if (content[0]) return content[1];
					content = splitSentence(content[1], /(\r*\n\r*)+/g, true);
					content = content.map(content => {
						if (content[0]) return content[1];
						content = splitSentence(content[1], /[\.\?\!。？！…]['"’”]?/gi);
						content = content.map(content => {
							if (content[0]) return content[1];
							content = splitSentence(content[1], /[,;，；]['"’”]?\s*/gi);
							content = content.map(content => {
								if (content[0]) return content[1];
								content = splitSentence(content[1], /\s+/gi);
								content = content.map(content => {
									if (content[0]) return content[1];
									content = content[1];
									var block = [];
									var count = Math.ceil(content.length / EmbeddingLimit);
									var size = Math.ceil(content.length / count);
									for (let i = 0; i < count; i ++) {
										let j = i * size;
										let line = content.substring(j, j + size);
										block.push(line);
									}
									return block;
								});
								return content;
							});
							return content;
						});
						return content;
					});
					return content;
				});
				return content;
			});
			return content;
		});
		return content;
	});

	content = content.flat(Infinity);
	content = content.filter(block => !!block);
	return content;
};
const callEdgeAI = async (tid, conversation, model) => {
	conversation = conversation.map(item => [...item]); // Duplicate Conversation

	model = model || myInfo.model;
	if (!model) {
		replyRequest(tid, null, new Error('AI Model not set.'));
		return;
	}

	var aiName = Model2AI[model];
	var chatToAI = AI[aiName];
	if (!!chatToAI) chatToAI = chatToAI.chat;
	if (!chatToAI) {
		replyRequest(tid, null, new Error('No AI for Model ' + model));
		return;
	}
	synchronousCount ++;
	logger.strong('AI-Start', "Synchronous: " + synchronousCount);

	var reply, errMsg;
	try {
		reply = await chatToAI(conversation, model);
		recordAIUsage(model, aiName, reply.usage);
		let usage = {};
		usage[model] = reply.usage;
		usage[aiName] = reply.usage;
		reply = {
			reply: reply.reply,
			usage,
		};
	}
	catch (err) {
		if (isString(err)) {
			errMsg = new Error(err);
		}
		else {
			errMsg = err;
		}
		reply = null;
	}

	synchronousCount --;
	logger.strong('AI-Finish', "Synchronous: " + synchronousCount);
	replyRequest(tid, reply, errMsg);
};

const EdgedAI = {};
EdgedAI.summarizeArticle = async (tid, article) => {
	var prompt = PromptLib.assemble(PromptLib.summarizeArticle, { article, lang: LangName[myInfo.lang] });

	callEdgeAI(tid, [['human', prompt]]);
};
EdgedAI.embeddingArticle = async (tid, data) => {
	var batch = [];
	var content = data.article || data.summary;
	if (content.length > EmbeddingLimit) {
		content = batchize(content);
		content.forEach((ctx, i) => {
			batch.push({
				title: data.title + '-' + (i + 1),
				content: ctx
			});
		});
	}
	else {
		batch.push({
			title: data.title,
			content
		});
	}

	var reply, errMsg;
	try {
		reply = await embedAIModel(batch);
	}
	catch (err) {
		logger.error('Embedding', err);
		if (isString(err)) {
			errMsg = new Error(err);
		}
		else {
			errMsg = err;
		}
	}

	replyRequest(tid, reply, errMsg);
};
EdgedAI.directAskAI = async (tid, conversation) => {
	var model = myInfo.model;
	if (isObject(conversation)) {
		model = conversation.model || model;
		conversation = conversation.conversation;
	}

	callEdgeAI(tid, conversation, model);
};
EdgedAI.translateSentence = async (tid, data) => {
	var prompt = [];
	prompt.push(['human', PromptLib.assemble(PromptLib.instantTranslation, data)]);

	callEdgeAI(tid, prompt);
};

EdgedAI.sayHello = async (tid) => {
	return;
	var prompt = PromptLib.assemble(PromptLib.sayHello, {
		lang: LangName[myInfo.lang],
		name: myInfo.name,
		info: myInfo.info,
		time: timestmp2str(Date.now(), "YY年MM月DD日 :WDE: hh:mm"),
	});

	callEdgeAI(tid, [['human', prompt]]);
};