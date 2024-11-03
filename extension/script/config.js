const PageName = 'ConfigPage';
var currentTabId = 0;

const saveConfig = async () => {
	var localInfo = {
		apiKey: myInfo.apiKey,
		showTokenUsage: !!myInfo.showTokenUsage,
	};
	var remoteInfo = {
		name: myInfo.name,
		info: myInfo.info,
		lang: myInfo.lang,
	};
	await Promise.all([
		chrome.storage.local.set(localInfo),
		chrome.storage.sync.set(remoteInfo)
	]);

	// Notify
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
	Notification.show('', messages.configPage.configurationSaved, 'rightBottom', 'success');
};
ActionCenter.saveConfig = async (ele, config) => {
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];

	myInfo.name = config.name || myInfo.name;
	myInfo.info = config.info || '';
	myInfo.lang = config.lang;
	if (!myInfo.lang) {
		myInfo.lang = DefaultLang;
	}
	else {
		myInfo.lang = myInfo.lang.toLowerCase();
		if (!i18nList.includes(myInfo.lang)) myInfo.lang = DefaultLang;
	}
	myInfo.apiKey = config.apiKey || {};
	myInfo.useLocalKV = ForceServer ? false : !config.wsHost;

	await saveConfig();

	document.querySelector('html').setAttribute('lang', myInfo.lang);
	document.title = messages.configPage.configurationTitle;

	// Send to BackEnd
	sendMessage('SetConfig', config);

	// I18N
	renderI18N('configPage');
};
ActionCenter.goBack = () => {
	location.href = `./newtab.html`;
};
ActionCenter.resetUsage = async () => {
	await chrome.storage.local.remove(['llm_usage_record', 'model_usage_record']);
	showUsage('LLMList', {});
	showUsage('ModelList', {});
};
EventHandler.getWebSiteURLFailed = (msg) => {
	if (!!msg.ok) return;
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
	Notification.show('', messages.configPage.connectFailed, 'rightBottom', 'fail');
};
EventHandler.connectWSHost = async (data) => {
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
	if (!data || !data.ok) {
		Notification.show('', messages.configPage.wsConnectFailed, 'rightBottom', 'fail');
	}
	else {
		await chrome.storage.local.set({ wsHost: data.wsHost });
		if (!data.wsHost) {
			console.log('[WS] Use Edged Knowledge Vault.');
			Notification.show('', messages.configPage.useEdgedVault, 'rightBottom', 'warn');
		}
		else {
			console.log('[WS] Connect Knowledge Vault: ' + data.wsHost);
			Notification.show('', messages.configPage.wsConnected, 'rightBottom', 'success');
		}
	}
};
ActionCenter.saveConfigToFile = async () => {
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];

	const config = {};
	for (let key in myInfo) {
		if (key === 'useLocalKV') continue;
		config[key] = myInfo[key];
	}

	const saved = await saveContentToLocalFile(config, 'cyprite.config.json', {
		description: 'JSON',
		accept: {
			'application/json': ['.json'],
		},
	});
	if (!!saved) {
		Notification.show('', messages.configPage.hintConfigurationSaved, 'middleTop', 'success');
	}
};
ActionCenter.loadConfigFromFile = async () => {
	try {
		const json = await loadContentFromLocalFile({
			description: 'JSON',
			accept: {
				'application/json': ['.json'],
			},
		}, true);
		if (json === null) return;

		if (!isObject(json)) {
			const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
			Notification.show('', messages.configPage.hintReadConfigurationFailed, 'middleTop', 'error');
			return;
		}
		for (let key in myInfo) {
			let value = json[key];
			if (!value) continue;
			let obj = myInfo[key];
			if (isObject(obj)) {
				if (isObject(value)) {
					for (let key in value) {
						let v = value[key];
						if (!v) continue;
						obj[key] = v;
					}
				}
			}
			else {
				myInfo[key] = value;
			}
		}
		await saveConfig();
	}
	catch (err) {
		logger.error('LoadConfigFile', err);
		const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
		Notification.show('', messages.configPage.hintReadConfigurationFailed, 'middleTop', 'error');
	}
};
ActionCenter.turnShowTokenUsageOff = async () => {
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
	myInfo.showTokenUsage = false;
	await chrome.storage.local.set({showTokenUsage: myInfo.showTokenUsage});
	Notification.show('', messages.configPage.configurationSaved, 'rightBottom', 'success');
	renderI18N('configPage');
};
ActionCenter.turnShowTokenUsageOn = async () => {
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
	myInfo.showTokenUsage = true;
	await chrome.storage.local.set({showTokenUsage: myInfo.showTokenUsage});
	Notification.show('', messages.configPage.configurationSaved, 'rightBottom', 'success');
	renderI18N('configPage');
};

