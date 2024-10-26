import "./components/jsrsasign.all.min.js";
import "./script/i18n.js";
import "./script/ai/config.js";
import "./script/common.js";
import "./script/cachedDB.js";
import "./script/ai.js";

const UtilList = {
	notification: {
		js : ["/components/notification.js"],
		css: ["/components/notification.css", "/components/mention.css"],
	},
	panel: {
		js : ['/components/marked.min.js', '/pages/inner.js'],
		css: ["/components/panel.css"],
	},
};
const SimilarLimit = 20;

globalThis.myInfo = {
	inited: false,
	useLocalKV: true,
	apiKey: '',
	lang: DefaultLang,
	name: '主人',
	info: '(Not set yet)',
	model: ModelList[0],
	showTokenUsage: true,
};

/* Basic */

const updateAIModelList = () => {
	var available = false;
	ModelList.splice(0);

	for (let ai in myInfo.apiKey) {
		let key = myInfo.apiKey[ai];
		if (!key) continue;
		available = true;
		if (!!AI2Model[ai]) ModelList.push(...AI2Model[ai]);
	}
	myInfo.edgeAvailable = available;
};
globalThis.getWSConfig = async () => {
	var [localInfo, remoteInfo] = await Promise.all([
		chrome.storage.local.get(['wsHost', 'apiKey', 'AImodel']),
		chrome.storage.sync.get(['name', 'info', 'lang']),
	]);

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
	myInfo.useLocalKV = ForceServer ? false : !localInfo.wsHost;
	myInfo.model = localInfo.AImodel || myInfo.model || ModelList[0];
	updateAIModelList();
	logger.em('EXT', 'Config Loaded', myInfo);
	logger.em('EXT', myInfo);

	if (tasks.length > 0) await Promise.all(tasks);

	return localInfo.wsHost;
};
const callLLMOneByOne = async (modelList, conversation, needParse=true, tag="CallAI") => {
	var reply, usage = {};

	for (let model of modelList) {
		let time = Date.now();
		try {
			reply = await callAIandWait('directAskAI', {
				conversation,
				model,
			});
			if (!!reply) {
				usage = reply.usage || {};
				reply = reply.reply || '';
			}
			else {
				reply = '';
			}
		}
		catch (err) {
			reply = null;
			logger.error(tag + ': ' + model, err);
			continue;
		}
		time = Date.now() - time;
		logger.info(tag, model + ' : ' + time + 'ms');
		if (needParse) {
			reply = parseReplyAsXMLToJSON(reply);
		}
		break;
	}

	return {reply, usage};
};

/* DB */

const DBs = {};
const initDB = async () => {
	const dbPageInfos = new CachedDB("PageInfos", 1);
	dbPageInfos.onUpdate((evt) => {
		if (evt.oldVersion === 0) {
			dbPageInfos.open('tabInfo', 'tid');
			dbPageInfos.open('pageInfo', 'url');
			dbPageInfos.open('notifyChecker', 'url');
			dbPageInfos.open('pageConversation', 'url');
		}
		logger.info('DB[PageInfo]', 'Updated');
	});
	dbPageInfos.onConnect(() => {
		globalThis.dbPageInfos = dbPageInfos; // test
		logger.info('DB[PageInfo]', 'Connected');
	});

	await dbPageInfos.connect();
	DBs.pageInfo = dbPageInfos;

	const dbSearchRecord = new CachedDB("AISearchRecord", 1);
	dbSearchRecord.onUpdate((evt) => {
		if (evt.oldVersion === 0) {
			dbSearchRecord.open('searchRecord', 'quest');
		}
		logger.info('DB[SearchRecord]', 'Updated');
	});
	dbSearchRecord.onConnect(() => {
		globalThis.dbSearchRecord = dbSearchRecord; // test
		logger.info('DB[SearchRecord]', 'Connected');
	});

	await dbSearchRecord.connect();
	DBs.searchRecord = dbSearchRecord;
};
if (!globalThis.DefaultSendMessage) globalThis.DefaultSendMessage = () => {};
if (!globalThis.sendMessage) globalThis.sendMessage = DefaultSendMessage;

/* Management */

const gotoUniquePage = async (url) => {
	console.log('>>>>>>>>>>>>>>>>    1', url);
	var tab = await chrome.tabs.query({url});
	if (!!tab) tab = tab[0];
	console.log('>>>>>>>>>>>>>>>>    2', tab);
	if (!tab) {
		console.log('>>>>>>>>>>>>>>>>    3');
		tab = await chrome.tabs.create({url});
	}
	else {
		console.log('>>>>>>>>>>>>>>>>    4');
		await chrome.tabs.update(tab.id, {active: true, highlighted: true});
	}
	return tab;
};
const configureCyberButler = () => {
	gotoUniquePage(chrome.runtime.getURL(`pages/config.html`));
};
globalThis.checkAvailability = async () => {
	if (!myInfo.inited) {
		await getWSConfig();
	}

	var available = true;
	if (!!myInfo.useLocalKV) {
		available = myInfo.edgeAvailable;
	}
	else {
		let wsHost = await getWSConfig();
		available = !!wsHost;
	}

	if (!available) configureCyberButler();

	return available;
};
const showSystemNotification = (message) => {
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
	if (!isString(message)) {
		message = message.message || message.msg || message.data || message.toString();
	}
	chrome.notifications.create({
		title: messages.cypriteName,
		message,
		type: "basic",
		iconUrl: "/images/cyprite.png",
	});
};
chrome.runtime.onInstalled.addListener(async () => {
	const info = await chrome.storage.sync.get('lang');
	const lang = info.lang || DefaultLang;
	const messages = (I18NMessages[lang] || I18NMessages[DefaultLang]).contextMenus;

	// Register ContextMenus
	chrome.contextMenus.create({
		id: "launchCyprite",
		title: messages.launch,
		contexts: ["all"],
	});
	chrome.contextMenus.create({
		id: "translateSelection",
		title: messages.translate,
		contexts: ["selection"],
	});
	chrome.contextMenus.create({
		id: "autoWrite",
		title: messages.autoWrite,
		contexts: ["editable"],
		enabled: false,
	});

	// Refresh all Tabs
	const csList = chrome.runtime.getManifest().content_scripts;
	for (const cs of csList) {
		const tabs = await chrome.tabs.query({url: cs.matches});
		for (const tab of tabs) {
			if (tab.url.match(/^chrome/i)) {
				continue;
			}
			try {
				await chrome.scripting.executeScript({
					files: cs.js,
					target: {
						tabId: tab.id,
						allFrames: cs.all_frames
					},
					injectImmediately: cs.run_at === 'document_start',
					// world: cs.world, // uncomment if you use it in manifest.json in Chrome 111+
				});
			} catch {}
		}
	}
});
chrome.storage.local.onChanged.addListener(evt => {
	if (!!evt.AImodel?.newValue) {
		myInfo.model = evt.AImodel.newValue;
	}
});
chrome.storage.sync.onChanged.addListener(evt => {
	if (!!evt.lang?.newValue) {
		let lang = evt.lang.newValue || myInfo.lang;
		let messages = (I18NMessages[lang] || I18NMessages[DefaultLang]).contextMenus;

		// Update ContextMenus
		chrome.contextMenus.update("launchCyprite", {
			title: messages.launch,
		});
		chrome.contextMenus.update("translateSelection", {
			title: messages.translate,
		});
		chrome.contextMenus.update("autoWrite", {
			title: messages.autoWrite,
		});

	}
});

/* Page Manager */

