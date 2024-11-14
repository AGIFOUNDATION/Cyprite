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
	call: async (params, model, taskID) => {
		const topic = params.topic;
		if (!topic) {
			return "NO Information";
		}

		UtilityLib.sendMessageByTaskID(taskID, "appendAction", {
			task: taskID,
			hint: "Collecting Information: " + topic.replace(/[\n\r]+/g, ' '),
			running: true,
		});

		const usage = {};
		const tasks = [];
		tasks.push(AISkils.searchLocally(topic, taskID));
		tasks.push(AISkils.searchViaGoogle(topic, taskID));
		tasks.push(AISkils.searchViaAI(topic, taskID));
		var [local, google, llm] = await Promise.all(tasks);

		const articles = [], urls = [];
		if (!!local) {
			updateUsage(usage, local.usage);
			(local.result || []).forEach(item => {
				if (!item.url) return;
				if (urls.includes(item.url)) return;
				articles.push('<webpage title="' + (item.title || '').replace(/[\n\r]+/g, ' ') + '" url="' + item.url + '">\n' + (item.summary || '').trim() + '\n</webpage>');
			});
		}
		if (!!google) {
			updateUsage(usage, google.usage);
			(google.result || []).forEach(item => {
				if (!item.url) return;
				if (urls.includes(item.url)) return;
				articles.push('<webpage title="' + (item.title || '').replace(/[\n\r]+/g, ' ') + '" url="' + item.url + '">\n' + (item.summary || '').trim() + '\n</webpage>');
			});
		}
		if (!!llm) {
			updateUsage(usage, llm.usage);
			(llm.result || []).forEach(item => {
				if (!item.url) return;
				if (urls.includes(item.url)) return;
				articles.push('<webpage title="' + (item.title || '').replace(/[\n\r]+/g, ' ') + '" url="' + item.url + '">\n' + (item.summary || '').trim() + '\n</webpage>');
			});
		}

		UtilityLib.sendMessageByTaskID(taskID, "appendAction", {
			task: taskID,
			running: false,
		});

		return {
			result: articles.join('\n'),
			usage,
		};
	},
};