const loadAIUsage = async () => {
	var info = await chrome.storage.local.get(['llm_usage_record', 'model_usage_record']);
	var llm = info['llm_usage_record'], model = info['model_usage_record'];
	var llmUsage = {}, modelUsage = {};
	if (!!llm) {
		for (let ai in llm) {
			llmUsage[ai] = llm[ai];
		}
	}
	if (!!model) {
		for (let ai in model) {
			modelUsage[ai] = model[ai];
		}
	}

	return {
		llm: llmUsage,
		model: modelUsage,
	};
};
const newLine = (name, count, input, output) => {
	var line = newEle('div', 'tableLine'), item;
	item = newEle('span', 'tableItem');
	item.innerText = name || '';
	line.appendChild(item);
	item = newEle('span', 'tableItem');
	item.innerText = count || '';
	line.appendChild(item);
	item = newEle('span', 'tableItem');
	item.innerText = input || '';
	line.appendChild(item);
	item = newEle('span', 'tableItem');
	item.innerText = output || '';
	line.appendChild(item);

	return line;
};
const showUsage = (ui, list) => {
	ui = document.querySelector('.tableList[name="' + ui + '"]');
	if (!ui) return;
	ui.innerHTML = '';

	var line = newLine('Name', 'Request', 'Input Tokens', 'Output Tokens');
	ui.appendChild(line);

	list = Object.keys(list).map(item => {
		var obj = list[item];
		return {
			name: item,
			count: obj.count,
			input: obj.input,
			output: obj.output,
		}
	});
	list.sort((a, b) => b.count - a.count);
	list.forEach(line => {
		var ele = newLine(line.name, line.count, line.input, line.output);
		ui.appendChild(ele);
	});
};

const init = async () => {
	var [tab, usage] = await Promise.all([
		chrome.tabs.getCurrent(),
		loadAIUsage(),
		getConfig(),
	]);
	const messages = I18NMessages[myInfo.lang] || I18NMessages.en;
	currentTabId = tab.id;

	// Force Server
	if (ForceServer) {
		let items = document.body.querySelectorAll('[caseGroup="forceServer"]');
		[...items].forEach(item => {
			item.style.display = 'none';
			// item.parentNode.removeChild(item);
		});
	}

	// I18Ns
	renderI18N('configPage');
	document.querySelector('html').setAttribute('lang', myInfo.lang);
	document.title = messages.configPage.configurationTitle;

	// Group Control
	setGroupSwitcher();
	// Register Action
	registerAction();

	// Read config
	var [localInfo, remoteInfo] = await Promise.all([
		chrome.storage.local.get(['wsHost', 'apiKey']),
		chrome.storage.sync.get(['name', 'info', 'lang'])
	]);
	var data = {
		name: remoteInfo.name || '',
		lang: remoteInfo.lang || DefaultLang,
		info: remoteInfo.info || '',
		wsHost: localInfo.wsHost || '',
		apiKey: localInfo.apiKey,
	};
	if (!!data.apiKey && isString(data.apiKey)) {
		data.apiKey = {};
		data.apiKey.gemini = localInfo.apiKey;
	}
	setDataGroup('configuration', data);
	if (!!globalThis.TrialVersion) {
		let title = document.querySelector('h1');
		title.innerText = title.innerText + ' (' + messages.trialVersion + ')';
	}

	showUsage('LLMList', usage.llm);
	showUsage('ModelList', usage.model);

	changeTab('groupPersonel');
};

window.onload = init;