const isPageForbidden = (url) => {
	if (!url) return true;
	if (url.indexOf('chrome://') === 0) return true;
	return false;
};
const onPageActivityChanged = async (tid, state) => {
	if (!tid) return;

	var info = await getTabInfo(tid);
	if (info.active) {
		if (state === 'show') return;
	}
	else {
		if (state === 'hide') return;
	}

	var tab;
	try {
		tab = await chrome.tabs.get(tid);
	}
	catch {
		tab = null;
	}
	if (!tab) {
		await delTabInfo(tid);
		if (state === 'close') {
			tab = {};
		}
		else {
			return;
		}
	}
	var { title, url, active } = tab;

	var now = Date.now();
	if (['open', 'show', 'active', 'update', 'loaded'].includes(state)) {
		if (!active) {
			await inactivePage(info, now);
		}
		else if (isPageForbidden(url)) {
			await inactivePage(info, now, true);
		}
		else {
			let shouldRequest = state === 'open';

			if (url !== info.url) {
				shouldRequest = true;
				await inactivePage(info, now, true);
			}

			if (!info.active || state === 'open') info.open = now;
			if (!info.title) info.title = title;
			info.active = true;
			info.url = url;

			if (shouldRequest && info.isArticle && !info.requested) {
				info.requested = true;
				dispatchEvent({
					event: "requestCypriteNotify",
					target: "FrontEnd",
					tid
				});
			}
			await setTabInfo(tid, info);
		}
	}
	else if (['hide', 'idle'].includes(state)) {
		await inactivePage(info, now);
	}
	else if (state === 'close') {
		await inactivePage(info, now, true);
		await delTabInfo(tid);
	}
};
const inactivePage = async (info, now, closed=false) => {
	var shouldCall = !!info.url;
	if (info.open > 0) info.duration += now - info.open;
	else shouldCall = false;
	info.open = -1;
	info.active = false;
	if (!shouldCall) {
		if (closed) info.duration = 0;
		return;
	}
	await onPageDurationUpdated(closed, info.url, info.duration, info.title);
	if (closed) info.duration = 0;
};
const onPageDurationUpdated = async (closed, url, duration, title) => {
	logger.log('PageActivity', 'Save Data: ' + url);

	// save info locally
	await savePageActivities(url, duration, title, closed);

	// save into to server
	try {
		sendMessage("SavePageActivity", {url, duration, title, closed}, "BackEnd");
	} catch {}
};
const savePageActivities = async (url, duration, title, closed) => {
	var info = await getPageInfo(url);

	info.reading = !closed;
	if (!info.title) info.title = title;
	info.viewed ++;
	info.totalDuration += duration;
	info.currentDuration = duration;
	info.timestamp = timestmp2str("YYYY/MM/DD hh:mm:ss :WDE:");
	console.log(info);

	await setPageInfo(url, info);
};

/* Infos */

const getPageInfo = async url => {
	if (url.match(/^chrome/i)) {
		return {
			totalDuration: 0,
			viewed: 0,
		}
	}

	url = parseURL(url);
	var info = TabInfo[url];
	if (!info) {
		if (!DBs.pageInfo) await initDB();
		info = await DBs.pageInfo.get('pageInfo', url);
		logger.log('DB[PageInfo]', 'Get Page Info: ' + url);
		if (!info) {
			info = {
				totalDuration: 0,
				viewed: 0,
			};
		}
	}
	return info;
};
const setPageInfo = async (url, info, immediately=false) => {
	if (url.match(/^chrome/i)) return;

	info.url = url;
	url = parseURL(url);
	if (!!DBs.tmrPageInfos) {
		clearTimeout(DBs.tmrPageInfos);
	}
	if (immediately) {
		delete DBs.tmrPageInfos;
		if (!DBs.pageInfo) await initDB();
		await DBs.pageInfo.set('pageInfo', url, info);
		logger.log('DB[PageInfo]', 'Set Page Info: ' + url);
	}
	else {
		DBs.tmrPageInfos = setTimeout(async () => {
			delete DBs.tmrPageInfos;
			if (!DBs.pageInfo) await initDB();
			await DBs.pageInfo.set('pageInfo', url, info);
			logger.log('DB[PageInfo]', 'Set Page Info: ' + url);
		}, 200);
	}
};
const delPageInfo = async (url, immediately=false) => {
	var key = parseURL(url);
	if (!!DBs.tmrPageInfos) {
		clearTimeout(DBs.tmrPageInfos);
	}
	if (immediately) {
		delete DBs.tmrPageInfos;
		delete TabInfo[key];
		if (!DBs.pageInfo) await initDB();
		await DBs.pageInfo.del('pageInfo', key);
		logger.log('DB[PageInfo]', 'Del Page Info: ' + key);
		return;
	}
	DBs.tmrPageInfos = setTimeout(async () => {
		delPageInfo(url, true);
	}, 200);
};
const getTabInfo = async tid => {
	var info = TabInfo[tid];
	if (!info) {
		if (!DBs.pageInfo) await initDB();
		if (!!DBs.pageInfo) {
			info = await DBs.pageInfo.get('tabInfo', 'T-' + tid);
			logger.log('DB[PageInfo]', 'Get TabInfo: ' + tid);
		}
		if (!info) {
			info = {
				active: false,
				duration: 0,
				open: -1,
			};
		}
	}
	return info;
};
const setTabInfo = async (tid, info) => {
	TabInfo[tid] = info;
	if (!!DBs.tmrTabInfos) {
		clearTimeout(DBs.tmrTabInfos);
	}
	DBs.tmrTabInfos = setTimeout(async () => {
		delete DBs.tmrTabInfos;
		if (!DBs.pageInfo) await initDB();
		await DBs.pageInfo.set('tabInfo', 'T-' + tid, info);
		logger.log('DB[PageInfo]', 'Set TabInfo: ' + tid);
	}, 200);
};
const delTabInfo = async (tid) => {
	delete TabInfo[tid];
	if (!!DBs.tmrTabInfos) {
		clearTimeout(DBs.tmrTabInfos);
		delete DBs.tmrTabInfos;
	}

	if (!DBs.pageInfo) await initDB();
	var allTabInfos = await DBs.pageInfo.all('tabInfo');
	for (let name in allTabInfos) {
		let tid = name.replace(/^T\-/, '');
		try {
			await chrome.tabs.get(tid * 1);
		}
		catch {
			await DBs.pageInfo.del('tabInfo', name);
			logger.log('DB[PageInfo]', 'Del TabInfo: ' + tid);
		}
	}
};
const TabInfo = {};

/* Tabs */

