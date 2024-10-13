const i18nList = ['en', 'zh', 'fr', 'de', 'jp', 'it'];
const myInfo = {};

const ActionCenter = {};
const EventHandler = {};
const CallbackHandlers = {};

var currentMode = '';

/* Utils */

const getConfig = async () => {
	var [localInfo, remoteInfo] = await Promise.all([
		chrome.storage.local.get(['wsHost', 'apiKey', 'AImodel', 'searchMode']),
		chrome.storage.sync.get(['name', 'info', 'lang']),
	]);

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
	myInfo.apiKey = localInfo.apiKey || {};
	myInfo.useLocalKV = ForceServer ? false : !localInfo.wsHost;
	myInfo.model = localInfo.AImodel || myInfo.model || ModelList[0];
	myInfo.searchMode = localInfo.searchMode || 'fullAnswer';
};
const getDataGroup = group => {
	var data = {};
	[...document.body.querySelectorAll('[dataGroup="' + group + '"]')].forEach(item => {
		var name = item.getAttribute('dataItem');

		if (item.tagName === 'INPUT' || item.tagName === 'TEXTAREA' || item.tagName === 'SELECT') {
			writeData(data, name, parseValue(item.value));
		}
		else if (item.contentEditable === 'true' || item.contentEditable === true) {
			writeData(data, name, parseValue(item.innerText));
		}
		else {
			console.log(item);
		}
	});

	return data;
};
const setDataGroup = (group, data) => {
	[...document.body.querySelectorAll('[dataGroup="' + group + '"]')].forEach(item => {
		var name = item.getAttribute('dataItem');
		var value = readData(data, name);
		if (value === undefined || value === null) return;

		if (item.tagName === 'INPUT' || item.tagName === 'TEXTAREA' || item.tagName === 'SELECT') {
			item.value = value;
		}
		else if (item.contentEditable === 'true' || item.contentEditable === true) {
			item.innerText = value;
		}
		else {
			console.log(item);
		}
	});
};
const setGroupSwitcher = () => {
	[...document.body.querySelectorAll('[showGroup]')].forEach(item => {
		var groupName = item.getAttribute('showGroup');
		item.addEventListener('click', () => changeTab(groupName));
	});
};
const changeTab = (mode) => {
	[...document.body.querySelectorAll('[showGroup], [group]')].forEach(item => item.classList.remove('active'));
	[...document.body.querySelectorAll('[showGroup*="' + mode + '"], [group*="' + mode + '"]')].forEach(item => item.classList.add('active'));
	currentMode = mode;

	if (globalThis.afterChangeTab) globalThis.afterChangeTab();
};
const renderI18N = () => {
	var messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];

	[...document.body.querySelectorAll('[titlePath]')].forEach(item => {
		var path = item.getAttribute('titlePath');
		if (item.tagName === 'IMG') {
			item.title = readData(messages, path);
		}
		else {
			item.innerText = readData(messages, path);
		}
	});
	[...document.body.querySelectorAll('[htmlPath]')].forEach(item => {
		var path = item.getAttribute('htmlPath');
		item.innerHTML = readData(messages, path);
	});
	[...document.body.querySelectorAll('[placeholderName]')].forEach(item => {
		var path = item.getAttribute('placeholderName');
		item.placeholder = readData(messages, path) || path;
	});
};
const registerAction = () => {
	[...document.body.querySelectorAll('[action]')].forEach(item => {
		var action = item.getAttribute('action');
		var handler = ActionCenter[action];
		if (!handler) return;
		item.addEventListener('click', (evt) => {
			var dataGroup = item.getAttribute('dataFetch');
			var data;
			if (!!dataGroup) {
				data = getDataGroup(dataGroup);
			}
			handler(item, data, evt);
		});
	});
};
const selectTranslationLanguages = (lang, defLang) => {
	// if (!lang || lang.toLowerCase() === defLang || LangName[defLang].toLowerCase() === lang.toLowerCase()) {
	// 	for (let key in LangName) {
	// 		if (key === defLang) continue;
	// 		lang = LangName[key];
	// 		break;
	// 	}
	// 	return lang;
	// }
	return LangName[lang] || lang;
};

/* Communication */

const sendMessage = (event, data, target='BackEnd', tid) => {
	chrome.runtime.sendMessage({
		event,
		data,
		target,
		tid,
		sender: PageName,
		sid: currentTabId
	});
};
chrome.runtime.onMessage.addListener(msg => {
	if (!msg || msg.target !== PageName) return;

	var handler = EventHandler[msg.event];
	if (!handler) return;

	handler(msg.data, msg.sender, msg.sid);
});
const askSWandWait = (action, data) => new Promise((res, rej) => {
	var id = newID();
	while (!!CallbackHandlers[id]) {
		id = newID();
	}
	CallbackHandlers[id] = [res, rej];

	sendMessage('AskSWAndWait', {id, action, data});
});
const askAIandWait = (action, data) => new Promise((res, rej) => {
	var id = newID();
	while (!!CallbackHandlers[id]) {
		id = newID();
	}
	CallbackHandlers[id] = [res, rej];

	sendMessage('AskAIAndWait', {id, action, data});
});
EventHandler.replyAskAndWait = (data) => {
	var id = data.id, result = data.result, ok = true, error = null;
	if (!id && !!data.data) {
		result = data.data;
		id = result.id;
		ok = data.ok !== false;
		if (!id) return;
		result = result.result;
		error = data.error;
	}
	var res = CallbackHandlers[id];
	if (!res) return;
	delete CallbackHandlers[id];
	if (!ok) {
		res[1](error);
	}
	else {
		res[0](result);
	}
};