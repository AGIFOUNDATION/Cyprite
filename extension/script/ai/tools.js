const ArticleCache = new Map();
const CacheExpireTimeout = 1000 * 3600 * 12;
const checkArticleCacheExpire = async () => {
	const now = Date.now();
	for (let [key, cache] of ArticleCache) {
		if (!cache || !cache.time) {
			ArticleCache.delete(key);
		}
		else {
			let delta = now - cache.time;
			if (delta > CacheExpireTimeout) {
				ArticleCache.delete(key);
			}
		}
	}
};

globalThis.UtilityLib = {};

/* Message Sender */

const MessageSenders = new Map();
UtilityLib.registerMessageSender = (taskID, source, tabID) => {
	MessageSenders.set(taskID, [source, tabID]);
};
UtilityLib.removeMessageSenderByTaskID = (taskID) => {
	MessageSenders.delete(taskID);
};
UtilityLib.removeMessageSenderByTabID = (tabID) => {
	[...MessageSenders].forEach(pair => {
		if (pair[1][1] === tabID) {
			MessageSenders.delete(pair[0]);
		}
	});
};
UtilityLib.sendMessageByTaskID = (taskID, event, data) => {
	const info = MessageSenders.get(taskID);
	if (!info) return;
	const [source, tabID] = info;
	dispatchEvent({
		event, data,
		target: source,
		tid: tabID
	});
};

UtilityLib.collectInformation = {
	name: "collect_information",
	description: "Obtain complete and reliable materials related to the specified topic from local databases and/or internet.",
	parameters: {
		type: "object",
		properties: {
			topic: {
				type: "string",
				description: "The topic you want to collect information about should be described in as much detail as possible."
			}
		},
		required: ["topic"]
	},
	call: async (params, model, taskID, questID) => {
		const topic = params.topic;
		if (!topic) {
			return "NO Information";
		}

		questID = questID || newID();
		const hint = "Collecting Information: " + topic.replace(/[\n\r]+/g, ' ');
		UtilityLib.sendMessageByTaskID(taskID, "appendAction", {
			task: taskID,
			id: questID,
			hint,
			running: true,
		});

		const usage = {};
		const tasks = [];
		tasks.push(AISkils.searchLocally(topic, taskID));
		tasks.push(AISkils.searchViaGoogle(topic, taskID));
		tasks.push(AISkils.searchViaAI(topic, taskID));

		var articles = [];
		var pair;
		try {
			let [local, google, llm] = await Promise.all(tasks);

			const urls = [];
			if (!!local) {
				updateUsage(usage, local.usage);
				(local.result || []).forEach(item => {
					if (!item.url) return;
					if (urls.includes(item.url)) return;
					articles.push(item);
				});
			}
			if (!!google) {
				updateUsage(usage, google.usage);
				(google.result || []).forEach(item => {
					if (!item.url) return;
					if (urls.includes(item.url)) return;
					articles.push(item);
				});
			}
			if (!!llm) {
				updateUsage(usage, llm.usage);
				(llm.result || []).forEach(item => {
					if (!item.url) return;
					if (urls.includes(item.url)) return;
					articles.push(item);
				});
			}

			articles = articles.map(item => {
				return '<webpage title="' + (item.title || '').replace(/[\n\r]+/g, ' ') + '" url="' + item.url + '">\n' + (item.summary || '').trim() + '\n</webpage>';
			}).join('\n');
			if (IsPublished) logger.info('Tool:CollectInfo', local, google, llm, articles);

			pair = {};
			pair.call = [{
				id: questID,
				name: "collect_information",
				arguments: params,
				hint,
			}];
			pair.tool = {
				id: questID,
				name: "collect_information",
				content: articles,
			};
		}
		catch (err) {
			logger.error('CollectInformation', err);
			articles = "(Failed to search information)";
		}

		UtilityLib.sendMessageByTaskID(taskID, "appendAction", {
			task: taskID,
			id: questID,
			running: false,
			conversation: pair
		});

		return {
			result: articles,
			usage,
		};
	},
};
UtilityLib.readArticle = {
	name: "read_article",
	description: "Reading the complete content of webpages, local documents, or other files can be used to understand their ideas, find the complete original text of needed materials, or learn their writing styles, etc.",
	parameters: {
		type: "object",
		properties: {
			url: {
				type: "string",
				description: "URL of the target webpage, local documents or article."
			}
		},
		required: ["url"]
	},
	call: async (params, model, taskID, questID) => {
		const url = params.url, usage = {};
		if (!url) {
			return "NO Content";
		}

		questID = questID || newID();
		const hint = "Reading Article: " + url;
		UtilityLib.sendMessageByTaskID(taskID, "appendAction", {
			task: taskID,
			id: questID,
			hint,
			running: true,
		});

		let pair, success = true, article;

		// Read From Cache
		let cache = ArticleCache.get(url);
		if (!!cache) {
			logger.info("ReadArticle", 'From Cache: ' + url);
			article = cache.article;
		}
		else {
			// Read Local File
			article = await EventHandler.GetArticleInfo({
				articles: [url]
			});
			if (!!article) article = article[0];
			if (!!article) article = article.content;
	
			// Read from internet
			if (!article) {
				try {
					logger.log('ReadArticle', url);
					article = await EventHandler.ReadWebPage(url);
					article = parseWebPage(article, true, url) || "";
				}
				catch (err) {
					logger.error('ReadWebPage', err);
					success = false;
				}
			}
	
			if (success) {
				pair = {};
				pair.call = [{
					id: questID,
					name: "read_article",
					arguments: params,
					hint,
				}];
				pair.tool = {
					id: questID,
					name: "read_article",
					content: article,
				};
				ArticleCache.set(url, {article, time: Date.now()});
			}
		}

		UtilityLib.sendMessageByTaskID(taskID, "appendAction", {
			task: taskID,
			id: questID,
			running: false,
			conversation: pair
		});

		checkArticleCacheExpire();

		// logger.info('ReadArticle', article);
		return {
			result: article,
			usage,
		}
	},
};
UtilityLib.askExpert = {
	name: "deep_thought",
	description: "When you are uncertain about certain questions or information, unable to provide definitive replies to some issues, or need others to offer you opinions, you can invoke this tool to consult experts in relevant fields to obtain more effective and reliable information or ideas.",
	parameters: {
		type: "object",
		properties: {
			question: {
				type: "string",
				description: "Questions posed to experts should be clearly expressed and precisely formulated; if necessary, you can provide explicit constraints or known information."
			},
			field: {
				type: "string",
				description: "The fields to which the questions belong, such as Mathematics, Physics, Philosophy, Programming, Literature, Art, etc."
			}
		},
		required: ["question"]
	},
	call: async (params, model, taskID, questID) => {
		if (!params.question) {
			return "NO Question";
		}

		questID = questID || newID();
		const hint = "Deep Inner Thought: " + params.question;
		UtilityLib.sendMessageByTaskID(taskID, "appendAction", {
			task: taskID,
			id: questID,
			hint,
			running: true,
		});

		const reply = await Cyprite.Id.executeSpark(Cyprite.Abilities.askExpert, params, {}, []);
		if (!IsPublished) logger.info('DeepInnerThought', reply);

		UtilityLib.sendMessageByTaskID(taskID, "appendAction", {
			task: taskID,
			id: questID,
			running: false,
		});

		return {
			result: !!reply.error ? "**ERROR OCCUR:**\n\n" + reply.error : reply.result,
			usage: reply.usage,
		}
	},
};