var LastActiveTab = null;
const TabPorts = new Map();
chrome.tabs.onActivated.addListener(tab => {
	LastActiveTab = tab.tabId;
	chrome.tabs.connect(LastActiveTab);
});
chrome.tabs.onRemoved.addListener(tabId => {
	if (LastActiveTab === tabId) LastActiveTab = null;
	onPageActivityChanged(tabId, "close");
	removeAIChatHistory(tabId);
	chrome.storage.session.remove(tabId + ':mode');
});
chrome.idle.onStateChanged.addListener((state) => {
	logger.info('Ext', 'Idle State Changed: ' + state);
	if (!LastActiveTab) return;
	if (state === 'idle') {
		onPageActivityChanged(LastActiveTab, "idle");
	}
	else {
		onPageActivityChanged(LastActiveTab, "active");
		chrome.tabs.connect(LastActiveTab);
	}
});
chrome.runtime.onMessage.addListener((msg, sender) => {
	if (msg.sender !== "PopupEnd") {
		let tid = sender.tab?.id;
		msg.sid = tid;
		if (msg.tid === 'me') msg.tid = tid;
	}
	dispatchEvent(msg);
});
chrome.runtime.onConnect.addListener(port => {
	if (port.name !== "cyberbutler_contentscript") return;
	var tid = port.sender?.tab?.id;
	if (!tid) return;
	logger.info('PORT', 'Connect: ' + tid);
	TabPorts.set(tid, port);
	port.onMessage.addListener(msg => {
		if (msg.sender !== "PopupEnd") {
			msg.sid = tid;
			if (msg.tid === 'me') msg.tid = tid;
		}
		dispatchEvent(msg);
	});
	port.onDisconnect.addListener(() => {
		logger.info('PORT', 'Disconnect: ' + tid);
		TabPorts.delete(tid);
	});
});
chrome.action.onClicked.addListener(async () => {
	var available = await checkAvailability();
	if (!available) return;

	var [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
	// Call Popup Cyprite
	if (isPageForbidden(tab?.url)) {
		await gotoUniquePage(chrome.runtime.getURL('/pages/newtab.html'));
	}
	// Call Page Cyprite
	else {
		let info = await getTabInfo(tab.id);
		info.requested = true;
		await setTabInfo(tab.id, info);
		dispatchEvent({
			event: "requestCypriteNotify",
			data: {forceShow: true},
			target: "FrontEnd",
			tid: tab.id
		});
	}
});
chrome.contextMenus.onClicked.addListener((evt, tab) => {
	// No action in Extension page.
	if (evt.pageUrl.indexOf('chrome') === 0 || evt.frameUrl.indexOf('chrome') === 0) {
		return;
	}
	dispatchEvent({
		event: "onContextMenuAction",
		data: {
			action: evt.menuItemId,
			text: evt.selectionText,
		},
		target: "FrontEnd",
		tid: tab.id,
	});
});

/* EventHandler */

var lastRequest = [];
const EventHandler = {};
globalThis.AIHandler = {};
globalThis.dispatchEvent = async (msg) => {
	msg.sender = msg.sender || 'BackEnd';

	// To Server via WebSocket
	if (msg.target === 'ServerEnd') {
		try {
			sendMessage(msg.event, msg.data, msg.sender, msg.sid);
		} catch {}
	}
	// To ContentScript and UserScript
	else if (msg.target === "FrontEnd" || msg.target === 'PageEnd') {
		let tid = msg.tid;
		if (!tid) {
			let [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
			if (!!tab) tid = tab.id;
		}
		if (!tid) tid = LastActiveTab;
		if (!tid) return;
		let port = TabPorts.get(tid);
		if (!port) return;
		try {
			await port.postMessage(msg);
		} catch {}
	}
	// To ServiceWorker itself
	else if (msg.target === 'BackEnd') {
		let handler = EventHandler[msg.event];
		if (!handler) return logger.log('SW', 'Got Event', msg);

		handler(msg.data, msg.sender, msg.sid, msg.target, msg.tid);
	}
	// To HomeScreen and ConfigPage
	else {
		let tid = msg.tid;
		if (!tid) return;
		try {
			await chrome.tabs.sendMessage(tid, msg);
		} catch {}
	}
};

EventHandler.gotServerReply = (data) => {
	if (data.ok) {
		getReplyFromServer(data.taskId, data.data);
	}
	else {
		getReplyFromServer(data.taskId, undefined, data.err);
	}
};
EventHandler.SetConfig = async (data, source, sid) => {
	if (source !== 'ConfigPage') return;
	logger.log('WS', 'Set Host: ' + data.wsHost);

	myInfo.name = data.name || '';
	myInfo.info = data.info || '';
	myInfo.lang = data.lang || DefaultLang;
	myInfo.apiKey = data.apiKey;
	myInfo.useLocalKV = true;
	updateAIModelList();

	if (myInfo.useLocalKV) {
		globalThis.sendMessage = DefaultSendMessage;
		chrome.tabs.sendMessage(sid, {
			event: "connectWSHost",
			data: {
				wsHost: data.wsHost,
				ok: true,
			},
			target: source,
			sender: 'BackEnd',
		});
		try {
			AIHandler.sayHello();
		}
		catch (err) {
			logger.error('AI:SayHello', err);
		}
		return;
	}

};
EventHandler.PageStateChanged = async (data, source, sid) => {
	if (source !== 'FrontEnd') return;
	logger.log('Page', 'State Changed: ' + data.state);

	var info = await getTabInfo(sid);
	if (!!data && !!data.pageInfo) {
		info.title = data.pageInfo.title || info.title;
		info.isArticle = isBoolean(data.pageInfo.isArticle) ? data.pageInfo.isArticle : info.isArticle;
		await setTabInfo(sid, info);
	}

	onPageActivityChanged(sid, data.state);
};
EventHandler.VisibilityChanged = (data, source, sid) => {
	if (source !== 'FrontEnd') return;
	onPageActivityChanged(sid, data);
};
EventHandler.MountUtil = async (util, source, sid) => {
	if (source !== 'FrontEnd') return;

	var utilFiles = UtilList[util];
	if (!!utilFiles) {
		let tasks = [];
		if (!!utilFiles.css) {
			tasks.push(chrome.scripting.insertCSS({
				target: { tabId: sid },
				files: utilFiles.css,
			}));
		}
		if (!!utilFiles.js) {
			tasks.push(chrome.scripting.executeScript({
				target: { tabId: sid },
				files: utilFiles.js,
				injectImmediately: true,
			}));
		}
		await Promise.all(tasks);
		logger.log('Page', 'Notification has mounted!');
	}

	dispatchEvent({
		event: "utilMounted",
		data: util,
		target: 'FrontEnd',
		tid: sid
	});
};
EventHandler.AskAIAndWait = async (data, source, sid) => {
	lastRequest[0] = source;
	lastRequest[1] = sid;

	var result = {id: data.id}, error = '';
	if (!!data.action) {
		let handler = AIHandler[data.action];
		try {
			let msg = await handler(data.data, source, sid);
			result.result = msg;
			logger.log('AI', 'Task ' + data.action + ' Finished');
		}
		catch (err) {
			result.result = '';
			error = err.message || err.msg || err.data || !!err.toString ? err.toString() : err;
			logger.error('AI', 'Task ' + data.action + ' Failed:');
			console.error(err);
			showSystemNotification(error);
		}
	}
	dispatchEvent({
		event: "replyAskAndWait",
		data: {
			ok: !error,
			data: result,
			error,
		},
		target: source,
		tid: sid
	});
};
EventHandler.AskSWAndWait = async (data, source, sid) => {
	lastRequest[0] = source;
	lastRequest[1] = sid;

	var result = {id: data.id}, error = '';
	if (!!data.action) {
		let handler = EventHandler[data.action];
		try {
			let msg = await handler(data.data, source, sid);
			result.result = msg;
			logger.log('SW', 'Task ' + data.action + ' Finished');
		}
		catch (err) {
			result.result = '';
			error = err.message || err.msg || err.data || !!err.toString ? err.toString() : err;
			logger.error('SW', 'Task ' + data.action + ' Failed:', error);
		}
	}
	dispatchEvent({
		event: "replyAskAndWait",
		data: {
			ok: !error,
			data: result,
			error,
		},
		target: source,
		tid: sid
	});
};
EventHandler.SavePageSummary = async (data, source, sid) => {
	var tabInfo = await getTabInfo(sid);
	var pageInfo = await getPageInfo(tabInfo.url);
	if (!pageInfo.title) pageInfo.title = data.title || pageInfo.title;
	if (!!data.content) pageInfo.content = data.content;
	pageInfo.description = data.summary || pageInfo.description;
	pageInfo.hash = data.hash || pageInfo.hash;
	pageInfo.embedding = data.embedding || pageInfo.embedding;
	pageInfo.category = data.category || [];
	pageInfo.keywords = data.keywords || [];

	await Promise.all([
		setTabInfo(sid, tabInfo),
		setPageInfo(tabInfo.url, pageInfo),
	]);
};
EventHandler.GotoConversationPage = async () => {
	var tab = await gotoUniquePage(chrome.runtime.getURL('/pages/newtab.html'));
	var info = {};
	info[tab.id + ':mode'] = 'crossPageConversation';
	await chrome.storage.session.set(info);
};

EventHandler.CalculateHash = async (data) => {
	// This function is not safe in browser.
	var content = data.content, algorithm;
	if (!content) {
		content = data;
	}
	else {
		algorithm = data.algorithm;
	}
	return calculateHash(content, algorithm);
};
EventHandler.CheckPageNeedAI = async (data) => {
	return await getPageNeedAIInfo(data);
};
EventHandler.UpdatePageNeedAIInfo = async (data) => {
	var info = await getPageNeedAIInfo(data);
	info.page.visited ++;
	info.path.visited ++;
	info.host.visited ++;
	if (data.need) {
		info.page.need ++;
		info.path.need ++;
		info.host.need ++;
	}
	await updatePageNeedAIInfo(data, info);
};
EventHandler.LoadPageSummary = async (data, source, sid) => {
	var tab = await chrome.tabs.get(sid);
	if (!!tab && !isPageForbidden(tab.url)) {
		return await getPageInfo(tab.url);
	}
	else {
		return null;
	}
};
EventHandler.FindSimilarArticle = async (data) => {
	var vector = data.vector, tabURL = parseURL(data.url || '');
	if (!vector) return [];

	if (!DBs.pageInfo) await initDB();
	var all = await DBs.pageInfo.all('pageInfo');
	var list = [];
	var l1 = [], l2 = [], l3 = [], l4 = [];
	for (let url in all) {
		if (url === tabURL) continue;
		let item = all[url];
		if (!item || !item.embedding) continue;
		if (data.needContent && !item.content) continue;

		let info = {};
		for (let key in item) {
			info[key] = item[key];
		}

		let similar = calculateSimilarityRate(info.embedding, vector);
		info.similar = similar;
		if (similar > 0) list.push(info);
	}
	logger.log('SIMI', data.url || '(NONE)');
	list = list.filter(f => f.similar >= 0.05);
	list.sort((a, b) => b.similar - a.similar);
	console.table(list.map(item => {
		return {
			title: item.title,
			similar: item.similar,
		}
	}));

	return list;
};
EventHandler.FindRelativeArticles = async (data, source, sid) => {
	data.url = parseURL(data.url || '');
	if (!data.url) return;

	var url = RelativeHandler[sid];
	if (url === data.url) {
		delete RelativeHandler[sid];
		return;
	}
	RelativeHandler[sid] = data.url;

	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
	var relatives, usage = {};

	data.isWebPage = false;
	dispatchEvent({
		event: "updateCurrentStatus",
		data: messages.crossPageConv.statusFindingSimilarFiles,
		target: source,
		tid: sid,
	});
	try {
		data.articles = await EventHandler.FindSimilarArticle(data);
		relatives = await findRelativeArticles(data, source, sid);
		updateUsage(usage, relatives.usage);
		relatives = relatives.relevants || [];
	}
	catch {
		relatives = [];
	}
	dispatchEvent({
		event: "updateCurrentStatus",
		target: source,
		tid: sid,
	});

	// Send to page
	dispatchEvent({
		event: "foundRelativeArticles",
		data: {relatives, usage},
		target: "FrontEnd",
		tid: sid,
	});

	// Cold Down
	await wait(ColdDownDuration);
	logger.log('SW', 'Cold Down finished for ' + data.url);

	delete RelativeHandler[sid];
};
EventHandler.GetConversation = async (url) => {
	url = parseURL(url);
	if (!DBs.pageInfo) await initDB();
	var conversation = await DBs.pageInfo.get('pageConversation', url);
	if (!conversation) return null;
	return conversation.conversation;
};
EventHandler.ClearSummaryConversation = async (url) => {
	url = parseURL(url);
	try {
		if (!DBs.pageInfo) await initDB();
		await DBs.pageInfo.del('pageConversation', url);
		return true;
	}
	catch {
		return false;
	}
};
EventHandler.GetArticleInfo = async (options) => {
	if (!DBs.pageInfo) await initDB();
	var list = await DBs.pageInfo.all('pageInfo');
	list = Object.keys(list).map(id => list[id]);

	var filterCondition = null, filterNoCache = false, orderType;
	if (isArray(options)) {
		let opt = options[0];
		orderType = options[1];
		if (opt === false) {
			filterNoCache = false;
		}
		else if (opt === true) {
			filterNoCache = true;
		}
		else if (isArray(opt)) {
			filterNoCache = true;
			filterCondition = opt;
		}
		else {
			filterNoCache = true;
		}
	}
	else if (!options) {
		filterNoCache = true;
	}

	if (filterNoCache) {
		list = list.filter(item => !!item.content && !!item.hash);
	}
	if (!!filterCondition) {
		list = list.filter(item => filterCondition.includes(item.url));
	}

	if (orderType === 'LastVisit') {
		list.forEach(item => {
			var timestamp = item.timestamp;
			if (!timestamp) {
				item._time = Date.now();
			}
			else {
				item._time = (new Date(timestamp.replace(/\s+[a-z]+$/i, ''))).getTime();
			}
		});
		list.sort((pa, pb) => pb._time - pa._time);
	}
	else {
		list.sort((pa, pb) => pb.totalDuration - pa.totalDuration);
	}
	return list;
};
AIHandler.getSearchKeyWord = async (request) => {
	var conversation = [], usage = {};
	conversation.push(['human', PromptLib.assemble(PromptLib.analyzeSearchKeyWords, {tasks: request, time: timestmp2str("YYYY/MM/DD hh:mm :WDE:")})]);

	var modelList = getFunctionalModelList('analyzeSearchKeywords');
	var keywords = (await callLLMOneByOne(modelList, conversation, true, 'SearchKeywords'));
	updateUsage(usage, keywords.usage);
	keywords = keywords.reply || {};
	['search', 'arxiv', 'wikipedia'].forEach(tag => {
		var list = keywords[tag] || '';
		list = list
			.replace(/[\n\r]+/g, '\n').split('\n')
			.map(ctx => ctx.replace(/^[\s\-]*|\s*$/gi, ''))
			.filter(ctx => !!ctx && !ctx.match(/^\s*\(?\s*(none|n\/a|null|nil)\s*\)?\s*$/i))
		;
		keywords[tag] = list;
	});
	logger.info('SearchKeywords', (keywords.search.length + keywords.arxiv.length + keywords.wikipedia.length) + ' / ' + keywords.search.length + ' / ' + keywords.arxiv.length + ' / ' + keywords.wikipedia.length);

	return {keywords, usage};
};
EventHandler.SearchGoogle = async (keywords) => {
	keywords = encodeURIComponent(keywords);

	var {key, cx} = (myInfo.apiKey?.google || {});
	var list;
	if (!!key && !!cx) {
		logger.log('GoogleSearch', 'Search By API');
		let url = `https://www.googleapis.com/customsearch/v1?key=${myInfo.apiKey.google.key}&cx=${myInfo.apiKey.google.cx}&q=${keywords}&num=10&sort=date-sdate:d:s`;
		try {
			let result = await waitUntil(fetchWithCheck(url));
			list = await result.json();
			if (!!list.error) {
				logger.error('GoogleSearch[' + list.error.code + ']', list.error.message);
				list = null;
			}
			else {
				logger.info('GoogleSearch', list);
				if (!!list.items) {
					list = list.items.map(item => {
						return {
							title: item.title,
							url: item.link,
							summary: (item.snippet || '').trim(),
						};
					});
				}
				else {
					list = null;
				}
			}
		}
		catch (err) {
			logger.error('GoogleSearch', err);
			list = null;
		}
	}
	if (!list) {
		logger.log('GoogleSearch', 'Search Via Crab');
		let url = `https://www.google.com/search?q=${keywords}&hl=en-US&start=0&num=10&ie=UTF-8&oe=UTF-8&gws_rd=ssl`;
		try {
			let result = await waitUntil(fetchWithCheck(url));
			result = await result.text();

			// Clear HTML
			result = result
				.replace(/<![^>]*?>/gi, '')
				.replace(/<(noscript|script|title|style|header|footer|head|ul|ol)[\w\W]*?>[\w\W]*?<\/\1>/gi, '')
				.replace(/<(meta|input|img)[\w\W]*?>/gi, '')
				.replace(/<[^\/\\]*?[\/\\]>/gi, '')
				.replace(/<\/?(html|body)[^>]*?>/gi, '')
				.replace(/<\/?span[^>]*?>/gi, '')
				.replace(/<\/?(div|br|hr)[^>]*?>/gi, '\n')
			;
			result = result.replace(/<a[^>]*href=('|")([^'"]*)\1[^>]*>([\w\W]*?)<\/a>/gi, (match, quote, url, inner) => {
				if (url.match(/^https?:\/\/.*?\.google/)) return '';
				if (url.match(/^\s*\//) && !url.match(/^\s*\/url\?/)) return '';
				return match;
			});
			while (true) {
				let temp = result.replace(/<([\w\-_]+)[^>]*?>[\s\r\t\n]*<\/\1>/gi, '');
				if (result === temp) break;
				result = temp;
			}
			result = result
				.replace(/^[\w\W]*?<a/i, '<a')
				.replace(/Related searches[\w\W]*?$/i, '')
				.replace(/[\s\r\t]*\n+[\s\r\t]*/g, '\n')
				.replace(/\n+/g, '\n')
			;

			// Find out Search Items
			let stops = [];
			result.replace(/<a[^>]*?>[\s\r\n]*/gi, (m, pos) => {
				stops.push(pos);
			});
			stops.push(result.length);
			for (let i = 0; i < stops.length - 1; i ++) {
				let a = stops[i], b = stops[i + 1];
				let sub = result.substring(a, b);
				let url = sub.match(/^[\s\r\n]*<a[^>]*?href=('|")?([^'"]*?)\1[^>]*?>/i);
				if (!url || !url[2]) continue;
				url = url[2];
				if (!url.match(/^(f|ht)tps?/)) continue;
				let params = parseParams(url);
				for (let key in params) {
					let value = params[key];
					if (value.match(/^https?/i)) {
						url = decodeURI(value);
						break;
					}
				}
				sub = sub
					.replace(/<h3[^>]*>/gi, '\n  Title: ')
					.replace(/<\/h3[^>]*>[\w\W]*?<\/a>/gi, '\n  Description: ')
					.replace(/<\/h3[^>]*>/gi, '\n  Description: ')
					.replace(/<\/?\w+[^>]*?>/gi, '')
					.replace(/[\s\r\t]*\n+[\s\r\t]*/g, '\n')
					.replace(/\n+/g, '\n')
					.replace(/^\n+|\n+$/g, '')
					.replace(/\n  Title:\s*\n\s*/gi, '\n  Title: ')
					.replace(/\n  Description:\s*\n\s*/gi, '\n  Description: ')
					.replace(/&#(\d+);/g, (match, code) => {
						var char;
						try {
							char = String.fromCharCode(code * 1);
						}
						catch {
							char = match;
						}
						return char;
					})
				;
				stops[i] = [url, sub];
			}
			stops = stops.filter(item => isArray(item));

			// Assemble result
			if (!stops.length) {
				list = [];
			}
			else {
				list = [];
				stops.forEach(item => {
					if (!item || !item[0]) return;
					var ctx = item[1] || '';
					ctx = ctx.split('\n');
					ctx = ctx.map(line => line.replace(/^\-\s*/, '\n  ')).join('\n  ');
					var lemma = { url: item[0] };
					ctx.replace(/Title:\s*([\w\W]*?)\s*Description:|Title:\s*([\w\W]*?)\s*$/i, (m, a, b) => {
						var t = a || b;
						if (!t) return;
						lemma.title = t;
					});
					ctx.replace(/Description:\s*([\w\W]*?)\s*Title:|Description:\s*([\w\W]*?)\s*$/i, (m, a, b) => {
						var t = a || b;
						if (!t) return;
						lemma.summary = t;
					});
					if (!lemma.title) lemma.title = item[1] || '';
					if (!lemma.summary) lemma.summary = item[1] || '';
					list.push(lemma);
				});
			}
		}
		catch (err) {
			logger.error('GoogleCrab', err);
			return [];
		}
	}

	return list;
};
AIHandler.callLLMForSearch = async (quest) => {
	var result, usage = {};
	for (let model of SearchAIModel) {
		if (!AI[model] || !AI[model].search) continue;

		let ai = model.toLowerCase();
		if (ai === 'ernie') {
			let key = myInfo.apiKey[ai];
			if (!key || !key.api || !key.secret) continue;
		}
		else {
			if (!myInfo.apiKey[ai]) continue;
		}

		let searchResult;
		try {
			searchResult = await AI[model].search(quest);
			if (!!searchResult) {
				if (!!searchResult.usage) {
					let usg = {};
					usg[searchResult.model] = searchResult.usage;
					usg[searchResult.ai] = searchResult.usage;
					updateUsage(usage, usg);
				}
				if (!!searchResult.reply && !!searchResult.reply.length) {
					result = searchResult.reply;
					break;
				}
			}
		}
		catch (err) {
			logger.error('LLMSearch[' + model + ']', err);
		}
	}
	result = result || [];

	return {
		result,
		usage
	};
};
EventHandler.ReadWebPage = async (url) => {
	var html;
	try {
		html = await waitUntil(fetch(url));
		html = await html.text();
	}
	catch {
		return null;
	}
	return html;
};
EventHandler.RemovePageInfo = async (url) => {
	await delPageInfo(url, true);
};
EventHandler.RemovePageInfos = async (isUncached) => {
	if (!DBs.pageInfo) await initDB();
	var list = await DBs.pageInfo.all('pageInfo');
	console.log(list);
	var targets = [];
	for (let key in list) {
		let item = list[key];
		if (isUncached) {
			if (!item.content) targets.push(key);
		}
		else {
			if (!item.hash || !item.embedding) targets.push(key);
		}
	}
	console.log(targets);
	await Promise.all(targets.map(async key => {
		await delPageInfo(key, true);
	}));
};
EventHandler.ChangePageTitle = async (data) => {
	var info = await getPageInfo(data.url);
	info.title = data.title;
	await setPageInfo(data.url, info, true);
};

EventHandler.SaveAISearchRecord = async (data) => {
	if (!DBs.searchRecord) await initDB();

	var {quest, record} = data;
	await DBs.searchRecord.set('searchRecord', quest, record);
	logger.log('DB[SearchRecord]', 'Save Search Record:', quest);
};
EventHandler.LoadAISearchRecordList = async (data) => {
	if (!DBs.searchRecord) await initDB();

	var all = await DBs.searchRecord.all('searchRecord');

	var list = [];
	for (let quest in all) {
		let info = all[quest];
		info.quest = info.quest || quest;
		info.timestamp = info.timestamp || 0;
		info.datestring = info.datestring || '(NONE)';
		list.push(info);
	}
	list.sort((a, b) => b.timestamp - a.timestamp);

	return list;
};
EventHandler.GetAISearchRecord = async (quest) => {
	if (!DBs.searchRecord) await initDB();

	return await DBs.searchRecord.get('searchRecord', quest);
};
EventHandler.DeleteAISearchRecord = async (quest) => {
	if (!DBs.searchRecord) await initDB();

	await DBs.searchRecord.del('searchRecord', quest);
};

/* AI */

const CacheLimit = 1000 * 60 * 60 * 12;
const removeAIChatHistory = async (tid) => {
	var list, tasks = [];

	if (!!tid) {
		list = Tab2Article[tid];
		if (!!list) {
			delete Tab2Article[tid];
			if (!DBs.pageInfo) await initDB();
			for (let url of list) {
				tasks.push(DBs.pageInfo.del('pageConversation', url));
			}
			if (!!tasks.length) {
				await Promise.all(tasks);
				logger.log('Chat', 'Remove Inside Tab History:', list);
			}
		}
	}

	tasks = [];
	const current = Date.now();
	if (!DBs.pageInfo) await initDB();
	list = await DBs.pageInfo.all('pageConversation');
	var removes = [];
	for (let url in list) {
		let item = list[url];
		if (current - item.timestamp >= CacheLimit) {
			removes.push(url);
			tasks.push(DBs.pageInfo.del('pageConversation', url));
		}
	}
	if (!!tasks.length) {
		await Promise.all(tasks);
		logger.log('Chat', 'Remove Expired History:', removes);
	}
};

AIHandler.sayHello = async () => {
	var currentDate = timestmp2str('YYYY/MM/DD');
	var lastHello = await chrome.storage.session.get('lastHello');
	lastHello = lastHello.lastHello;
	if (!!lastHello && lastHello === currentDate) return;
	chrome.storage.session.set({lastHello: currentDate});

	var reply = await callAIandWait('sayHello');
	reply = reply.reply; // test
	showSystemNotification(reply);
};
AIHandler.summarizeArticle = async (data) => {
	var available = await checkAvailability();
	if (!available) return;

	var summary, embedding;
	[summary, embedding] = await Promise.all([
		(async () => {
			var summary, usage;
			try {
				summary = (await callAIandWait('summarizeArticle', data.article)) || '';
				if (!summary) {
					return {
						summary: {
							summary: '',
							category: [],
							keywords: [],
						},
						usage: {}
					}
				}
				usage = summary.usage;
				summary = parseReplyAsXMLToJSON(summary.reply);
				summary.summary = summary.summary?._origin || summary.summary || summary._origin;
				summary.category = (summary.category || '')
					.replace(/\r/g, '').split('\n')
					.filter(line => !!line)
					.map(line => line.replace(/^\s*\-\s*/, ''))
					.join(',').split(/\s*[,;，；]\s*/)
				;
				summary.keywords = (summary.keywords || '')
					.replace(/\r/g, '').split('\n')
					.filter(line => !!line)
					.map(line => line.replace(/^\s*\-\s*/, ''))
					.join(',').split(/\s*[,;，；]\s*/)
				;
				return {summary, usage};
			}
			catch (err) {
				logger.error('SummarizeArticle', err);
				return {
					summary: {
						category: '',
						keywords: '',
						summary: '',
					},
					usage: {}
				};
			}
		}) (),
		(async () => {
			try {
				return await callAIandWait('embeddingArticle', data);
			}
			catch (err) {
				logger.error('EmbeddingArticle', err);
				return;
			}
		}) (),
	]);

	return {summary, embedding};
};
AIHandler.embeddingContent = async (data) => {
	var embedding = await callAIandWait('embeddingArticle', data);

	return embedding;
};
AIHandler.askArticle = async (data, source, sid) => {
	// Get conversation history prompts
	var list = Tab2Article[sid], url = parseURL(data.url);
	if (!list) {
		list = [];
		Tab2Article[sid] = list;
	}
	list = null;
	if (!DBs.pageInfo) await initDB();
	list = await DBs.pageInfo.get('pageConversation', url);
	if (!list) {
		list = [];
	}
	else {
		list = list.conversation;
	}

	// Update system prompt for relative articles
	var config = { lang: LangName[myInfo.lang] };
	// config.content = '<currentArticle title="' + data.title + '" url="' + data.url + '">\n' + data.content.trim() + '\n</currentArticle>';
	config.content = '<currentArticle>\n' + data.content.trim() + '\n</currentArticle>';
	if (!!data.related) {
		let articles = await Promise.all(data.related.map(async item => {
			var info = await getPageInfo(parseURL(item.url));
			if (!info) return null;
			return '<referenceMaterial title="' + (item.title || info.title) + '" url="' + info.url + '">\n' + info.description.trim() + '\n</referenceMaterial>';
		}))
		articles = articles.filter(info => !!info);
		config.related = articles.join('\n');
	}
	else {
		config.related = '(No Reference Material)';
	}
	var systemPrompt = PromptLib.assemble(PromptLib.askPageSystem, config);
	list = list.filter(item => item[0] !== 'system');
	list.unshift(['system', systemPrompt]);
	if (TrialVersion) {
		list.push(['human', data.question]);
	}
	else {
		let prompt = PromptLib.assemble(PromptLib.askPageTemplate, {
			question: data.question,
			time: timestmp2str("YYYY/MM/DD hh:mm :WDE:")
		});
		list.push(['human', prompt]);
	}
	console.log(list);

	var request = {
		conversation: [...list],
		model: myInfo.model,
	};
	var tokens = estimateTokenCount(request.conversation);
	if (tokens > AILongContextLimit) {
		request.model = PickLongContextModel();
	}
	var result = await callAIandWait('directAskAI', request), usage = {};
	if (!!result) {
		updateUsage(usage, result.usage);
		result = result.reply || result;
	}
	if (!TrialVersion) {
		list.pop();
		list.push(['human', data.question]);
	}
	list.push(['ai', result]);
	if (!DBs.pageInfo) await initDB();
	await DBs.pageInfo.set("pageConversation", url, {
		conversation: list,
		timestamp: Date.now()
	});
	result = parseReplyAsXMLToJSON(result);
	result = result.reply?._origin || result.reply || result._origin;

	removeAIChatHistory();
	return {reply: result, usage};
};
AIHandler.translateContent = async (data, source, sid) => {
	var available = await checkAvailability();
	if (!available) return '';

	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];

	// First Translation
	data.requirement = data.requirement || '(No Extra Requirement)';
	data.myLang = LangName[myInfo.lang] || myInfo.lang;
	var prompt = PromptLib.assemble(PromptLib.firstTranslation, data);
	var conversation = [['human', prompt]];
	var modelList = getFunctionalModelList('firstTranslation'), usage = {};
	var translation = await callLLMOneByOne(modelList, conversation, true, 'Translate[First]');
	if (!!translation) {
		updateUsage(usage, translation.usage);
		translation = translation.reply || translation;
		translation = translation.translation?._origin || translation.translation || translation._origin || translation;
	}
	logger.log('Translate[First]', translation);
	dispatchEvent({
		event: "updateCurrentStatus",
		data: messages.translation.afterFirstTranslate,
		target: source,
		tid: sid,
	});
	dispatchEvent({
		event: "finishFirstTranslation",
		data: translation,
		target: source,
		tid: sid,
	});

	// Analyze Inadequacies
	modelList = getFunctionalModelList('analysisTranslationInadequacies');
	data.translation = translation;
	prompt = PromptLib.assemble(PromptLib.reflectTranslation, data);
	conversation = [['human', prompt]];
	var suggestion = await callLLMOneByOne(modelList, conversation, true, 'Translate[Suggestion]');
	updateUsage(usage, suggestion.usage);
	if (!!suggestion) {
		if (!!suggestion.usage) {
			updateUsage(usage, suggestion.usage);
		}
		suggestion = suggestion.reply || suggestion;
	}
	logger.log('Translate[Suggestion]', suggestion);
	if ((suggestion.needOptimize || suggestion.needoptimize) && (!!suggestion.deficiencies || !!suggestion.suggestions)) {
		dispatchEvent({
			event: "updateCurrentStatus",
			data: messages.translation.afterReflect,
			target: source,
			tid: sid,
		});

		let sug = [];
		sug.push('#	Deficiencies');
		if (!!suggestion.deficiencies) {
			suggestion.deficiencies = suggestion.deficiencies?._origin || suggestion.deficiencies;
			sug.push(suggestion.deficiencies);
		}
		else {
			sug.push('(No deficiency be mentioned.)');
		}
		sug.push('#	Suggestions');
		if (!!suggestion.suggestions) {
			suggestion.suggestions = suggestion.suggestions?._origin || suggestion.suggestions;
			sug.push(suggestion.suggestions);
		}
		else {
			sug.push('(No suggestion be provided.)');
		}
		data.suggestions = sug.join('\n\n');

		// Final Translation
		prompt = PromptLib.assemble(PromptLib.deepTranslation, data);
		conversation = [['human', prompt]];
		translation = await callAIandWait('directAskAI', conversation);
		if (!!translation) {
			if (!!translation.usage) {
				updateUsage(usage, translation.usage);
			}
			translation = translation.reply || translation;
		}
		logger.log('Translate[Deep]', translation);
		dispatchEvent({
			event: "finishFirstTranslation",
			data: messages.translation.hintRetranslate,
			target: source,
			tid: sid,
		});
	}
	else {
		translation = '';
	}

	dispatchEvent({
		event: "updateCurrentStatus",
		data: '',
		target: source,
		tid: sid,
	});

	return {translation, usage};
};
AIHandler.translateSentence = async (data, source, sid) => {
	var available = await checkAvailability();
	if (!available) return;

	data.myLang = LangName[myInfo.lang] || myInfo.lang;

	var translation = await callAIandWait('translateSentence', data), usage = {};
	if (!!translation) {
		updateUsage(usage, translation.usage);
	}
	var json = parseReplyAsXMLToJSON(translation.reply);
	logger.log('Translate', json);
	translation = json.translation?._origin || json.translation || translation.reply || '';

	return {translation, usage};
};
AIHandler.selectArticlesAboutConversation = async (data, source, sid) => {
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];

	var limit = SimilarLimit, usage = {};
	if (isObject(data)) {
		limit = data.limit || limit;
		data = data.request;
	}

	// Get embedding vector
	dispatchEvent({
		event: "updateCurrentStatus",
		data: messages.crossPageConv.statusAnalyzeRequest,
		target: source,
		tid: sid,
	});
	var similarArticles;
	try {
		let requestVector = await AIHandler.embeddingContent({article: data});

		// Find Similar articles
		dispatchEvent({
			event: "updateCurrentStatus",
			data: messages.crossPageConv.statusFindingSimilarFiles,
			target: source,
			tid: sid,
		});
		similarArticles = await EventHandler.FindSimilarArticle({vector: requestVector, needContent: true});
	}
	catch {
		if (!DBs.pageInfo) await initDB();
		let list = await DBs.pageInfo.all('pageInfo');
		list = Object.keys(list).map(id => list[id]);
		list = list.filter(item => !!item.content && !!item.hash);
		list.forEach(item => item._time = (new Date(item.timestamp.replace(/\s+[a-z]+$/i, ''))).getTime());
		list.sort((pa, pb) => pb._time - pa._time);
		similarArticles = list;
	}

	// Find Related articles
	var relatedArticles;
	try {
		relatedArticles = await findRelativeArticles({
			articles: similarArticles,
			requests: [data],
			isWebPage: true,
			limit,
		}, source, sid);
		updateUsage(usage, relatedArticles.usage);
		relatedArticles = relatedArticles.relevants || [];
	}
	catch {
		relatedArticles = [];
	}

	dispatchEvent({
		event: "updateCurrentStatus",
		target: source,
		tid: sid,
	});

	return {articles: relatedArticles, usage};
};
AIHandler.directSendToAI = async (conversation) => {
	return await callAIandWait('directAskAI', conversation);
};
AIHandler.findRelativeWebPages = async (data, source, sid) => {
	data.isWebPage = true;
	return await findRelativeArticles(data, source, sid);
};
AIHandler.replyBasedOnSearch = async (data) => {
	logger.info('ReplyBasedOnSearch', 'Start');
	data.webpages = data.webpages.map(item => {
		var article = ['<webpage>'];
		article.push('<title>' + item.title + '</title>');
		article.push('<url>' + item.url + '</title>');
		if (!!item.summary) {
			article.push('<summary>');
			article.push(item.summary);
			article.push('</summary>');
		}
		article.push('</webpage>');
		return article.join('\n');
	}).join('\n\n');

	var prompt = PromptLib.assemble(PromptLib.replyBasedOnSearch, {
		lang: LangName[myInfo.lang] || myInfo.lang,
		request: data.request,
	});
	// For hyper-long string
	var start = prompt.indexOf('{{webpages}}'), end = start + ('{{webpages}}').length;
	var bra = prompt.substring(0, start), ket = prompt.substring(end);
	prompt = bra + data.webpages + ket;

	var conversation = [['human', prompt]];
	logger.info('ReplyBasedOnSearch', 'Prompt Assembled', conversation);

	var request = {
		conversation,
		model: myInfo.model,
	};
	var tokens = estimateTokenCount(request.conversation);
	if (tokens > AILongContextLimit) {
		request.model = PickLongContextModel();
	}
	var result = await callAIandWait('directAskAI', request), usage = {};
	if (!!result) {
		updateUsage(usage, result.usage);
		result = result.reply || result;
	}
	result = parseReplyAsXMLToJSON(result);
	result.reply = result.reply?._origin || result.reply || result._origin;
	result.more = (result.more?._origin || result.more || '').replace(/[\n\r]+/g, '\n')
		.split('\n')
		.map(line => line.replace(/(^\s*([\-\+\*]\s+)*|\s*$)/g, ''))
		.filter(line => !!line)
	;
	logger.info('ReplyBasedOnSearch', 'Got Reply:', result);

	return {reply: result, usage};
};
AIHandler.raedAndReply = async (data) => {
	logger.info('SummaryAndReply', 'Start');

	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
	var prompt = PromptLib.assemble(PromptLib.replyRequestBasedOnArticle, {
		lang: myInfo.lang,
		request: data.request,
	});
	// For hyper-long string
	var start = prompt.indexOf('{{content}}'), end = start + ('{{content}}').length;
	var bra = prompt.substring(0, start), ket = prompt.substring(end);
	prompt = bra + data.content + ket;

	prompt = [['human', prompt]];
	logger.info('SummaryAndReply', 'Prompt Assembled');

	var request = {
		conversation: prompt,
		model: myInfo.model,
	};
	var tokens = estimateTokenCount(prompt);
	if (tokens > AILongContextLimit) {
		request.model = PickLongContextModel();
	}
	var result = await callAIandWait('directAskAI', request), usage = {};
	if (!!result) {
		updateUsage(usage, result.usage);
		result = result.reply || result;
	}
	let parsed = parseReplyAsXMLToJSON(result);
	parsed.summary = parsed.summary?._origin || parsed.summary || '';
	parsed.reply = parsed.reply?._origin || parsed.reply || result;
	logger.info('SummaryAndReply', 'Got Reply');
	console.log(parsed);
	if (!parsed.relevant) {
		result = '';
	}
	else {
		if (!!parsed.reply) {
			let list = [];
			if (!!parsed.summary) {
				list.push('## ' + messages.aiSearch.hintPageSummary + '\n\n' + parsed.summary.trim());
			}
			list.push('## ' + messages.aiSearch.hintPageReply + '\n\n' + parsed.reply.trim());
			result = list.join('\n\n');
		}
	}

	return {reply: result, usage};
};
AIHandler.preliminaryThinking = async (data, source, sid) => {
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
	const options = {
		lang: LangName[myInfo.lang] || myInfo.lang,
		request: data.request,
		time: timestmp2str("YYYY/MM/DD hh:mm :WDE:")
	};

	var prompt = PromptLib.assemble(PromptLib.preliminaryThinking, options);
	var conversation = [['human', prompt]];
	logger.info('PreliminaryThinking', 'Prompt Assembled', [...conversation]);
	var result, usage = {};
	try {
		result = await callAIandWait('directAskAI', conversation);
		if (!!result) {
			updateUsage(usage, result.usage);
			result = result.reply || result;
		}
		logger.info('PreliminaryThinking', 'Got Reply:\n', result);
	}
	catch (err) {
		logger.error('PreliminaryThinking', err);
		result = messages.aiSearch.msgPreliminaryThinkingFailed;
	}

	return {reply: result, usage};
};

/* Utils */

const Tab2Article = {}, RelativeHandler = {};
const ColdDownDuration = 5 * 60 * 1000;
const WaitDuration = 5 * 1000;
const RelativeArticleRange = 40;
globalThis.waitUntil = fun => new Promise((res, rej) => {
	var [source, sid] = lastRequest;

	const untiler = setInterval(() => {
		logger.log('Ext', 'Reactive and waiting...');
		LastActiveTab
		dispatchEvent({
			event: "requestHeartBeating",
			target: source,
			tid: sid
		});
		dispatchEvent({
			event: "requestHeartBeating",
			target: 'FrontEnd',
			tid: LastActiveTab
		});
		dispatchEvent({
			event: "requestHeartBeating",
			target: 'HomeScreen',
			tid: LastActiveTab
		});
	}, WaitDuration);

	if (isFunction(fun)) {
		if (isAsyncFunction(fun)) {
			fun()
			.then(result => {
				res(result);
			})
			.catch(err => {
				rej(err);
			})
			.finally(() => {
				clearInterval(untiler);
			});
		}
		else {
			clearInterval(untiler);
			try {
				let result = fun();
				res(result);
			}
			catch (err) {
				rej(err);
			}
		}
	}
	else {
		fun
		.then(result => {
			res(result);
		})
		.catch(err => {
			rej(err);
		})
		.finally(() => {
			clearInterval(untiler);
		});
	}
});
globalThis.fetchWithCheck = (url, requests, baseUrl, timeout) => new Promise((res, rej) => {
	timeout = timeout || 5 * 1000;
	if (!baseUrl) {
		baseUrl = url.match(/\w+:\/+[^\/]+\//);
		if (!baseUrl) baseUrl = url;
		else baseUrl = baseUrl[0];
	}

	var done = false;
	fetch(url, requests).then(result => {
		if (done) return;
		done = true;
		clearTimeout(timer);
		res(result);
	}).catch(err => {
		if (done) return;
		done = true;
		clearTimeout(timer);
		rej(err);
	});
	fetch(baseUrl).then(() => {
		if (done) return;
		clearTimeout(timer);
	}).catch((err) => {
		if (done) return;
		done = true;
		clearTimeout(timer);
		rej(err);
	});
	var timer = setTimeout(() => {
		if (done) return;
		done = true;
		rej(new Error('Check Connection Timeout: ' + baseUrl));
	}, timeout);
});
const getPageNeedAIInfo = async data => {
	if (!DBs.pageInfo) await initDB();
	var info = await Promise.all([
		DBs.pageInfo.get('notifyChecker', data.page),
		DBs.pageInfo.get('notifyChecker', data.path),
		DBs.pageInfo.get('notifyChecker', data.host),
	]);
	info = {
		page: info[0],
		path: info[1],
		host: info[2],
	};
	if (!info.page) info.page = {need: 0, visited: 0};
	if (!info.path) info.path = {need: 0, visited: 0};
	if (!info.host) info.host = {need: 0, visited: 0};
	return info;
};
const updatePageNeedAIInfo = async (data, info) => {
	if (!DBs.pageInfo) await initDB();
	await Promise.all([
		DBs.pageInfo.set('notifyChecker', data.page, info.page),
		DBs.pageInfo.set('notifyChecker', data.path, info.path),
		DBs.pageInfo.set('notifyChecker', data.host, info.host),
	]);
};
const manhattanOfVectors = (v1, v2) => {
	var len = Math.min(v1.length, v2.length);
	var total = 0;
	for (let i = 0; i < len; i ++) {
		total = Math.max(total, Math.abs(v1[i] - v2[i]));
	}
	return total;
};
const innerProductOfVectors = (v1, v2) => {
	var len = Math.min(v1.length, v2.length);
	var total = 0;
	for (let i = 0; i < len; i ++) {
		total += v1[i] * v2[i];
	}
	return total;
};
const calculateSimilarityRate = (g1, g2) => {
	if (!g1 || !g2) return 0;

	var max1 = 0, max2 = 0, totalW2 = 0;
	g1.forEach(v => {
		if (v.weight > max1) max1 = v.weight;
	});
	g2.forEach(v => {
		if (v.weight > max2) max2 = v.weight;
		totalW2 += v.weight ** 2;
	});
	totalW2 /= max2;

	var similarity = 0;
	var nearest = [];
	// Find the vector in G1 that is closest to each vector in G2
	g2.forEach(v2 => {
		var w2 = v2.weight;
		v2 = v2.vector;

		var most = 0, target = -1;
		g1.forEach((v1, idx) => {
			v1 = v1.vector;

			var prod = innerProductOfVectors(v1, v2);
			if (prod > most) {
				target = idx;
				most = prod;
			}
		});
		if (target < 0) return;
		var list = nearest[target];
		if (!list) {
			list = [];
			nearest[target] = list;
		}
		list.push([w2, most]);
	});
	max1 = 0;
	nearest.forEach((list, idx) => {
		if (!list) return;
		var w1 = g1[idx].weight;
		if (w1 > max1) max1 = w1;
		var simi = 0;
		list.forEach(value => {
			simi += w1 * value[0] * value[1];
		});
		similarity += (simi / max1 / totalW2);
	});

	return similarity;
};
const initInjectScript = async () => {
	const USID = "CypriteInjection";

	var scripts = await chrome.userScripts.getScripts({ids: [USID]});
	if (scripts.length > 0) return;

	chrome.userScripts.configureWorld({ messaging: true });

	await chrome.userScripts.register([{
		id: USID,
		matches: ['*://*/*'],
		js: [{file: 'inject.js'}],
		world: "MAIN",
	}]);
};
const decomposePackage = (pack, size=20) => {
	pack = [...pack]; // Duplicate
	var count = Math.floor(pack.length / size);
	if (count === 0) return [pack];
	var result = [];
	for (let i = 0; i < count; i ++) {
		let s = Math.round(pack.length / (count - i));
		let p = pack.splice(0, s);
		result.push(p);
	}
	return result;
};
const getIrrelevants = async (modelList, pack, request, isWebPage, summary) => {
	var irrelevantList = [], relevantList = [], prompt = isWebPage ? PromptLib.excludeIrrelevantsOnTopic : PromptLib.excludeIrrelevantsOnArticle, config = {content: request}, usage = {};
	if (!isWebPage) config.summary = summary;

	await Promise.all(pack.map(async articles => {
		config.list = articles.map(item => {
			return '- [' + item.title + '](' + item.url + ')';
		}).join('\n');
		let conversation = [['human', PromptLib.assemble(prompt, config)]], irrelevants;
		irrelevants = await callLLMOneByOne(modelList, conversation, true, 'ExcludeIrrelevants');
		updateUsage(usage, irrelevants.usage);
		irrelevants = irrelevants.reply || {};
		['unrelated', 'related'].forEach(key => {
			var ctx = irrelevants[key] || '';
			if (!ctx.replace) ctx = '';
			var list = [];
			ctx.replace(/[\r\n]+/g, '\n').split(/\n+/).forEach(line => {
				line = line.replace(/^\s*\-\s+/i, '').trim();
				var match = line.match(/\(\s*(https?:[^\[\] ]+[^\\\[\] ])(\\\\)*\)/);
				if (!!match) {
					line = match[1];
				}
				else {
					match = line.match(/https?:[^\[\] ]+/);
					if (!!match) {
						line = match[0];
					}
					else {
						return;
					}
				}
				list.push(line);
			});
			irrelevants[key] = list;
		});
		irrelevants.unrelated.forEach(url => {
			irrelevantList.push(url);
		});
		irrelevants.related.forEach(url => {
			relevantList.push(url);
		});
	}));
	return [irrelevantList, relevantList, usage];
};
const getRelevants = async (model, pack, request, isWebPage, summary) => {
	var relevantList = [], prompt = isWebPage ? PromptLib.filterRelevantsOnTopic : PromptLib.filterRelevantsOnArticle, config = {content: request};
	var usage = {};
	if (!isWebPage) config.summary = summary;

	await Promise.all(pack.map(async articles => {
		config.list = articles.map(item => {
			var ctx = '<webpage>\n<title>' + item.title + '</title>\n<url>' + item.url + '</url>';
			if (!!item.description || !!item.summary) {
				ctx = ctx + '\n<summary>\n' + (item.description || item.summary) + '\n</summary>';
			}
			ctx = ctx + '\n</webpage>'
			return ctx;
		}).join('\n');
		let conversation = [['human', PromptLib.assemble(prompt, config)]], relevants;
		relevants = await callAIandWait('directAskAI', {
			conversation,
			model,
		});
		if (!!relevants) {
			if (!!relevants.usage) {
				updateUsage(usage, relevants.usage);
			}
			relevants = relevants.reply || relevants;
		}

		let urls = ('\n' + relevants + '\n').match(/[\-\+]\s+[^\n\r]+?[\n\r]/ig);
		if (!!urls) urls.forEach(url => {
			url = url.replace(/[\-\+]\s+/i, '').trim();
			if (url.match(/^\[[^\n\r]+?\]\(/)) url = url.replace(/^\[[^\n\r]+?\]\(/, '').replace(/\)$/, '').trim();
			if (relevantList.includes(url)) return;
			relevantList.push(url);
		});
	}));
	return {list: relevantList, usage};
};
const findRelativeArticles = async (data, source, sid) => {
	if (!myInfo.inited) {
		await getWSConfig();
	}
	var available = await checkAvailability();
	if (!available) {
		return {relevants: [], usage: {}};
	}

	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
	const isWebPage = isBoolean(data.isWebPage) ? data.isWebPage : true;
	const request = (data.requests || []).join('\n\n') || '(NONE)';
	const currentSummary = (data.content || []).map(ctx => '<summary>\n' + ctx.trim() + '\n</summary>').join('\n\n') || '(NONE)';

	logger.log('SW', data.articles.length + ' Similar Articles for ' + (data.url || '(NONE)'));

	// Exclude Irrelevants
	dispatchEvent({
		event: "updateCurrentStatus",
		data: messages.crossPageConv.hintExcludeIrrelevants,
		target: source,
		tid: sid,
	});
	var modelList = getFunctionalModelList('excludeIrrelevants');
	var articles = [...data.articles], loop = 0, irrelevantList = [];
	var usage = {};
	var time = Date.now();
	while (true) {
		loop ++;
		let pack = decomposePackage(articles, 70), irrelevants, relevants;
		// Attempt the models in the modelList one by one, and try the next model if an error occurs, until all models have been tried
		try {
			let result = await getIrrelevants(modelList, pack, request, isWebPage, currentSummary);
			irrelevants = result[0];
			relevants = result[1];
			updateUsage(usage, result[2]);
		}
		catch (err) {
			irrelevants = [];
			relevants = [];
			console.error(err);
		}
		logger.info('Filter Irrelevants', 'Excludes(' + loop + '): ' + irrelevants.length + ' / ' + relevants.length);
		irrelevants.forEach(i => {
			if (!irrelevantList.includes(i)) irrelevantList.push(i);
		});
		articles = articles.filter(item => !irrelevants.includes(item.url));
		articles = articles.filter(item => !relevants.includes(item.url));
		// Termination conditions
		if (loop >= 3 || articles.length <= 20 || irrelevants.length + relevants.length <= 7) break;
	}
	time = Date.now() - time;
	logger.info('Exclude Irrelevants', time + 'ms, ' + irrelevantList.length);
	articles = data.articles.filter(item => !irrelevantList.includes(item.url));

	var limit = data.limit || RelativeArticleRange;
	if (articles.length > limit) articles.splice(limit);
	data.articles= [...articles];
	console.log(articles.map(i => '-\t' + i.title + ' : ' + i.url).join('\n'));

	// AI find the relative articles
	dispatchEvent({
		event: "updateCurrentStatus",
		data: messages.crossPageConv.statusFindingRelatedFiles,
		target: source,
		tid: sid,
	});
	modelList = getFunctionalModelList('identityRelevants');
	var model = modelList[0];
	var idx = 0;
	loop = 0;
	var relevants = [], error;
	time = Date.now();
	while (true) {
		loop ++;
		let packages = decomposePackage(articles, 5), list;
		while (true) {
			logger.log('Identify Relevants', 'Curent Model: ' + model);
			try {
				list = await getRelevants(model, packages, request, isWebPage, currentSummary);
				if (!!list) {
					if (!!list.usage) {
						updateUsage(usage, list.usage);
					}
					list = list.list;
					if (!!list) break;
				}
			}
			catch (err) {
				logger.error('Identify Relevants', err);
				list = [];
				idx ++;
				if (idx >= modelList.length) {
					error = err;
					break;
				}
				model = modelList[idx];
			}
		}
		logger.info('Identify Relevants', 'Filter(' + loop + '): ' + list.length);
		if (!!error) {
			showSystemNotification(error);
			break;
		}
		list.forEach(url => {
			relevants.push(parseURL(url));
		});
		articles = articles.filter(item => !list.includes(item.url));

		if (loop >= 2 || list.length <= 2 || articles.length <= 3) {
			break;
		}
	}
	time = Date.now() - time;
	logger.info('Identify Relevants', model + ' : ' + time + 'ms, ' + relevants.length);

	if (isWebPage) {
		let list = [];
		relevants.forEach(url => {
			data.articles.some(item => {
				if (item.url !== url) return;
				list.push(item);
				return true;
			});
		});
		relevants = list;
	}
	else {
		// Get Info
		relevants = await Promise.all(relevants.map(async (url) => {
			var item = await getPageInfo(url);
			if (!item || !item.hash || item.hash === data.hash) return null;

			var info = {};
			for (let key in item) {
				info[key] = item[key];
			}
			info.similar = 100;

			return info;
		}));
		relevants = relevants.filter(item => !!item);
	}
	console.log(relevants.map(item => '-\t' + item.title + ' : ' + item.url).join('\n'));
	dispatchEvent({
		event: "updateCurrentStatus",
		target: source,
		tid: sid,
	});

	return {relevants, usage};
};
const parseParams = param => {
	var json = {};
	param = (param || '').split('?');
	param.shift();
	param = (param || '').join('?').split('&');
	param.forEach(item => {
		item = item.split('=');
		var key = item.shift();
		if (!key) return;
		item = item.join('=');
		json[key] = item;
	});
	return json;
};

/* Init */

initDB();
// initInjectScript();

/* ------------ */

EventHandler.notify = (data, source, sid) => {
	var sourceName = 'Server';
	if (source === "BackEnd") sourceName = 'Background';
	else if (source === "FrontEnd") sourceName = 'Content';
	else if (source === "PageEnd") sourceName = 'Injection';
	if (!isString(data) && !isNumber(data) && !isBoolean(data)) data = JSON.stringify(data);
	logger.log(`Notify | ${sourceName}`, data);
};