var webSocket, lastWSURL;
globalThis.DefaultSendMessage = async (event, data, sender, sid) => {
	if (!webSocket || !webSocket.send) {
		let done = !!lastWSURL;
		if (!!done) {
			try {
				done = await prepareWS(lastWSURL);
			}
			catch (err) {
				console.error(err);
				done = false;
			}
		}
		if (!done) {
			// throw new Error('AIServerNotReady');
			return;
		}
	}

	data = {event, data, sender, sid};
	data = JSON.stringify(data);
	webSocket.send(data);
};
globalThis.sendMessage = DefaultSendMessage;

const parseMsg = evt => {
	var msg = evt.data;
	if (!isString(msg)) return null;
	try {
		msg = JSON.parse(msg);
	}
	catch {
		return null;
	}
	msg.target = msg.target || "BackEnd";
	return msg;
};

globalThis.updateAIModelList = () => {
	var available = false;
	ModelList.splice(0);

	for (let ai in myInfo.apiKey) {
		let key = myInfo.apiKey[ai];
		if (!key) continue;
		available = true;
		if (!!AI2Model[ai]) ModelList.push(...AI2Model[ai]);
	}
	myInfo.edgeAvailable = available;
	console.log('~~~~~~~~>', myInfo);
};
globalThis.getWSConfig = async () => {
	var [localInfo, remoteInfo] = await Promise.all([
		chrome.storage.local.get(['wsHost', 'apiKey', 'AImodel']),
		chrome.storage.sync.get(['name', 'info', 'lang']),
	]);
	logger.em('EXT', 'Config Loaded');

	var tasks = [];
	myInfo.inited = true;
	myInfo.name = remoteInfo.name || myInfo.name;
	myInfo.info = remoteInfo.info || myInfo.info;
	myInfo.lang = remoteInfo.lang;
	if (!myInfo.lang) {
		myInfo.lang = DefaultLang;
	}
	else {
		myInfo.lang = myInfo.lang.toLowerCase();
		if (!i18nList.includes(myInfo.lang)) myInfo.lang = DefaultLang;
	}
	if (myInfo.lang !== remoteInfo.lang) {
		tasks.push(chrome.storage.sync.set({lang: myInfo.lang}));
	}

	myInfo.apiKey = localInfo.apiKey || {};
	if (isString(myInfo.apiKey)) {
		let apiKey = {};
		if (!!myInfo.apiKey) apiKey.gemini = myInfo.apiKey;
		myInfo.apiKey = apiKey;
		tasks.push(chrome.storage.local.set({apiKey: myInfo.apiKey}));
	}
	myInfo.useLocalKV = ForceBackend ? false : !localInfo.wsHost;
	myInfo.model = localInfo.AImodel || myInfo.model || ModelList[0];
	updateAIModelList();
	logger.em('EXT', myInfo);

	if (tasks.length > 0) await Promise.all(tasks);

	return localInfo.wsHost;
};
globalThis.initWS = async () => {
	var wsHost = await getWSConfig();
	var available = await checkAvailability();
	if (!available) return;

	if (myInfo.useLocalKV) {
		logger.info('WS', 'Use Edged Knowledge Vault');

		let installed = await chrome.storage.local.get('installed');
		installed = installed.installed || false;
		if (!installed) return;
		AIHandler.sayHello();
	}
	else {
		logger.info('WS', 'Host: ' + wsHost);
		try {
			await prepareWS(wsHost);
		} catch {}
	}
};
globalThis.prepareWS = (wsUrl) => new Promise(res => {
	lastWSURL = wsUrl;

	// Close last socket
	if (!!webSocket) webSocket.close();

	var socket = new WebSocket(wsUrl);

	socket.onopen = async () => {
		logger.info('WS', 'Opened');

		webSocket = socket;
		globalThis.sendMessage = async (event, data, sender, sid) => {
			if (!webSocket || !webSocket.send) {
				let done;
				try {
					done = await prepareWS(wsUrl);
				}
				catch (err) {
					console.error(err);
					done = false;
				}
				if (!done) {
					throw new Error('AIServerNotReady');
				}
			}

			data = {event, data, sender, sid};
			data = JSON.stringify(data);
			webSocket.send(data);
		};

		res(true);

		var installed = await chrome.storage.local.get('installed');
		installed = installed.installed || false;
		if (!installed) return;
		AIHandler.sayHello();
	};
	socket.onmessage = evt => {
		var msg = parseMsg(evt);
		if (msg.event === 'initial') {
			logger.info('WS', 'Initialized: ' + msg.data);
			return;
		}

		msg.sender = 'ServerEnd';
		dispatchEvent(msg);
	};
	socket.onerror = err => {
		logger.error("WS", "Error:", err);
	};
	socket.onclose = () => {
		logger.info("WS", "Close");
		if (socket === webSocket) webSocket = null;
		globalThis.sendMessage = DefaultSendMessage;
		res(false);
	};
});

const ServerHandler = {};

globalThis.callServer = (event, data, sender, sid) => new Promise(async (res, rej) => {
	var taskId = newID();
	while (!!ServerHandler[taskId]) {
		taskId = newID();
	}
	ServerHandler[taskId] = [res, rej];

	try {
		await sendMessage(event, {taskId, data}, sender || 'BackEnd', sid);
	}
	catch (err) {
		rej(err);
		delete ServerHandler[taskId];
	}
});
globalThis.getReplyFromServer = (taskId, data, error) => {
	var handler = ServerHandler[taskId];
	if (!handler) {
		logger.error('Server', 'No Handler for task ' + taskId);
		return;
	}

	if (!!error) {
		handler[1](error);
	}
	else {
		handler[0](data);
	}
};