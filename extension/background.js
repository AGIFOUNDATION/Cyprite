import "./components/jsrsasign.all.min.js";
import "./script/i18n.js";
import "./script/ai/config.js";
import "./script/ai/common.js";
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

const RelatedLimit = 20;

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
	var tab = await chrome.tabs.query({url});
	if (!!tab) tab = tab[0];
	if (!tab) {
		tab = await chrome.tabs.create({url});
	}
	else {
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
	logger.log('SavePageActivities', info);

	await setPageInfo(url, info);
};

/* Infos */

const convertPageInfoToRecord = (info, old) => {
	old = old || {};
	var item = old;
	item.title = info.title || old.title;
	item.url = info.url || old.url;
	item.hasContent = !!info.content || !!info.hasContent || !!item.content || !!item.hasContent;
	item.isLocal = !!info.isLocal;
	item.isCached = !!info.url && (!!info.isLocal || !!item.hasContent);
	item.duration = info.totalDuration || old.totalDuration || 0;
	if (!info.timestamp) {
		item.lastVisit = Date.now();
	}
	else {
		item.lastVisit = (new Date(info.timestamp.replace(/\s+[a-z]+$/i, ''))).getTime();
	}
	if (!!info.keywords) {
		item.keywords = info.keywords || old.keywords;
	}
	if (!!info.category) {
		item.category = info.category || old.category;
	}
	return item;
};
const getPageInfo = async url => {
	if (url.match(/^chrome/i)) {
		return {
			totalDuration: 0,
			viewed: 0,
		}
	}

	url = parseURL(url);
	if (!DBs.pageInfo) await initDB();
	var info = await DBs.pageInfo.get('pageInfo', url);
	logger.log('DB[PageInfo]', 'Get Page Info: ' + url);
	if (!info) {
		info = {
			totalDuration: 0,
			viewed: 0,
		};
	}
	return info;
};
const setPageInfo = async (url, info, immediately=false) => {
	if (url.match(/^chrome/i)) return;

	if (!!DBs.tmrPageInfos) {
		clearTimeout(DBs.tmrPageInfos);
	}

	info.url = url;
	var key = parseURL(url);
	if (!DBs.pageInfo) await initDB();
	var dbData = await DBs.pageInfo.get('pageInfo', key);
	if (!dbData) dbData = {};
	const keywords = {add: [], remove: []};
	const category = {add: [], remove: []};
	for (let key in info) {
		let value = info[key];
		if (value === null || value === undefined) continue;
		if (key === 'keywords') {
			if (!isArray(value)) continue;
			let latest = (dbData.keywords || []);
			value.forEach(item => {
				if (latest.includes(item)) return;
				keywords.add.push(item);
			});
			latest.forEach(item => {
				if (value.includes(item)) return;
				keywords.remove.push(item);
			});
		}
		if (key === 'category') {
			if (!isArray(value)) continue;
			let latest = (dbData.category || []);
			value.forEach(item => {
				if (latest.includes(item)) return;
				category.add.push(item);
			});
			latest.forEach(item => {
				if (value.includes(item)) return;
				category.remove.push(item);
			});
		}
		dbData[key] = value;
	}
	info = Object.assign({}, dbData);

	const data = (await chrome.storage.local.get([TagArticleList, TagKeywordList, TagCategoryList])) || {};
	const record = {};

	// Update Article List Cache
	var list = data[TagArticleList] || [];
	var notHas = true;
	list.some(item => {
		if (parseURL(item.url) !== key) return;
		convertPageInfoToRecord(info, item);
		if (!!dbData.content) item.isCached = true;
		notHas = false;
		return true;
	});
	if (notHas) {
		let item = convertPageInfoToRecord(info);
		if (!!dbData.content) item.isCached = true;
		list.push(item);
	}
	record[TagArticleList] = list;

	// Update Keywords and Category
	if (keywords.add.length + keywords.remove.length) {
		list = data[TagKeywordList] || {};
		keywords.add.forEach(item => {
			list[item] ++;
		});
		keywords.remove.forEach(item => {
			list[item] --;
		});
		record[TagKeywordList] = list;
	}
	if (category.add.length + category.remove.length) {
		list = data[TagCategoryList] || {};
		category.add.forEach(item => {
			list[item] ++;
		});
		category.remove.forEach(item => {
			list[item] --;
		});
		record[TagCategoryList] = list;
	}

	// Update DB
	if (immediately) {
		chrome.storage.local.set(record);

		delete DBs.tmrPageInfos;
		if (!DBs.pageInfo) await initDB();
		await DBs.pageInfo.set('pageInfo', key, dbData);
		logger.log('DB[PageInfo]', 'Set Page Info: ' + url);
	}
	else {
		await chrome.storage.local.set(record);

		DBs.tmrPageInfos = setTimeout(async () => {
			delete DBs.tmrPageInfos;
			if (!DBs.pageInfo) await initDB();

			if (!DBs.pageInfo) await initDB();
			var dbData = await DBs.pageInfo.get('pageInfo', key);
			if (!dbData) dbData = {};
			for (let key in info) {
				let value = info[key];
				if (value === null || value === undefined) continue;
				dbData[key] = value;
			}

			await DBs.pageInfo.set('pageInfo', key, dbData);
			logger.log('DB[PageInfo]', 'Set Page Info: ' + url);
		}, 200);
	}
};
const delPageInfo = async (urlList, immediately=false) => {
	if (isString(urlList)) urlList = [urlList];
	else if (!isArray(urlList)) return;

	if (!!DBs.tmrPageInfos) {
		clearTimeout(DBs.tmrPageInfos);
	}

	if (!DBs.pageInfo) await initDB();
	const keyList = urlList.map(url => parseURL(url));
	const keywords = [];
	const category = [];
	const tasks = [];
	tasks.push(chrome.storage.local.get([TagArticleList, TagKeywordList, TagCategoryList]));
	tasks.push(...(keyList.map(async url => {
		var item = await DBs.pageInfo.get('pageInfo', url);
		if (!item) return;
		if (isArray(item.keywords)) {
			keywords.push(...item.keywords);
		}
		if (isArray(item.category)) {
			category.push(...item.category);
		}
	})));
	const data = (await Promise.all(tasks))[0] || {};
	const record = {};

	// Update Article List Cache
	var list = data[TagArticleList] || [];
	var has = false;
	list = list.filter(item => {
		if (!!item.url && !keyList.includes(parseURL(item.url))) return true;
		has = true;
		return false;
	});
	if (has) {
		record[TagArticleList] = list;
	}

	// Update Keywords and Category
	if (keywords.length) {
		list = data[TagKeywordList] || {};
		keywords.forEach(item => {
			list[item] --;
		});
		record[TagKeywordList] = list;
	}
	if (category.length) {
		list = data[TagCategoryList] || {};
		category.forEach(item => {
			list[item] --;
		});
		record[TagCategoryList] = list;
	}

	// Update DB
	if (immediately) {
		chrome.storage.local.set(record);

		delete DBs.tmrPageInfos;
		if (!DBs.pageInfo) await initDB();

		let tasks = [];
		tasks.push((async () => {
			var list = await chrome.storage.local.get(TagArticleList);
			list = (list || {})[TagArticleList] || [];
			var has = false;
			list = list.filter(item => {
				if (!!item.url && !keyList.includes(parseURL(item.url))) return true;
				has = true;
				return false;
			});
			if (has) {
				let data = {};
				data[TagArticleList] = list;
				await chrome.storage.local.set(data);
			}
		}) ());
		keyList.forEach(key => {
			tasks.push((async key => {
				delete TabInfo[key];
				await DBs.pageInfo.del('pageInfo', key);
			}) (key));
		});
		await Promise.all(tasks);
		logger.log('DB[PageInfo]', 'Del Page Info: ' + urlList.join(', '));
	}
	else {
		await chrome.storage.local.set(record);

		DBs.tmrPageInfos = setTimeout(async () => {
			delete DBs.tmrPageInfos;
			if (!DBs.pageInfo) await initDB();

			var tasks = [];
			keyList.forEach(key => {
				tasks.push((async key => {
					delete TabInfo[key];
					await DBs.pageInfo.del('pageInfo', key);
				}) (key));
			});
			await Promise.all(tasks);
			logger.log('DB[PageInfo]', 'Del Page Info: ' + urlList.join(', '));
		}, 200);
	}
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
		setPageInfo(tabInfo.url, pageInfo, true),
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
const RefreshKeywordsCategoryCache = async (articles) => {
	if (!articles) {
		if (!DBs.pageInfo) await initDB();
		articles = await DBs.pageInfo.all('pageInfo');
		articles = Object.keys(articles).map(id => articles[id]);
	}

	var keywords = {}, category = {};
	articles.forEach(item => {
		if (!!item.keywords) {
			item.keywords.forEach(kw => {
				if (!kw) return;
				if (!keywords[kw]) {
					keywords[kw] = 1;
				}
				else {
					keywords[kw] ++;
				}
			});
		}
		if (!!item.category) {
			item.category.forEach(ct => {
				if (!ct) return;
				if (!category[ct]) {
					category[ct] = 1;
				}
				else {
					category[ct] ++;
				}
			});
		}
	});

	const storage = {};
	storage[TagKeywordList] = keywords;
	storage[TagCategoryList] = category;
	await chrome.storage.local.set(storage);

	return { keywords, category };
};
EventHandler.GetArticleList = async (options) => {
	if (!DBs.pageInfo) await initDB();

	var list = await DBs.pageInfo.all('pageInfo');
	list = Object.keys(list).map(id => list[id]);

	// Cache
	var storage = {};
	storage[TagArticleList] = list.map(item => {
		return convertPageInfoToRecord(item);
	});
	await Promise.all([
		RefreshKeywordsCategoryCache(list),
		chrome.storage.local.set(storage),
	]);

	// Parse options
	var onlyCached = true, isLastVisit = true;
	if (!!options) {
		onlyCached = isBoolean(options.onlyCached) ? options.onlyCached : onlyCached;
		isLastVisit = isBoolean(options.isLastVisit) ? options.isLastVisit : isLastVisit;
	}

	list = storage[TagArticleList];
	if (onlyCached) {
		list = list.filter(item => item.isCached);
	}
	if (isLastVisit) {
		list.sort((pa, pb) => pb.lastVisit - pa.lastVisit);
	}
	else {
		list.sort((pa, pb) => pb.duration - pa.duration);
	}

	return list;
};
EventHandler.GetArticleInfo = async (options) => {
	if (!options.articles || !options.articles.length) return [];

	if (!DBs.pageInfo) await initDB();

	var list = await Promise.all(options.articles.map(async url => {
		var item = await DBs.pageInfo.get('pageInfo', parseURL(url));
		if (!item) return null;
		if (!item.title || !item.url || !item.content) return null; // Need change for local file.
		if (!!item.timestamp) {
			item.lastVisit = Date.now();
		}
		else {
			item.lastVisit = (new Date(item.timestamp.replace(/\s+[a-z]+$/i, ''))).getTime();
		}
		return item;
	}));
	list = list.filter(item => !!item);

	var isLastVisit = true;
	if (!!options) {
		isLastVisit = isBoolean(options.isLastVisit) ? options.isLastVisit : isLastVisit;
	}
	if (isLastVisit) {
		list.sort((pa, pb) => pb.lastVisit - pa.lastVisit);
	}
	else {
		list.sort((pa, pb) => pb.duration - pa.duration);
	}

	list = list.map(item => {
		return {
			title: item.title,
			url: item.url,
			content: item.content,
			description: item.description,
			hash: item.hash,
		};
	});
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
EventHandler.RemovePageInfos = async () => {
	if (!DBs.pageInfo) await initDB();
	var [list, cache] = await Promise.all([
		DBs.pageInfo.all('pageInfo'),
		chrome.storage.local.get(TagArticleList),
	]);
	cache = (cache || {})[TagArticleList] || [];
	var targets = [];
	for (let key in list) {
		let item = list[key];
		let data = convertPageInfoToRecord(item);
		if (data.isCached) continue;
		if (!targets.includes(item.url)) targets.push(item.url);
	}
	cache.forEach(item => {
		if (item.isCached) return;
		if (!targets.includes(item.url)) targets.push(item.url);
	});
	await delPageInfo(targets, true);
};
EventHandler.ChangePageTitle = async (data) => {
	var info = await getPageInfo(data.url);
	info.title = data.title;
	await setPageInfo(data.url, info, true);
};

/* Search Similarity */

const fileterArticleByCategoryAndKeyword = (allArticles, category, keywords, key) => {
	// Filter articles based on keywords and categories
	const related = [];
	allArticles.forEach(item => {
		if (!item.url) return;
		if (!item.isCached) return;
		if (!!key && parseURL(item.url) === key) return;

		item.score = 0;
		if (!!item.keywords && !!item.keywords.length) {
			keywords.forEach(kw => {
				if (item.title.indexOf(kw) >= 0) item.score += 1;
				if (item.keywords.includes(kw)) {
					item.score += 5;
				}
				else if (item.keywords.join(',').includes(kw)) {
					item.score += 3;
				}
			});
		}
		else {
			keywords.forEach(kw => {
				if (item.title.indexOf(kw) >= 0) item.score += 1;
			});
		}

		if (!!item.category && !!item.category.length) {
			let t = category.length + 1;
			category.forEach((ct, i) => {
				if (item.title.indexOf(ct) >= 0) item.score += 1;
				if (item.category.includes(ct)) {
					let rate = (i + 1) / t;
					rate = (1 - rate) ** 2;
					item.score += Math.ceil(2.5 * (1 - rate));
				}
				else if (item.category.join(',').includes(ct)) {
					let rate = (i + 1) / t;
					rate = (1 - rate) ** 2;
					item.score += Math.ceil(1.5 * (1 - rate));
				}
			});
		}
		else {
			category.forEach((ct, i) => {
				if (item.title.indexOf(ct) >= 0) item.score += 1;
			});
		}

		if (item.score > 0) {
			related.push(item);
		}
	});
	if (!related || !related.length) return [];
	related.sort((a, b) => b.score - a.score);
	if (related.length > RelatedLimit) related.splice(RelatedLimit);

	return related;
};
const searchRelativeArticles = async (options, prompt, related) => {
	const usage = {}
	options.articles = [];
	related = isArray(related) ? related : [];

	// Assemble article list
	const articleMap = {};
	related.forEach(item => {
		var line = ['- ' + (item.title || '(Untitled)').replace(/[\n\r]+/g, ' ')];
		line.push('  URL: ' + item.url);
		if (!!item.category && !!item.category.length) {
			line.push('  Categories: ' + item.category.join(', '));
		}
		if (!!item.keywords && !!item.keywords.length) {
			line.push('  Keywords: ' + item.keywords.join(', '));
		}
		options.articles.push(line.join('\n'));
		articleMap[item.url] = item;
	});
	options.articles = options.articles.join('\n');

	// Assemble conversation
	prompt = PromptLib.assemble(prompt, options);
	const conversation = [['human', prompt]];

	// Call AI
	var articleList = await callLLMOneByOne(getFunctionalModelList('findArticlesFromList'), conversation, true, 'FindArticlesFromList');
	updateUsage(usage, articleList.usage);

	articleList = articleList.reply._origin.split(/[\n\r]+/).map(line => {
		line = line.replace(/^((\-|\+|\d+\.)\s*)+/, '').trim();
		const match = line.match(/^\[[^\]]*\]\s*\(([\w\W]+)\)$/);
		if (!!match) line = match[1];
		const info = articleMap[line];
		if (!info) return null;
		return {
			title: info.title,
			url: info.url,
		}
	}).filter(item => !!item);

	return {list: articleList, usage};
};
EventHandler.SearchSimilarArticleForCurrentPage = async (url) => {
	if (!DBs.pageInfo) await initDB();
	const key = parseURL(url), usage = {};
	var [articleInfo, allArticles] = await Promise.all([
		DBs.pageInfo.get('pageInfo', key),
		chrome.storage.local.get(TagArticleList),
	]);
	if (!articleInfo) {
		articleInfo = {
			content: "(No Content)",
		};
	}
	articleInfo.keywords = articleInfo.keywords || [];
	articleInfo.category = articleInfo.category || [];
	allArticles = (allArticles || {})[TagArticleList];

	// Get all article info from DB
	if (!allArticles) {
		allArticles = await EventHandler.GetArticleList({
			onlyCached: true,
			isLastVisit: true,
		});
	}

	// Obtaining the keywords and categories of an article
	if (articleInfo.keywords.length === 0 || articleInfo.category.length === 0) {
		let conversation = [];
		conversation.push(['human', PromptLib.assemble(PromptLib.analyzeKeywordsAndCategoryOfArticle, {
			lang: LangName[myInfo.lang],
			content: articleInfo.content,
		})]);
		let modelList = getFunctionalModelList('analyzeKeywordCategory');
		let reply = await callLLMOneByOne(modelList, conversation, true, 'AnalyzeKeywordCategory');
		updateUsage(usage, reply.usage);
		reply = reply.reply;
		// Refresh article info
		articleInfo = await DBs.pageInfo.get('pageInfo', key);
		// Update article info
		articleInfo.category = parseArray(reply.category);
		articleInfo.keywords = parseArray(reply.keywords);
		await DBs.pageInfo.set('pageInfo', key, articleInfo);
	}

	// Filter articles based on keywords and categories
	const related = fileterArticleByCategoryAndKeyword(allArticles, articleInfo.category, articleInfo.keywords, key);

	// Find relative articles
	const options = {
		title: articleInfo.title,
		category: "(No category)",
		keywords: "(No keyword)",
	};
	if (articleInfo.keywords.length > 0) {
		options.keywords = articleInfo.keywords.join(', ');
	}
	if (articleInfo.category.length > 0) {
		options.category = articleInfo.category.join(', ');
	}
	const articleList = await searchRelativeArticles(options, PromptLib.findArticlesInList, related);
	updateUsage(usage, articleList.usage);

	return {
		list: articleList.list,
		usage,
	};
};
const getCategoryKeywordsForConversation = async (dialog) => {
	const usage = {};

	// Analyze the categories and keywords of current topic
	const conversation = [];
	conversation.push(['human', PromptLib.assemble(PromptLib.analyzeKeywordsAndCategoryOfConversation, {
		lang: LangName[myInfo.lang],
		conversation: dialog,
	})]);
	var reply = await callLLMOneByOne(getFunctionalModelList('analyzeKeywordCategory'), conversation, true, 'AnalyzeKeywordCategory');
	updateUsage(usage, reply.usage);
	reply = reply.reply;

	return {
		usage,
		category: parseArray(reply.category),
		keywords: parseArray(reply.keywords),
	};
};
const filterCategoryKeywordsForConversation = async (dialog) => {
	if (!PromptLib.filterKeywordsAndCategoryOfConversation) {
		return {
			usage: {},
			category: [],
			keywords: [],
		};
	}

	var data = (await chrome.storage.local.get([TagKeywordList, TagCategoryList])) || {};
	if (!data[TagKeywordList] || !data[TagCategoryList]) {
		data = await RefreshKeywordsCategoryCache();
	}
	else {
		data = {
			keywords: data[TagKeywordList],
			category: data[TagCategoryList],
		};
	}
	data.keywords = Object.keys(data.keywords).map(key => [key, data.keywords[key]]);
	data.keywords.sort((a, b) => b[1] - a[1]);
	data.keywords.splice(100);
	data.keywords = data.keywords.map(item => item[0]);
	data.category = Object.keys(data.category).map(key => [key, data.category[key]]);
	data.category.sort((a, b) => b[1] - a[1]);
	data.category.splice(100);
	data.category = data.category.map(item => item[0]);

	const usage = {};
	// Analyze the categories and keywords of current topic
	const conversation = [];
	conversation.push(['human', PromptLib.assemble(PromptLib.filterKeywordsAndCategoryOfConversation, {
		lang: LangName[myInfo.lang],
		conversation: dialog,
		keywords: data.keywords.join(', '),
		category: data.category.join(', '),
	})]);

	var reply = await callLLMOneByOne(getFunctionalModelList('filterKeywordCategory'), conversation, true, 'FilterKeywordCategory');
	updateUsage(usage, reply.usage);
	reply = reply.reply;

	return {
		usage,
		category: parseArray(reply.category),
		keywords: parseArray(reply.keywords),
	};
};
AIHandler.selectArticlesAboutConversation = async (dialog, source, sid) => {
	const usage = {};

	var [ctAndKw, ctkwList, allArticles] = await Promise.all([
		getCategoryKeywordsForConversation(dialog), // Analyze the categories and keywords of current dialog
		filterCategoryKeywordsForConversation(dialog),
		chrome.storage.local.get(TagArticleList),
	]);
	updateUsage(usage, ctAndKw.usage);
	updateUsage(usage, ctkwList.usage);
	allArticles = (allArticles || {})[TagArticleList] || [];
	if (!allArticles.length) {
		allArticles = await EventHandler.GetArticleList({
			onlyCached: true,
			isLastVisit: true,
		});
	}

	// Combine keywords and categories
	ctkwList.category.forEach(item => {
		if (ctAndKw.category.includes(item)) return;
		ctAndKw.category.push(item);
	});
	ctkwList.keywords.forEach(item => {
		if (ctAndKw.keywords.includes(item)) return;
		ctAndKw.keywords.push(item);
	});

	// Filter articles by Category and Keyword
	const related = fileterArticleByCategoryAndKeyword(allArticles, ctAndKw.category, ctAndKw.keywords);

	// Find relative articles
	const options = {
		topic: dialog,
	};
	const articleList = await searchRelativeArticles(options, PromptLib.findArticlesForTopic, related);
	updateUsage(usage, articleList.usage);

	return {
		articles: articleList.list,
		usage,
	};
};

/* AI Search Record */

EventHandler.SaveAISearchRecord = async (data) => {
	if (!DBs.searchRecord) await initDB();

	const tasks = [];
	const {quest, record} = data;
	tasks.push(DBs.searchRecord.set('searchRecord', quest, record));

	// Update Cache
	var list;
	try {
		list = await chrome.storage.session.get(TagSearchRecord);
	}
	catch (err) {
		logger.error('SaveAISearchRecord', err);
		list = null;
	}
	list = (list || {})[TagSearchRecord];
	if (!!list) {
		const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
		let isNew = true;
		list.some(item => {
			if (item.quest !== quest) return;
			item.timestamp = record.timestamp || 0;
			item.datestring = record.datestring || messages.hintNone;
			isNew = false;
			return true;
		});
		if (isNew) {
			list.unshift({
				quest,
				timestamp: record.timestamp || 0,
				datestring: record.datestring || messages.hintNone,
			});
		}
		list.sort((a, b) => b.timestamp - a.timestamp);
		const data = {};
		data[TagSearchRecord] = list;
		tasks.push(chrome.storage.session.set(data));
	}

	await Promise.all(tasks);
	logger.log('DB[SearchRecord]', 'Save Search Record:', quest);
};
EventHandler.LoadAISearchRecordList = async () => {
	if (!DBs.searchRecord) await initDB();

	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
	const all = await DBs.searchRecord.all('searchRecord');
	var list = [];
	for (let quest in all) {
		let info = all[quest];
		let item = {};
		item.quest = info.quest || quest;
		item.timestamp = info.timestamp || 0;
		item.datestring = info.datestring || messages.hintNone;
		list.push(item);
	}
	list.sort((a, b) => b.timestamp - a.timestamp);

	const data = {};
	data[TagSearchRecord] = list;
	await chrome.storage.session.set(data);

	return list;
};
EventHandler.GetAISearchRecord = async (quest) => {
	if (!DBs.searchRecord) await initDB();

	return await DBs.searchRecord.get('searchRecord', quest);
};
EventHandler.DeleteAISearchRecord = async (quest) => {
	if (!DBs.searchRecord) await initDB();

	var tasks = [];
	tasks.push(DBs.searchRecord.del('searchRecord', quest));

	var list;
	try {
		list = await chrome.storage.session.get(TagSearchRecord);
	}
	catch (err) {
		logger.error('SaveAISearchRecord', err);
		list = null;
	}
	list = (list || {})[TagSearchRecord];
	if (!!list) {
		let count = list.length;
		list = list.filter(item => item.quest !== quest);
		if (list.length !== count) {
			let data = {};
			data[TagSearchRecord] = list;
			tasks.push(chrome.storage.session.set(data));
		}
	}

	await Promise.all(tasks);
};

/* AI */

const CacheLimit = 1000 * 60 * 60 * 12;
const removeAIChatHistory = async (tid) => {
	chrome.storage.session.remove(tid + ':crosspageConv');

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
	await chrome.storage.session.set({lastHello: currentDate});

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
				summary.category = parseArray(summary.category);
				summary.keywords = parseArray(summary.keywords);
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
		dispatchEvent({
			event: "translationSuggestion",
			data: {
				deficiencies: suggestion.deficiencies,
				suggestions: suggestion.suggestions,
			},
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
const convertListToTable = (list, caption, table) => {
	if (!list) return;

	parseArray(list, false).forEach((line, i) => {
		if (i === 0) {
			table.push('| **' + caption + '** | ' + line + ' |');
		}
		else {
			table.push('| | ' + line + ' |');
		}
	});
};
AIHandler.translateAndInterpretation = async (data, source, sid) => {
	var available = await checkAvailability();
	if (!available) return;

	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];

	data.myLang = LangName[myInfo.lang] || myInfo.lang;
	var conversation = PromptLib.assemble(PromptLib.translateAndInterpretation, data);
	conversation = [['human', conversation]];

	var translation = await callAIandWait('directAskAI', conversation), usage = {};
	if (!!translation) {
		updateUsage(usage, translation.usage);
	}
	var json = parseReplyAsXMLToJSON(translation.reply);
	logger.log('Translate', json);

	if (!!json.originentry) {
		let entry = json.originentry;
		let item = [];
		item.push('#### ' + messages.dictionary.hintInterpretation + '\n');
		item.push('|　|　|');
		item.push('|-|-|');
		convertListToTable(entry.category, messages.dictionary.hintItemCategory, item);
		convertListToTable(entry.explanation, messages.dictionary.hintItemInterpretation, item);
		convertListToTable(entry.pronunciation, messages.dictionary.hintItemPronunciation, item);
		convertListToTable(entry.partofspeech, messages.dictionary.hintItemPartOfSpeech, item);
		convertListToTable(entry.usage, messages.dictionary.hintItemUsage, item);
		convertListToTable(entry.examples, messages.dictionary.hintItemExample, item);
		convertListToTable(entry.synonyms, messages.dictionary.hintItemSynonyms, item);
		convertListToTable(entry.antonyms, messages.dictionary.hintItemAntonyms, item);

		let list = json.translationentries;
		if (!!list) {
			entry = [];
			entry.push('#### ' + messages.dictionary.hintTranslation + '\n');
			list._origin.replace(/<entry>\s*([\w\W]+?)\s*<\/entry>/gi, (m, ctx) => {
				var json = parseReplyAsXMLToJSON(ctx);
				let item = [];
				item.push('|　|　|');
				item.push('|-|-|');
				convertListToTable(json.partofspeech, messages.dictionary.hintItemPartOfSpeech, item);
				convertListToTable(json.translation, messages.dictionary.hintItemTranslation, item);
				convertListToTable(json.pronunciation, messages.dictionary.hintItemPronunciation, item);
				convertListToTable(json.usage, messages.dictionary.hintItemUsage, item);
				convertListToTable(json.examples, messages.dictionary.hintItemExample, item);
				entry.push(item.join('\n'));
			});
			item.push('');
			item.push(entry.join('\n\n'));
		}

		translation = item.join('\n');
	}
	else {
		translation = translation.reply;
	}

	return {translation, usage};
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

	var prompt, conversation = [];
	if (!!PromptLib.preliminaryThinkingUltra && PaCableModels.includes(myInfo.model)) {
		prompt = PromptLib.assemble(PromptLib.preliminaryThinkingUltra, options);
		conversation.push(['system', prompt]);
		prompt = data.request + '\n\n(Time: ' + options.time + ')';
	}
	else {
		prompt = PromptLib.assemble(PromptLib.preliminaryThinking, options);
	}
	conversation.push(['human', prompt]);
	logger.info('PreliminaryThinking', 'Prompt Assembled', [...conversation]);
	var result, usage = {};
	try {
		result = await callAIandWait('directAskAI', conversation);
		if (!!result) {
			updateUsage(usage, result.usage);
			result = result.reply || result;
			let json = parseReplyAsXMLToJSON(result);
			result = json.reply?._origin || json.reply || result;
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

const Tab2Article = {};
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
	const request = (data.requests || []).join('\n\n') || messages.hintNone;
	const currentSummary = (data.content || []).map(ctx => '<summary>\n' + ctx.trim() + '\n</summary>').join('\n\n') || messages.hintNone;

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
chrome.storage.local.remove('cached_article_list'); // clear old version cache

/* ------------ */

EventHandler.notify = (data, source, sid) => {
	var sourceName = 'Server';
	if (source === "BackEnd") sourceName = 'Background';
	else if (source === "FrontEnd") sourceName = 'Content';
	else if (source === "PageEnd") sourceName = 'Injection';
	if (!isString(data) && !isNumber(data) && !isBoolean(data)) data = JSON.stringify(data);
	logger.log(`Notify | ${sourceName}`, data);
};