const PageName = 'HomeScreen';
const WikiPediaMaxForDeepThinking = 5;
const ArxivMaxForDeepThinking = 5;
const SearchDefaultCount = 20;
const SearchMaxCount = 10;
const SearchLocalLimit = 10;
const MaximumConcurrentWebpageReading = 3;
const MaximumWebpageRead = 15;
const SearchHistoryCount = 20;
const DefaultPanel = 'intelligentSearch';
const OrderTypes = {
	totalDuration: 'TotalDuration',
	lastVisit: 'LastVisit',
};
const SearchModeOrderList = [
	'fullAnalyze',
	'fullAnswer',
	'searchOnly',
	'keywordOnly',
];
const UseSearch = true;
const CurrentArticleList = [];
const CacheExpire = 1000 * 3600;

var AIModelList = null;
var currentTabId = 0;
var curerntStatusMention = null;
var aiSearchInputter = null;
var tmrThinkingHint = null;
var searchResult = '';
var advSearchConversation = null;
var ntfDeepThinking = null;
var running = false;
var orderType = 'totalDuration';
var lastTranslatContent = '';
var cachedArticleList = null;
var webpageReaded = 0;

/* Cache Control */

const getCachedInformation = async (type, name) => {
	expireCachedInformation();

	var key = 'Cache:' + type + ':' + name;
	var info = await chrome.storage.session.get(key);
	if (!info) return null;
	info = info[key];
	if (!info) return null;
	if (!info.data || !info.timestamp) {
		chrome.storage.session.remove(key);
		return null;
	}
	return info.data;
};
const setCachedInformation = async (type, name, info) => {
	expireCachedInformation();

	// Check if the newly entered information will cause the storage space to exceed the capacity limit.
	// If it exceeds, delete the oldest data until the new data can be stored.
	var key = 'Cache:' + type + ':' + name;
	var size = await chrome.storage.session.getBytesInUse();
	var delta = calculateByteSize(info) + calculateByteSize(key);
	delta = Math.ceil(delta * 1.2); // There is a certain difference between the actual volume and the volume calculated based on ByteSize.
	if (size + delta >= chrome.storage.session.QUOTA_BYTES) {
		let changed = await clearAllExpiredCache();
		if (changed) size = await chrome.storage.session.getBytesInUse();
		if (size + delta >= chrome.storage.session.QUOTA_BYTES) {
			let cached = await chrome.storage.session.get();
			let list = [];
			for (let key in cached) {
				if (!key.match(/^Cache:/)) continue;
				let cache = cached[key];
				list.push([key, calculateByteSize(cache), cache.time]);
			}
			list.sort((a, b) => a[2] - b[2]);
			let total = size, targets = [];
			list.some(item => {
				let s = total - item[1];
				if (s < chrome.storage.session.QUOTA_BYTES) {
					return true;
				}
				total = s;
				targets.push(item[0]);
			});
			if (targets.length > 0) {
				await chrome.storage.session.remove(targets);
			}
		}
	}

	var cache = {};
	cache[key] = {
		data: info,
		timestamp: Date.now(),
	};
	await chrome.storage.session.set(cache);
};
const clearAllExpiredCache = async () => {
	if (!!expireCachedInformation.timer) {
		clearTimeout(expireCachedInformation.timer);
	}
	delete expireCachedInformation.timer;

	var info = await chrome.storage.session.get();
	var targets = [];
	for (let key in info) {
		if (!key.match(/^Cache:/)) continue;
		let cache = info[key];
		let time = cache.timestamp || 0;
		if (!cache.data || (Date.now() - time > CacheExpire)) {
			targets.push(key);
		}
	}
	if (targets.length > 0) {
		await chrome.storage.session.remove(targets);
		return true;
	}
	return false;
};
const expireCachedInformation = () => {
	if (!!expireCachedInformation.timer) {
		clearTimeout(expireCachedInformation.timer);
	}
	expireCachedInformation.timer = setTimeout(clearAllExpiredCache, 1000 * 60);
};

/* UI */

const generateModelList = async () => {
	var localInfo = await chrome.storage.local.get(['apiKey', 'AImodel']);
	var model = localInfo.AImodel || '';
	var apiKey = localInfo.apiKey || {};

	ModelList.splice(0);
	ModelOrder.forEach(ai => {
		var key = apiKey[ai];
		if (ai === 'ernie') {
			if (!key || !key.api || !key.secret) return;
		}
		else if (!key) return;
		if (!!AI2Model[ai]) ModelList.push(...AI2Model[ai]);
	});

	AIModelList.innerHTML = '';
	ModelList.forEach(mdl => {
		var name = ModelNameList[mdl];
		if (!name) return;
		var item = newEle('div', 'panel_model_item');
		item.innerText = name;
		item.setAttribute('name', mdl);
		if (mdl === model) {
			item.classList.add('current');
		}
		AIModelList.appendChild(item);
	});
};

/* Event */

const onChooseModel = async ({target}) => {
	if (!target.classList.contains("panel_model_item")) return;
	var model = target.getAttribute('name');
	chrome.storage.local.set({'AImodel': model});
	updateModelList(model);

	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
	Notification.show(messages.cypriteName, messages.mentions.changeModelSuccess, 'middleTop', 'success', 2 * 1000);
};
const onInputFinish = (inputter, sender, frame) => {
	var box = inputter.getBoundingClientRect();
	var height = box.height;
	sender.style.height = height + 'px';
	box = frame.parentNode.getBoundingClientRect();
	frame.style.height = (box.height - height - 10) + 'px';
	resizer = null;
};
const onContentPaste = evt => {
	evt.preventDefault();

	var html = evt.clipboardData.getData('text/html');
	var text = evt.clipboardData.getData('text/plain') || evt.clipboardData.getData('text');

	var content;
	if (!!html) {
		content = getPageContent(html, true);
	}
	else {
		content = text;
	}
	if (!content) return;

	document.execCommand('insertText', false, content);
};
const onSelectArticleItem = ({target}) => {
	if (!target.classList.contains('panel_article_list_item')) return;
	var selected = target.getAttribute('selected');
	if (!!selected) {
		target.removeAttribute('selected');
	}
	else {
		target.setAttribute('selected', 'true');
	}
};
const onSelectReference = ({target}) => {
	if (target.tagName !== 'LI') return;
	if (!target.classList.contains('reference_item')) return;

	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
	var panel = document.body.querySelector('.reference_page');
	var title = panel.querySelector('.title');
	var content = panel.querySelector('.content');
	title.innerText = target._data.title.replace(/[\n\r]+/g, ' ');
	parseMarkdownWithOutwardHyperlinks(content, messages.aiSearch.hintReferenceTitle + '[URL](' + target._data.url + ')\n\n----\n\n' + target._data.reply);

	panel.style.display = 'block';
};
ActionCenter.closeReference = () => {
	document.body.querySelector('.reference_page').style.display = 'none';
};

/* Utils */

const parseParams = () => {
	var params = location.search.replace(/^\?*/, '');
	params = params.split('&');
	var info = {};
	params.forEach(line => {
		line = line.split('=');
		var name = line.shift();
		var value = line.join('=');
		if (!value) {
			value = true;
		}
		else {
			let v = value * 1;
			if (!isNaN(v)) value = v;
		}
		info[name] = value;
	});
	return info;
};
const updateAIModelList = () => {
	var available = false;
	ModelList.splice(0);

	for (let ai in myInfo.apiKey) {
		let key = myInfo.apiKey[ai];
		if (ai === 'ernie') {
			if (!key || !key.api || !key.secret) continue;
		}
		else if (!key) continue;
		available = true;
		if (!!AI2Model[ai]) ModelList.push(...AI2Model[ai]);
	}
	myInfo.edgeAvailable = available;
};
const updateModelList = async (model) => {
	if (!model || !isString(model)) {
		let localInfo = await chrome.storage.local.get(['AImodel']);
		model = localInfo.AImodel || '';
	}

	[...AIModelList.querySelectorAll('.panel_model_item')].forEach(item => {
		var mdl = item.getAttribute('name');
		if (model === mdl) {
			item.classList.add('current');
		}
		else {
			item.classList.remove('current');
		}
	});
};
const addChatItem = (target, content, type, cid, need=false) => {
	var container = document.body.querySelector('.panel_operation_area[group="' + target + '"] .content_container');
	var needOperator = need && ['crossPageConversation'].includes(target);

	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
	var item = newEle('div', 'chat_item'), isOther = false;
	if (!cid) cid = newID();
	item.setAttribute('chatID', cid);

	var titleBar = newEle('div', "chat_title");
	var buttons = [];
	if (type === 'human') {
		if (!!myInfo.name) {
			let comma = messages.conversation.yourTalkPrompt.substr(messages.conversation.yourTalkPrompt.length - 1, 1);
			titleBar.innerText = myInfo.name + comma;
		}
		else {
			titleBar.innerText = messages.conversation.yourTalkPrompt;
		}
		item.classList.add('human');
		if (needOperator) buttons.push('<img button="true" action="changeRequest" src="../images/feather.svg">');
		buttons.push('<img button="true" action="copyContent" src="../images/copy.svg">');
		if (needOperator) buttons.push('<img button="true" action="deleteConversation" src="../images/trash-can.svg">');
	}
	else if (type === 'cyprite') {
		titleBar.innerText = messages.cypriteName + ':';
		item.classList.add('ai');
		if (needOperator) buttons.push('<img button="true" action="reAnswerRequest" src="../images/rotate.svg">');
		buttons.push('<img button="true" action="copyContent" src="../images/copy.svg">');
		if (needOperator) buttons.push('<img button="true" action="deleteConversation" src="../images/trash-can.svg">');
	}
	else {
		isOther = true;
		titleBar.innerText = type;
		item.classList.add('other');
	}
	item.appendChild(titleBar);

	if (!!content) {
		let contentPad = newEle('div', "chat_content");
		parseMarkdownWithOutwardHyperlinks(contentPad, content, messages.conversation.AIFailed);
		contentPad._data = content;
		item.appendChild(contentPad);
	}
	else {
		if (!isOther) return;
	}

	var operatorBar = newEle('div', 'operator_bar');
	operatorBar.innerHTML = buttons.join('');
	item.appendChild(operatorBar);

	container.appendChild(item);
	wait(60).then(() => {
		container.scrollTop = container.scrollHeight - container.offsetHeight
	});

	return cid;
};
const chooseTargetLanguage = (lang) => {
	return selectTranslationLanguages(lang, myInfo.lang);
};
const simplyParseHTML = (content, host) => {
	var ctx = [];
	content.replace(/<body[\w\W]*?>([\w\W]*)<\/body>/i, (m, c) => ctx.push(c.trim()));
	content = ctx.join('\n\n----\n\n');
	ctx.splice(0);
	content = content.replace(/<script[\w\W]*?>\s*([\w\W]*?)\s*<\/script>/gi, '');
	content = content.replace(/<style[\w\W]*?>\s*([\w\W]*?)\s*<\/style>/gi, '');
	content = content.replace(/<link[\w\W]*?>/gi, '');
	content = content.replace(/<img(\s+[\w\W]*?)?\/?>/gi, (m, prop) => {
		var title = (prop || '').match(/alt=('|")([\w\W]*?)\1/);
		var url = (prop || '').match(/src=('|")([\w\W]*?)\1/);
		if (!title) title = '';
		else title = title[2].trim();
		if (!url) {
			return ' ' + (title || '(image)') + ' ';
		}
		else {
			url = url[2];
			if (!url.match(/^(([\w\-]+:)?\/\/|data:)/)) {
				let head = host.split('/');
				head.pop();
				let parts = url.match(/^(\.{1,2}\/)+/);
				if (!!parts) {
					parts = parts[0];
					let tail = url.replace(parts, '/');
					if (tail.indexOf('/') !== 0) tail = '/' + tail;
					parts = parts.split('/');
					parts.filter(line => line === '..').forEach(() => head.pop());
					url = head.join('/') + tail;
				}
				else {
					let tail = url;
					if (tail.indexOf('/') !== 0) tail = '/' + tail;
					url = head.join('/') + tail;
				}
			}
			else if (!!url.match(/^\/\//)) {
				let protocol = host.match(/^[\w\-]+:/);
				if (!!protocol) {
					url = protocol[0] + url;
				}
				else {
					url = 'https:' + url; // default protocol
				}
			}
			return ' ![' + title + '](' + url + ') '
		}
	});

	return content;
};
const parseWikiContent = (content, keepLink=false, host) => {
	content = simplyParseHTML(content, host);
	var container = newEle('section');
	container.style.display = 'none';
	container.innerHTML = content;
	var parents = [];
	[...container.querySelectorAll('h1, h2')].forEach(ele => {
		var node = ele.parentNode;
		while (node !== container) {
			let has = false;
			parents.some(item => {
				if (item[0] === node) {
					item[1] ++;
					has = true;
					return true;
				}
			});
			if (!has) {
				parents.push([node, 1]);
			}
			node = node.parentNode;
		}
	});
	parents.sort((a, b) => b[1] - a[1]);
	var target = parents[0][1];
	parents.reverse().some(ele => {
		if (ele[1] === target) {
			target = ele[0];
			return true;
		}
	});
	container.innerHTML = '';
	container = null;
	parents.splice(0);
	parents = null;
	content = getPageContent(target, keepLink);
	target = null;
	return content;
};
const parseArxivAbstract = (content, host) => {
	content = simplyParseHTML(content, host);
	var container = newEle('section');
	container.style.display = 'none';
	container.innerHTML = content;
	var target = container.querySelector('h1.title');
	if (!target) target = container.querySelector('.title');

	var title, content;
	if (!!target) {
		title = target.textContent || '';
		title = title.replace(/^\s*Title:\s*/i, '');
		title = title.trim();
	}
	target = container.querySelector('blockquote.abstract');
	if (!target) target = container.querySelector('blockquote, .abstract');
	if (!!target) {
		let ctx = target.textContent || '';
		ctx = ctx.replace(/^\s*Abs(tracts?)?:\s*/i, '');
		ctx = ctx.trim();
		if (!!ctx) content = ctx;
		else content = getPageContent(content);
	}
	else {
		content = getPageContent(content);
	}
	container.innerHTML = '';
	container = null;
	target = null;
	return { title, content };
};
const parseWebPage = (content, keepLink=false, host) => {
	if (!content) return '';
	content = simplyParseHTML(content, host);
	var container = newEle('section');
	container.style.display = 'none';
	container.innerHTML = content;
	content = getPageContent(container, keepLink);
	container.innerHTML = '';
	container = null;
	return content;
};
const downloadConversation = async () => {
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];

	var gid = currentTabId + ':crosspageConv';
	var conversation = await chrome.storage.session.get(gid);
	conversation = (conversation || {})[gid];
	if (!conversation) return;

	var name = messages.newTab.crossPageConversation;
	var model = myInfo.model;

	var markdown = ["#\t" + name];
	markdown.push('> AI: ' + model);
	markdown.push('\n-----\n');

	conversation.forEach(item => {
		if (item[0] === 'human') {
			markdown.push('##\t' + myInfo.name);
		}
		else if (item[0] === 'ai') {
			markdown.push('##\t' + messages.cypriteName);
		}
		else {
			return;
		}
		markdown.push(item[1]);
		markdown.push('-----');
	});
	markdown = markdown.join('\n\n');

	var blob = new Blob([markdown], { type: 'text/plain' });
	var link = URL.createObjectURL(blob);
	var downloader = newEle('a');
	downloader.setAttribute('href', link);
	downloader.setAttribute('download', 'conversation.md');
	downloader.click();

	Notification.show(messages.cypriteName, messages.crossPageConv.hintConversationDownloaded, 'middleTop', 'success', 2 * 1000);
};
const resizeCurrentInputter = () => {
	var container = document.body.querySelector('.panel_operation_area[group="' + currentMode + '"]');
	var inputter = container.querySelector('.input_container');
	var sender = container.querySelector('.input_sender');
	var content = container.querySelector('.content_container');
	if (!inputter || !sender || !content) return;
	onInputFinish(inputter, sender, content);
};
globalThis.afterChangeTab = async () => {
	if (currentMode === 'crossPageConversation') {
		await switchToXPageConv();
	}
	else if (currentMode === 'articleManager') {
		updateOrderType();
		await loadFileList();
	}

	resizeCurrentInputter();
};

/* XPageConv */

const switchToXPageConv = async () => {
	var container = document.body.querySelector('.panel_operation_area[group="' + currentMode + '"]');
	var content = container.querySelector('.content_container');
	var needShowArticleList = true;
	if (content.querySelectorAll('.chat_item').length <= 1) {
		let conversation = await chrome.storage.session.get(currentTabId + ':crosspageConv');
		conversation = (conversation || {})[currentTabId + ':crosspageConv'];
		if (!!conversation && !!conversation.length) {
			conversation.forEach(item => {
				if (item[0] === 'system') return;
				needShowArticleList = false;
				addChatItem('crossPageConversation', item[1], item[0] === 'ai' ? 'cyprite' : item[0], item[2], true);
			});
		}
	}
	else {
		needShowArticleList = false;
	}

	var list = cachedArticleList;
	if (!list) {
		list = await chrome.storage.local.get('cached_article_list')
		list = (list || {})['cached_article_list'];
	}
	if (!!list) {
		cachedArticleList = list;
		askSWandWait('GetArticleInfo', [true, OrderTypes[orderType]]).then(list => {
			cachedArticleList = list;
			chrome.storage.local.set({
				'cached_article_list': list
			});
		}).catch(err => {
			err = err.message || err.msg || err.data || err.toString();
			Notification.show(messages.cypriteName, err, "middleTop", 'error', 5 * 1000);
		});
	}
	else {
		try {
			list = await askSWandWait('GetArticleInfo', [true, OrderTypes[orderType]]);
			cachedArticleList = list;
			chrome.storage.local.set({
				'cached_article_list': list
			});
		}
		catch (err) {
			list = [];
			err = err.message || err.msg || err.data || err.toString();
			Notification.show(messages.cypriteName, err, "middleTop", 'error', 5 * 1000);
		}
	}

	var container = document.body.querySelector('.panel_article_list');
	if (!!list && !!list.length) {
		container.innerHTML = '';
		list.forEach(item => {
			var li = newEle('div', 'panel_article_list_item');
			li.url = item.url;
			var check = newEle('img');
			check.src = '/images/check.svg';
			li.appendChild(check);
			var title = newEle('span');
			title.innerText = item.title;
			li.appendChild(title);
			container.appendChild(li);
		});
	}
	else {
		let messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
		container.innerHTML = messages.crossPageConv.noArticle;
	}

	if (needShowArticleList) ActionCenter.showArticleChooser();
};
const prepareXPageConv = async (request) => {
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];

	var conversation = await chrome.storage.session.get(currentTabId + ':crosspageConv');
	conversation = (conversation || {})[currentTabId + ':crosspageConv'];

	// New conversation
	if (!conversation || !conversation.length) {
		CurrentArticleList.splice(0);
		let files = [];
		// For selected articles
		let items = [...document.body.querySelectorAll('.panel_article_list .panel_article_list_item[selected]')];
		if (items.length > 0) {
			items = items.map(item => item.url);
			try {
				items = await askSWandWait('GetArticleInfo', [items, OrderTypes[orderType]]);
			}
			catch (err) {
				items = [];
				logger.error('GetArticleInfo', err);
				err = err.message || err.msg || err.data || err.toString();
				Notification.show(messages.cypriteName, err, "middleTop", 'error', 5 * 1000);
			}
			files = items.map(item => {
				CurrentArticleList.push(item.url);
				return {
					title: item.title,
					url: item.url,
					content: item.content
				};
			});
			CurrentArticleList.sort((a, b) => a === b ? 0 : (a > b ? 1 : -1));
		}

		// If no article has already been selected or related
		if (files.length === 0) {
			let articles;
			try {
				articles = await askAIandWait('selectArticlesAboutConversation', request);
			}
			catch (err) {
				articles = [];
				logger.error('SelectArticles', err);
				err = err.message || err.msg || err.data || err.toString();
				Notification.show(messages.cypriteName, err, "middleTop", 'error', 5 * 1000);
			}
			if (!articles) articles = [];
			files = articles.map(item => {
				return {
					title: item.title,
					url: item.url,
					content: item.content
				};
			});
			if (files.length > 0) {
				let items = [...document.body.querySelectorAll('.panel_article_list .panel_article_list_item')];
				let messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
				let hint = ['**' + messages.crossPageConv.hintFoundArticles + '**\n'];
				files.forEach(item => {
					CurrentArticleList.push(item.url);
					hint.push('-\t[' + item.title + '](' + item.url + ')');
					items.some(li => {
						if (li.url !== item.url) return;
						li.setAttribute('selected', 'true');
						return true;
					});
				});
				addChatItem('crossPageConversation', hint.join('\n'), 'cyprite');
				CurrentArticleList.sort((a, b) => a === b ? 0 : (a > b ? 1 : -1));
			}
		}

		// Assemble SystemPrompt
		let config = { lang: LangName[myInfo.lang], related: '(No Reference Material)' };
		if (files.length > 0) {
			let content = [];
			files.forEach(item => {
				content.push('<currentArticle title="' + item.title + '" url="' + item.url + '">\n' + item.content.trim() + '\n</currentArticle>');
			});
			config.content = content.join('\n');
		}
		else {
			config.content = '(No Current Article)';
		}
		let systemPrompt = PromptLib.assemble(PromptLib.askPageSystem, config);
		conversation = [['system', systemPrompt]];
	}
	else {
		let articleList = [];
		let items = [...document.body.querySelectorAll('.panel_article_list .panel_article_list_item[selected]')];
		if (items.length > 0) {
			items.forEach(item => {
				articleList.push(item.url);
			});
			articleList.sort((a, b) => a === b ? 0 : (a > b ? 1 : -1));
		}
		// Selected articles have changed
		if (CurrentArticleList.join('|') !== articleList.join('|') && articleList.length > 0) {
			CurrentArticleList.splice(0);
			try {
				items = await askSWandWait('GetArticleInfo', [items.map(item => item.url), OrderTypes[orderType]]);
			}
			catch (err) {
				items = [];
				logger.error('GetArticleInfo', err);
				err = err.message || err.msg || err.data || err.toString();
				Notification.show(messages.cypriteName, err, "middleTop", 'error', 5 * 1000);
			}

			// Assemble SystemPrompt
			let config = { lang: LangName[myInfo.lang], related: '(No Reference Material)' };
			if (items.length > 0) {
				let content = [];
				items.forEach(item => {
					CurrentArticleList.push(item.url);
					content.push('<currentArticle title="' + item.title + '" url="' + item.url + '">\n' + item.content.trim() + '\n</currentArticle>');
				});
				config.content = content.join('\n');
				CurrentArticleList.sort((a, b) => a === b ? 0 : (a > b ? 1 : -1));
			}
			else {
				config.content = '(No Current Article)';
			}
			let systemPrompt = PromptLib.assemble(PromptLib.askPageSystem, config);
			conversation[0][1] = systemPrompt;
		}
	}
	conversation.push(['human', request]);

	return conversation;
};
const getDialogPair = (button) => {
	var container = button.parentNode.parentNode, cid = container.getAttribute('chatID'), group = [], ids = [];
	if (!cid) return;
	if (container.classList.contains('human')) {
		group.push(container);
		ids.push(cid);
		let ele = container.nextElementSibling;
		if (!ele) return;
		let id = ele.getAttribute('chatID');
		if (!id) return;
		group.push(ele);
		ids.push(id);
	}
	else {
		let ele = container.previousElementSibling;
		if (!ele) return;
		let id = ele.getAttribute('chatID');
		if (!id) return;
		group.push(ele);
		ids.push(id);
		group.push(container);
		ids.push(cid);
	}

	return [group, ids, container, cid];
};
ActionCenter.downloadConversation = () => {
	if (currentMode === 'crossPageConversation') {
		downloadConversation();
	}
};
EventHandler.updateCurrentStatus = (msg) => {
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
	if (!!curerntStatusMention) curerntStatusMention._hide();
	if (!!msg) curerntStatusMention = Notification.show(messages.cypriteName, msg, 'middleTop', 'mention', 24 * 3600 * 1000);
	else curerntStatusMention = null;
};
EventHandler.finishFirstTranslation = (content) => {
	addChatItem('instantTranslation', content, 'cyprite', null, true);
};

/* AISearch */

var isAISearching = false;
const WebpageReadLock = new PoolWaitLock(MaximumConcurrentWebpageReading);
const searchWebPage = async (keywords, title, mention, logName, messages) => {
	logger.info('Search: ' + logName, keywords.join('; '));
	var notify = Notification.show(title, mention, 'middleTop', 'mention', 24 * 3600 * 1000);

	var results = {};
	await Promise.all(keywords.map(async keyword => {
		var result = await getCachedInformation('GoogleSearch', keyword);
		if (!result) {
			try {
				result = await askSWandWait('SearchGoogle', keyword);
				if (!isArray(result)) {
					result = [];
				}
				else if (result.length > 0) {
					await setCachedInformation('GoogleSearch', keyword, [...result]);
				}
			}
			catch (err) {
				logger.error('Search: ' + logName, err);
				result = [];
				err = err.message || err.msg || err.data || err.toString();
				Notification.show(messages.cypriteName, err, "middleTop", 'error', 5 * 1000);
			}
		}
		else {
			logger.blank('UseCachedGoogleSearchResult', keyword);
			result = [...result];
		}
		result.forEach(item => {
			var line = results[item.url];
			if (!line) {
				results[item.url] = item;
			}
			else {
				line.summary = line.summary + '\n\n' + item.summary;
			}
		});
	}));

	var urls = Object.keys(results);
	urls.sort((ua, ub) => {
		var la = (results[ua].summary || '').length;
		var lb = (results[ub].summary || '').length;
		return lb - la;
	});
	if (urls.length > SearchMaxCount) {
		urls.splice(SearchMaxCount);
	}
	var final = {};
	urls.forEach(url => final[url] = results[url]);

	notify._hide();
	logger.info('Search: ' + logName, 'Result: ' + Object.keys(final).length);

	return final;
};
const searchByLLM = async (messages, quest) => {
	var notify = Notification.show(messages.cypriteName, messages.aiSearch.hintCallingOtherLLMToSearch, 'middleTop', 'mention', 24 * 3600 * 1000);
	var timeused = Date.now();

	var result = await getCachedInformation('LLMSearch', quest);
	if (!result) {
		try {
			result = await askAIandWait('callLLMForSearch', quest);
			if (!isArray(result)) {
				result = [];
			}
			else {
				await setCachedInformation('LLMSearch', quest, [...result]);
			}
		}
		catch (err) {
			result = [];
			logger.error('LLMSearch', err);
			Notification.show(messages.cypriteName, err.message || err.msg || err.data || err.toString(), "middleTop", 'error', 5 * 1000);
		}
	}
	else {
		logger.blank('UseCachedLLMSearchResult', quest);
		result = [...result];
	}

	notify._hide();
	timeused = Date.now() - timeused;
	logger.info('LLMSearch', 'timeused: ' + timeused + 'ms, count: ' + result.length);

	return result;
};
const filterAndShowSearchRsult = async (resultSearch, searchResults, extraList, keywords, request, shouldFold=false, isFullAnalyze=false, messages) => {
	var notify = Notification.show(messages.cypriteName, messages.aiSearch.msgFilteringWebPagesTask, 'middleTop', 'mention', 24 * 3600 * 1000);

	// Don't read file in front end
	var readables = Object.values(searchResults).filter(item => {
		var url = parseURL(item.url);
		return !url.match(/\.(pdf|doc|docx|ps|tar|gz|zip|rar|png|jpg|jpeg|gif|bmp|mp3|m4a|mp4|mv)$/i);
	});

	// Filter Webpages
	var webPages = await filterSearchResult(readables, request, 100, messages);
	// Append webpages from other sources
	if (!!extraList && !!extraList.length) {
		webPages = [...extraList, ...webPages];
	}
	if (webPages.length === 0) {
		notify._hide();
		return [];
	}
	webPages.sort((wpa, wpb) => (wpb.summary || '').length - (wpa.summary || '').length);

	// Show search result
	showGoogleSearchResult(resultSearch, messages, keywords, webPages, searchResults, shouldFold);

	notify._hide();

	// Reading WebPages
	if (isFullAnalyze) {
		webPages = await readAndReplyWebpages(webPages, request, messages);
	}

	return webPages;
};
const listAndReadArxivResult = async (frame, arxivResults, keywords, request, shouldFold=false, isFullAnalyze=false, messages) => {
	var notify = Notification.show(messages.cypriteName, messages.aiSearch.msgReadingArxivSummary, 'middleTop', 'mention', 24 * 3600 * 1000);

	var webPages = Object.values(arxivResults);
	if (webPages.length === 0) {
		notify._hide();
		return [];
	}
	webPages.sort((wpa, wpb) => (wpb.summary || '').length - (wpa.summary || '').length);

	// Show Article List
	showOtherSearchResult(frame, messages, messages.aiSearch.hintArxivResult, keywords, webPages, shouldFold);

	notify._hide();

	// Reading Articles
	if (isFullAnalyze) {
		if (webPages.length > ArxivMaxForDeepThinking) webPages.splice(ArxivMaxForDeepThinking);
		webPages = await readAndReplyWebpages(webPages, request, messages);
	}

	return webPages;
};
const filterAndReadWikipediaResult = async (frame, wikipediaResults, keywords, request, shouldFold=false, isFullAnalyze=false, messages) => {
	var notify = Notification.show(messages.cypriteName, messages.aiSearch.msgReadingWikipediaEntries, 'middleTop', 'mention', 24 * 3600 * 1000);

	// Filter Webpages
	var webPages = await filterSearchResult(wikipediaResults, request, 10, messages);
	if (webPages.length === 0) {
		notify._hide();
		return [];
	}
	webPages.sort((wpa, wpb) => (wpb.summary || '').length - (wpa.summary || '').length);

	// Show Article List
	showOtherSearchResult(frame, messages, messages.aiSearch.hintWikipediaResult, keywords, webPages, shouldFold);

	notify._hide();

	// Reading Articles
	if (isFullAnalyze) {
		if (webPages.length > WikiPediaMaxForDeepThinking) webPages.splice(WikiPediaMaxForDeepThinking);
		webPages = await readAndReplyWebpages(webPages, request, messages);
	}

	return webPages;
};
const showGoogleSearchResult = (frame, messages, keywords, most, all, shouldFold=false) => {
	var hint = newEle('div', 'search_result_title');
	var list = newEle('ul', 'search_result_list');
	if (shouldFold) {
		hint.classList.add('foldhint');
		hint.innerText = messages.aiSearch.hintSearchResult + ' (' + most.length + ')';
		list.classList.add('foldable');
	}
	else {
		hint.innerText = messages.aiSearch.hintSearchResult;
	}
	frame.appendChild(hint);
	var used = [];
	if (!most || !most.length) {
		list.innerHTML = '<li class="search_result_item">' + messages.summarizeArticle.noRelatedArticle + '</li>';
	}
	else {
		most.forEach(item => {
			var li = newEle('li', 'search_result_item');
			var link = newEle('a');
			link.href = item.url;
			link.target = "_blank";
			link.innerText = item.title.replace(/[\r\n]+/g, ' ');
			li.appendChild(link);
			list.appendChild(li);
			used.push(item.url);
		});
	}
	frame.appendChild(list);

	// Show Search Keywords
	hint = newEle('div', 'search_result_title');
	list = newEle('ul', 'search_result_list');
	if (shouldFold) {
		hint.classList.add('foldhint');
		hint.innerText = messages.aiSearch.hintViceSearchResult + ' (' + all.length + ')';
		list.classList.add('foldable');
	}
	else {
		hint.innerText = messages.aiSearch.hintViceSearchResult;
	}
	frame.appendChild(hint);
	for (let kw of keywords) {
		let li = newEle('li', 'search_result_item');
		let link = newEle('a');
		link.href = `https://www.google.com/search?q=${kw}&hl=en-US&start=0&num=10&ie=UTF-8&oe=UTF-8&gws_rd=ssl`;;
		link.target = "_blank";
		link.innerText = messages.aiSearch.hintKeywords + kw;
		li.appendChild(link);
		list.appendChild(li);
	}

	// Show Search Result
	var count = 0;
	for (let url in all) {
		if (used.includes(url)) continue;
		let item = all[url];
		let li = newEle('li', 'search_result_item');
		let link = newEle('a');
		link.href = item.url;
		link.target = "_blank";
		link.innerText = item.title.replace(/[\r\n]+/g, ' ');
		li.appendChild(link);
		list.appendChild(li);
		count ++;
		if (count >= 15) break;
	}
	if (count === 0) {
		let li = newEle('li', 'search_result_item');
		li.innerText = messages.summarizeArticle.noRelatedArticle;
		list.appendChild(li);
	}
	frame.appendChild(list);
	frame.scrollIntoViewIfNeeded();
};
const showOtherSearchResult = (frame, messages, title, keywords, webPages, shouldFold=false) => {
	var hint = newEle('div', 'search_result_title');
	var list = newEle('ul', 'search_result_list');
	if (shouldFold) {
		hint.classList.add('foldhint');
		list.classList.add('foldable');
	}
	frame.appendChild(hint);
	// Show Search Keywords
	for (let kw of keywords) {
		let li = newEle('li', 'search_result_item');
		let link = newEle('a');
		link.href = `https://www.google.com/search?q=${kw}&hl=en-US&start=0&num=10&ie=UTF-8&oe=UTF-8&gws_rd=ssl`;;
		link.target = "_blank";
		link.innerText = messages.aiSearch.hintKeywords + kw;
		li.appendChild(link);
		list.appendChild(li);
	}
	// Show Search Result
	for (let item of webPages) {
		let li = newEle('li', 'search_result_item');
		let link = newEle('a');
		link.href = item.url;
		link.target = "_blank";
		link.innerText = item.title.replace(/[\r\n]+/g, ' ');
		li.appendChild(link);
		list.appendChild(li);
	}
	if (shouldFold) {
		hint.innerText = title + ' (' + webPages.length + ')';
	}
	else {
		hint.innerText = title;
	}
	frame.appendChild(list);
	frame.scrollIntoViewIfNeeded();
};
const showReferences = (list, messages) => {
	var refs = newEle('hr');
	aiSearchInputter.referencePanel.appendChild(refs);

	refs = newEle('h3');
	refs.innerText = messages.aiSearch.hintReference;
	aiSearchInputter.referencePanel.appendChild(refs);

	refs = newEle('ul', 'reference_area');
	list.forEach(item => {
		var li = newEle('li', 'reference_item');
		li._data = item;
		var inner = newEle('div', 'reference_frame');

		var cover = newEle('img', 'reference_logo');
		cover.src = item.cover || '/images/cyprite.png';
		cover.onerror = (err) => {
			cover.src = '/images/cyprite.png';
		};
		inner.appendChild(cover);
		li.appendChild(inner);
		var title = newEle('div', 'reference_title');
		title.innerText = item.title.replace(/[\n\r]+/g, ' ');
		li.appendChild(title);

		var float = newEle('div', 'reference_float');

		title = newEle('div', 'reference_float_title');
		title.innerText = item.title.replace(/[\n\r]+/g, ' ');
		float.appendChild(title);
		inner = newEle('div', 'reference_float_desc');
		inner.innerText = item.summary.length > 200 ? item.summary.substring(0, 198) + '......' : item.summary;
		float.appendChild(inner);
		li.appendChild(float);

		refs.appendChild(li);
	});
	aiSearchInputter.referencePanel.appendChild(refs);
};
const filterSearchResult = async (webPageList, request, limit, messages) => {
	var readList;
	if (isArray(webPageList)) {
		readList = [...webPageList];
	}
	else if (isObject(webPageList)) {
		readList = Object.values(webPageList);
	}
	else {
		return [];
	}
	if (readList.length === 0) return [];

	// Filter Webpages
	var results;
	try {
		results = await askAIandWait('findRelativeWebPages', {
			requests: [request],
			articles: readList,
			isWebPage: true,
			limit,
		});
		results = results || [];
	}
	catch (err) {
		results = [];
		logger.error('FindRelativePage', err);
		err = err.message || err.msg || err.data || err.toString();
		Notification.show(messages.cypriteName, err, "middleTop", 'error', 5 * 1000);
	}

	return results;
};
const readAndReplyWebpages = async (webPages, request, messages) => {
	var notify = Notification.show(messages.cypriteName, messages.aiSearch.msgReadingWebPage, 'middleTop', 'mention', 24 * 3600 * 1000);

	await Promise.all(webPages.map(async (item, idx) => {
		await wait(idx * 50); // Interleave all read requests

		await WebpageReadLock.start();
		if (webpageReaded >= MaximumWebpageRead) {
			WebpageReadLock.finish();
			return;
		}

		var data = await getCachedInformation('PageContent', item.url);
		if (!!data) {
			logger.blank('UseCachedPageContent', item.url);
			item.content = data;
		}
		else {
			try {
				if (item.url.match(/arxiv\.org\//i)) {
					if (item.url.match(/arxiv\.org\/html/i)) {
						data = await askSWandWait('ReadWebPage', item.url);
					}
					else {
						let url = item.url.replace(/arxiv\.org\/[^\/]+\//i, 'arxiv.org/html/');
						try {
							data = await askSWandWait('ReadWebPage', url);
							let parsed = parseArxivAbstract(data, url).content || 'no html for';
							if (!!parsed.match(/no html for/i) && !!parsed.match(/^skip to main/i)) {
								data = null;
							}
						}
						catch (err) {
							logger.error('ARXIV|HTML', err);
							data = null;
						}
						if (!data) {
							url = item.url.replace(/arxiv\.org\/[^\/]+\//i, 'arxiv.org/abs/');
							try {
								data = await askSWandWait('ReadWebPage', url);
							}
							catch (err) {
								logger.error('ARXIV|ABS', err);
								data = null;
							}
							if (!data) {
								data = await askSWandWait('ReadWebPage', item.url);
							}
						}
					}
				}
				else {
					data = await askSWandWait('ReadWebPage', item.url);
				}
			}
			catch (err) {
				data = '';
				err = err.message || err.msg || err.data || err.toString();
				Notification.show(messages.cypriteName, err, "middleTop", 'error', 5 * 1000);
			}
			if (!!data) {
				if (item.url.match(/arxiv\.org/i)) {
					let url = item.url;
					url = url.replace(/arxiv\.org\/pdf/i, 'arxiv.org/abs');
					data = parseArxivAbstract(data, url);
					if (!!data.title && !item.title) item.title = data.title;
					item.content = data.content || item.summary || "";
				}
				else if (item.url.match(/wikipedia\.org/i)) {
					item.content = parseWikiContent(data, false, item.url) || "";
				}
				else {
					item.content = parseWebPage(data, false, item.url) || "";
				}
			}
			if (!!item.content) {
				await setCachedInformation('PageContent', item.url, item.content);
			}
			else {
				item.content = item.summary;
			}

			let image = item.content.match(/\!\[[^\]\n\r]*\]\(([^\)\n\r]+)\)/);
			if (!!image) {
				image = image[1];
				if (!!image) {
					item.cover = image;
				}
			}
		}

		item.reply = (await replyOnWebpage(item.title, item.content, request)) || '';
		if (!!item.reply) webpageReaded ++;

		WebpageReadLock.finish();
	}));

	webPages = webPages.filter(item => !!item.reply);
	notify._hide();

	return webPages;
};
const replyOnWebpage = async (title, content, request) => {
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
	var notify = Notification.show(messages.cypriteName, messages.aiSearch.msgReadingArticle + title, 'middleTop', 'mention', 24 * 3600 * 1000);
	var reply;
	try {
		reply = await askAIandWait('raedAndReply', {content, request});
		logger.log('ReadPage&Reply', title.replace(/\s+/gi, ' '));
		console.log(reply);
	}
	catch (err) {
		logger.error('ReadPage&Reply', err);
		reply = '';
		err = err.message || err.msg || err.data || err.toString();
		Notification.show(messages.cypriteName, err, "middleTop", 'error', 5 * 1000);
	}
	notify._hide();

	return reply || '';
};
const getSearchRequestList = async () => {
	var history = await chrome.storage.local.get("searchHistory");
	if (!history) return [];
	history = history.searchHistory;
	if (!history) return [];
	return history;
};
const analyzeSearchKeywords = async (messages, quest) => {
	var notify = Notification.show(messages.cypriteName, messages.aiSearch.msgAnaylzeSearchTask, 'middleTop', 'mention', 24 * 3600 * 1000);
	var timeused = Date.now();

	var result;
	try {
		result = await askAIandWait('getSearchKeyWord', quest);
		notify._hide();
	}
	catch (err) {
		logger.error('SearchKeywords', err);
		result = {};
		notify._hide();
		err = err.message || err.msg || err.data || err.toString();
		Notification.show(messages.cypriteName, err.message || err.msg || err.data || err.toString(), "middleTop", 'error', 5 * 1000);
	}
	result.search = result.search || [];
	result.search.unshift(quest); // Add the original question to the search in hopes of finding more useful web pages.

	logger.info('SearchKeywords', result.analyze);
	logger.info('SearchKeywords', 'timeused: ' + (Date.now() - timeused) + 'ms');

	if (myInfo.searchMode !== 'keywordOnly') return result;

	var list = [];
	if (!!result.search && !!result.search.length) {
		list.push(...result.search);
	}
	if (!!result.arxiv && !!result.arxiv.length) {
		result.arxiv = result.arxiv.map(kw => kw + ' site:arxiv.org');
		list.push(...result.arxiv);
	}
	if (!!result.wikipedia && !!result.wikipedia.length) {
		result.wikipedia = result.wikipedia.map(kw => kw + ' site:wikipedia.org');
		list.push(...result.wikipedia);
	}

	aiSearchInputter.answerPanelHint.innerText = messages.aiSearch.hintSearchKeywordList;
	var container = newEle('ul');
	list.forEach(keyword => {
		var line = newEle('li');
		var link = newEle('a');
		link.href = `https://www.google.com/search?q=${keyword}&hl=en-US&start=0&num=10&ie=UTF-8&oe=UTF-8&gws_rd=ssl`;
		link.target = '_blank';
		link.innerText = keyword;
		line.appendChild(link);
		container.appendChild(line);
	});
	aiSearchInputter.answerPanel.appendChild(container);

	await wait(10);
	aiSearchInputter.answerPanel.scrollIntoViewIfNeeded();
	await wait(10);
	aiSearchInputter.answerPanelHint.scrollIntoViewIfNeeded();

	aiSearchInputter.setAttribute('contentEditable', 'true');

	return result;
};
const searchWebpageFromInternet = async (messages, quest) => {
	var searchInfo = await analyzeSearchKeywords(messages, quest); // Analyze Search Keywords

	var tasks = [];
	// Search Google
	if (UseSearch && !!searchInfo.search && !!searchInfo.search.length) {
		tasks.push(searchWebPage(searchInfo.search, messages.cypriteName, messages.aiSearch.msgSearchingWebPagesTask, 'Google', messages));
	}
	else {
		searchInfo.search = [];
		tasks.push({});
	}
	if (UseSearch && !!searchInfo.arxiv && !!searchInfo.arxiv.length) {
		searchInfo.arxiv = searchInfo.arxiv.map(kw => kw + ' site:arxiv.org');
		tasks.push(searchWebPage(searchInfo.arxiv, messages.cypriteName, messages.aiSearch.msgSearchingArxivTask, 'ARXIV', messages));
	}
	else {
		searchInfo.arxiv = []
		tasks.push({});
	}
	if (UseSearch && !!searchInfo.wikipedia && !!searchInfo.wikipedia.length) {
		searchInfo.wikipedia = searchInfo.wikipedia.map(kw => kw + ' site:wikipedia.org');
		tasks.push(searchWebPage(searchInfo.wikipedia, messages.cypriteName, messages.aiSearch.msgSearchingWikipediaTask, "WIKI", messages));
	}
	else {
		searchInfo.wikipedia = [];
		tasks.push({});
	}
	var [searchResults, arxivResults, wikipediaResults] = await Promise.all(tasks);

	// Decompose the search results
	for (let url in searchResult) {
		if (url.match(/arxiv\.org/i)) {
			if (!arxivResults[url]) {
				arxivResults[url] = searchResults[url];
			}
			delete searchResults[url];
		}
		else if (url.match(/wikipedia\.org/i)) {
			if (!wikipediaResults[url]) {
				wikipediaResults[url] = searchResults[url];
			}
			delete searchResults[url];
		}
	}

	var searchResult = {
		search: searchResults,
		arxiv: arxivResults,
		wikipedia: wikipediaResults,
	};

	return [searchInfo, searchResult];
};
const searchDocumentLocally = async (messages, quest) => {
	var notify = Notification.show(messages.cypriteName, messages.aiSearch.msgSearchingLocalArticle, 'middleTop', 'mention', 24 * 3600 * 1000);
	var articles;
	try {
		articles = await askAIandWait('selectArticlesAboutConversation', quest);
		articles = articles || [];
	}
	catch (err) {
		articles = [];
	}
	notify._hide();

	// Show Article List
	if (articles.length > 0) {
		let hint = newEle('div', 'search_result_title', 'foldhint');
		hint.innerText = messages.aiSearch.hintLocalResult + ' (' + articles.length + ')';
		aiSearchInputter.resultLocal.appendChild(hint);
		let list = newEle('ul', 'search_result_list', 'foldable');
		for (let item of articles) {
			let li = newEle('li', 'search_result_item');
			let link = newEle('a');
			link.href = item.url;
			link.target = "_blank";
			link.innerText = item.title.replace(/[\r\n]+/g, ' ');
			li.appendChild(link);
			list.appendChild(li);
		}
		aiSearchInputter.resultLocal.appendChild(list);
		aiSearchInputter.resultLocal.scrollIntoViewIfNeeded();
	}

	return articles;
};
const searchInformationByKeywrods = async (messages, quest, shouldFold=false, isFull=false) => {
	var notify = Notification.show(messages.cypriteName, messages.aiSearch.msgSearchingWebPagesTask, 'middleTop', 'mention', 24 * 3600 * 1000);
	var timeused = Date.now();

	var [searchInfo, localArticles, llmResults] = await Promise.all([
		searchWebpageFromInternet(messages, quest),
		isFull ? searchDocumentLocally(messages, quest) : [],
		searchByLLM(messages, quest)
	]);
	var searchResult = searchInfo[1];
	searchInfo = searchInfo[0];

	// Remove webpage which has been cached locally
	for (let url in searchResult.search) {
		let has = localArticles.some(art => art.url === url) || llmResults.some(item => item.url === url);
		if (has) delete searchResult.search[url];
	}
	for (let url in searchResult.arxiv) {
		let has = localArticles.some(art => art.url === url) || llmResults.some(item => item.url === url);
		if (has) delete searchResult.arxiv[url];
	}
	for (let url in searchResult.wikipedia) {
		let has = localArticles.some(art => art.url === url) || llmResults.some(item => item.url === url);
		if (has) delete searchResult.wikipedia[url];
	}
	searchResult.search = Object.values(searchResult.search);
	searchResult.arxiv = Object.values(searchResult.arxiv);
	searchResult.wikipedia = Object.values(searchResult.wikipedia);
	logger.info('SearchInformation', 'Search Results:');
	console.log(localArticles);
	console.log(llmResults);
	console.log(searchResult.search);
	console.log(searchResult.arxiv);
	console.log(searchResult.wikipedia);
	notify._hide();

	// Show search result and read web pages
	tasks = [];
	webpageReaded = 0;
	if (Object.keys(searchResult.arxiv).length > 0) tasks.push(listAndReadArxivResult(aiSearchInputter.resultArxiv, searchResult.arxiv, searchInfo.arxiv, quest, shouldFold, isFull, messages));
	else tasks.push([]);
	if (Object.keys(searchResult.wikipedia).length > 0) tasks.push(filterAndReadWikipediaResult(aiSearchInputter.resultWikipedia, searchResult.wikipedia, searchInfo.wikipedia, quest, shouldFold, isFull, messages));
	else tasks.push([]);
	if (Object.keys(searchResult.search).length + llmResults.length > 0) tasks.push(filterAndShowSearchRsult(aiSearchInputter.resultSearch, searchResult.search, llmResults, searchInfo.search, quest, shouldFold, isFull, messages));
	else tasks.push([]);
	var [arxivResults, wikipediaResults, searchResults] = await Promise.all(tasks);

	logger.info('SearchInformation', 'timeused: ' + (Date.now() - timeused) + 'ms');

	return {
		search: searchResults,
		arxiv: arxivResults,
		wikipedia: wikipediaResults,
	};
};
const replyQuestBySearchResult = async (messages, quest) => {
	var {search, arxiv, wikipedia} = await searchInformationByKeywrods(messages, quest, true);
	var readList = [...search, ...arxiv, ...wikipedia];
	readList = readList.filter(item => !!item.summary);

	var notify = Notification.show(messages.cypriteName, messages.aiSearch.msgAnswering, 'middleTop', 'mention', 24 * 3600 * 1000), answer, moreList;
	try {
		answer = await askAIandWait('replyBasedOnSearch', {
			request: quest,
			webpages: readList,
		});
		moreList = answer.more || [];
		if (!!answer) {
			answer = answer.reply._origin || answer.reply;
		}
		answer = answer || messages.aiSearch.msgEmptyAnswer;
	}
	catch (err) {
		logger.error('replyBasedOnSearch', err);
		moreList = [];
		answer = messages.aiSearch.msgEmptyAnswer;
		Notification.show(messages.cypriteName, err.message || err.msg || err.data || err.toString(), "middleTop", 'error', 5 * 1000);
	}

	// Show Answer
	searchResult = answer;
	aiSearchInputter.answerPanelHint.innerText = messages.aiSearch.hintAnswering;
	aiSearchInputter.answerPanelHint.innerHTML = aiSearchInputter.answerPanelHint.innerHTML + '<img button="true" action="copySearchResult" src="../images/copy.svg">'
	parseMarkdownWithOutwardHyperlinks(aiSearchInputter.answerPanel, answer, messages.aiSearch.msgEmptyAnswer);
	[...document.querySelectorAll('.content_container .result_panel .foldable')].forEach(ui => ui.classList.add('folded'));
	[...document.querySelectorAll('.content_container .result_panel .foldhint')].forEach(ui => ui.classList.add('folded'));

	// Show More Question
	showMoreQuestions(moreList);

	// Further Conversation
	var conversationOption = {
		name: myInfo.name,
		aboutMe: myInfo.info,
	};
	conversationOption.webpages = readList.map(item => {
		var article = ['<webpage>'];
		article.push('<title>' + item.title.replace(/\s+/g, ' ') + '</title>');
		article.push('<url>' + item.url + '</title>');
		article.push('<summary>');
		article.push(item.summary);
		article.push('</summary>');
		article.push('</webpage>');
		return article.join('\n');
	}).join('\n\n');
	advSearchConversation = [];
	advSearchConversation.push(['system', PromptLib.assemble(PromptLib.preliminaryThinkingContinueSystem, conversationOption)]);
	advSearchConversation.push(['human', quest]);
	advSearchConversation.push(['ai', answer]);
	document.body.querySelector('.furthure_dialog').style.display = 'block';
	resizeCurrentInputter();

	notify._hide();
	wait(100).then(() => {
		aiSearchInputter.answerPanel.scrollIntoViewIfNeeded();
	});
};
const showMoreQuestions = (moreList) => {
	if (!moreList || !moreList.length) return;

	var line = newEle('hr');
	aiSearchInputter.morequestionPanel.appendChild(line);

	var mqList = newEle('ul', 'search_result_list', 'more_question');
	moreList.forEach(question => {
		var li = newEle('li', 'search_result_item', 'more_question');
		li.innerText = question;
		li._question = question;
		mqList.appendChild(li);
	});
	aiSearchInputter.morequestionPanel.appendChild(mqList);
};
ActionCenter.changeMode = async (button) => {
	var mode = button.getAttribute('mode');
	var ele = aiSearchInputter.parentNode.querySelector('.mode_chooser > li[checked]');
	if (!!ele) ele.removeAttribute('checked');
	chrome.storage.local.set({searchMode: mode});
	ele = aiSearchInputter.parentNode.querySelector('.mode_chooser > li[mode="' + mode + '"]');
	ele.setAttribute('checked', 'true');
	myInfo.searchMode = mode;
};
ActionCenter.startAISearch = async () => {
	if (isAISearching) return;
	isAISearching = true;

	[...aiSearchInputter.querySelectorAll('*')].forEach(ele => ele.removeAttribute('style'));

	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];

	var content = getPageContent(aiSearchInputter, true);
	if (!content) {
		Notification.show(messages.cypriteName, messages.aiSearch.msgEmptyRequest, 'middleTop', 'warn', 5 * 1000);
		isAISearching = false;
		return;
	}

	// Init UI
	aiSearchInputter.resultLocal.innerHTML = '';
	aiSearchInputter.resultWikipedia.innerHTML = '';
	aiSearchInputter.resultArxiv.innerHTML = '';
	aiSearchInputter.resultSearch.innerHTML = '';
	aiSearchInputter.answerPanel.innerHTML = '';
	aiSearchInputter.answerPanelHint.innerHTML = '';
	aiSearchInputter.referencePanel.innerHTML = '';
	aiSearchInputter.morequestionPanel.innerHTML = '';
	aiSearchInputter.removeAttribute('contentEditable');
	if (!!ntfDeepThinking) {
		ntfDeepThinking._hide();
		ntfDeepThinking = null;
	}

	// Update Search History and Further Conversation
	advSearchConversation = null;
	[...document.body.querySelectorAll('[group="intelligentSearch"] .chat_item')].forEach(item => {
		item.parentNode.removeChild(item);
	});
	document.body.querySelector('.furthure_dialog').style.display = 'none';
	document.body.querySelector('.search_history').style.display = 'none';
	getSearchRequestList().then(list => {
		content = content.trim();

		var idx = list.indexOf(content);
		if (idx === 0) {
			return;
		}
		else if (idx > 0) {
			list.splice(idx, 1);
		}
		list.unshift(content);
		if (list.length > SearchHistoryCount) {
			list.splice(10);
		}
		chrome.storage.local.set({searchHistory: list});
	});

	var timeused = Date.now();
	if (myInfo.searchMode === 'keywordOnly') {
		await analyzeSearchKeywords(messages, content);
	}
	else if (myInfo.searchMode === 'searchOnly') {
		await searchInformationByKeywrods(messages, content);
	}
	else if (myInfo.searchMode === 'fullAnswer') {
		await replyQuestBySearchResult(messages, content);
	}
	else if (myInfo.searchMode === 'fullAnalyze') {
		await replyQuestByFullyAnalyze(messages, content);
	}
	timeused = Date.now() - timeused;
	logger.log('AISearch[' + myInfo.searchMode + ']', 'Time Used: ' + timeused + 'ms');

	aiSearchInputter.setAttribute('contentEditable', 'true');
	isAISearching = false;
};
ActionCenter.chooseQuestion = (host, data, evt) => {
	var target = evt.target;
	if (!target.classList.contains('more_question')) return;
	if (!target._question) return;
	if (!advSearchConversation) {
		aiSearchInputter.innerText = target._question;
		aiSearchInputter.scrollIntoViewIfNeeded();
		aiSearchInputter.focus();
	}
	else {
		let inputter = document.querySelector('[group="intelligentSearch"] .furthure_dialog .input_container');
		inputter.innerText = target._question;
		inputter.focus();
	}
};
EventHandler.updateDeepThinkingStatus = (msg) => {
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
	if (!!ntfDeepThinking) ntfDeepThinking._hide();
	ntfDeepThinking = Notification.show(messages.cypriteName, msg, 'middleTop', 'mention', 24 * 3600 * 1000);
};
ActionCenter.switchFold = (host, data, {target}) => {
	if (!target) return;
	if (target.classList.contains('foldhint')) {
		let next = target.nextElementSibling;
		if (!next || !next.classList.contains('foldable')) return;
		if (next.classList.contains('folded')) {
			next.classList.remove('folded');
			target.classList.remove('folded');
		}
		else {
			next.classList.add('folded');
			target.classList.add('folded');
		}
	}
	else if (target.classList.contains('foldable')) {
		let hint = target.previousElementSibling;
		if (target.classList.contains('folded')) {
			target.classList.remove('folded');
			hint.classList.remove('folded');
		}
		else {
			target.classList.add('folded');
			hint.classList.add('folded');
		}
	}
};

/* File Managerment */

const updateOrderType = () => {
	var types = document.querySelectorAll('.panel_operation_area .caption .small.order');
	[...types].forEach(ele => {
		ele.classList.remove('selected');
	});
	types = document.querySelector('.panel_operation_area .caption .small.order[orderType="' + orderType + '"]');
	types.classList.add('selected');
};
const loadFileList = async () => {
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
	var container = document.body.querySelector('.articleManagerFileList');
	container.innerHTML = '';

	var notify = Notification.show(messages.cypriteName, messages.fileManager.loadingList, 'middleTop', 'message', 24 * 3600 * 1000);
	try {
		list = await askSWandWait('GetArticleInfo', [false, OrderTypes[orderType]]);
	}
	catch (err) {
		logger.error('LoadFileList', err);
		list = [];
		err = err.message || err.msg || err.data || err.toString();
		Notification.show(messages.cypriteName, err, "middleTop", 'error', 5 * 1000);
	}

	list.forEach(item => {
		var li = newEle('li', 'file_item');
		var link = newEle('a');
		link.href = item.url;
		link.target = '_blank';
		link.innerText = item.title.replace(/\s+/g, ' ');
		li.appendChild(link);

		if (!!item.hash) {
			btn = newEle('img');
			btn.src = '../images/memory.svg';
			btn.title = messages.fileManager.imgHasHash;
			li.appendChild(btn);
		}
		if (!!item.content) {
			btn = newEle('img');
			btn.src = '../images/layer-group.svg';
			btn.title = messages.fileManager.imgHasVector;
			li.appendChild(btn);
		}
		if (!!item.cached) { // for local files
			btn = newEle('img');
			btn.src = '../images/database.svg';
			btn.title = messages.fileManager.imgHasContent;
			li.appendChild(btn);
		}

		var operatorBar = newEle('div', 'operator_bar'), btn;
		btn = newEle('img', 'button');
		btn.src = '../images/feather.svg';
		btn.title = messages.fileManager.removeCache;
		btn.setAttribute('target', parseURL(item.url));
		btn.setAttribute('action', 'modify');
		operatorBar.appendChild(btn);

		btn = newEle('img', 'button');
		btn.src = '../images/trash-can.svg';
		btn.title = messages.fileManager.removeCache;
		btn.setAttribute('target', parseURL(item.url));
		btn.setAttribute('action', 'remove');
		operatorBar.appendChild(btn);

		li.appendChild(operatorBar);
		container.appendChild(li);
	});
	var caption = container.parentNode.querySelector('.caption .count');
	caption.innerText = '(' + list.length + ')';
	notify._hide();
};
const onClickFileItemOperator = async ({target}) => {
	if (!target.classList.contains('button')) return;
	var url = target.getAttribute('target');
	if (!url) return;
	var action = target.getAttribute('action');
	if (!action) return;

	var container = target.parentNode.parentNode;
	if (action === 'remove') {
		try {
			await askSWandWait('RemovePageInfo', url);
		}
		catch (err) {
			logger.error('RemovePageInfo', err);
			err = err.message || err.msg || err.data || err.toString();
			Notification.show(messages.cypriteName, err, "middleTop", 'error', 5 * 1000);
		}
		container.parentNode.removeChild(container);
	}
	else if (action === 'modify') {
		container.classList.add('editing');
		let onKey = async evt => {
			if (evt.key === 'Escape') {
				link.innerText = originTitle;
				link.href = url;
				link.removeAttribute('contentEditable');
				link.removeEventListener('keydown', onKey);
				container.classList.remove('editing');
				evt.preventDefault();
				evt.stopPropagation();
				evt.cancelBubble = true;
			}
			else if (evt.key === 'Enter') {
				let title = link.textContent.trim();
				link.innerText = title;
				let messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
				let notify = Notification.show(messages.cypriteName, messages.fileManager.msgModifyingFileTitle, 'middleTop', 'message', 24 * 3600 * 1000);
				try {
					await askSWandWait('ChangePageTitle', {url, title});
				}
				catch (err) {
					logger.error('ChangePageTitle', err);
					err = err.message || err.msg || err.data || err.toString();
					Notification.show(messages.cypriteName, err, "middleTop", 'error', 5 * 1000);
				}
				link.innerText = title;
				notify._hide();
				link.href = href;
				link.removeAttribute('contentEditable');
				link.removeEventListener('keydown', onKey);
				container.classList.remove('editing');
				evt.preventDefault();
				evt.stopPropagation();
				evt.cancelBubble = true;
			}
		};
		let link = container.querySelector('a');
		let href = link.href;
		let originTitle = link.textContent;
		link.removeAttribute('href');
		link.contentEditable = true;
		link.addEventListener('keydown', onKey);
		link.focus();
	}
};
ActionCenter.changeOrderType = async (button) => {
	if (!button) return;
	var type = button.getAttribute('orderType');
	if (!type) return;
	orderType = type;
	await chrome.storage.local.set({'FilesOrderType': type});
	updateOrderType();
	loadFileList();
};
ActionCenter.refreshFileList = loadFileList;
ActionCenter.removeUnsummarized = async () => {
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
	var notify = Notification.show(messages.cypriteName, messages.fileManager.loadingList, 'middleTop', 'message', 24 * 3600 * 1000);
	try {
		await askSWandWait('RemovePageInfos', false);
	}
	catch (err) {
		logger.error('RemoveUnsummarized', err);
		err = err.message || err.msg || err.data || err.toString();
		Notification.show(messages.cypriteName, err, "middleTop", 'error', 5 * 1000);
	}
	notify._hide();
	await loadFileList();
};
ActionCenter.removeUncached = async () => {
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
	var notify = Notification.show(messages.cypriteName, messages.fileManager.loadingList, 'middleTop', 'message', 24 * 3600 * 1000);
	try {
		await askSWandWait('RemovePageInfos', true);
	}
	catch (err) {
		logger.error('RemoveUncached', err);
		err = err.message || err.msg || err.data || err.toString();
		Notification.show(messages.cypriteName, err, "middleTop", 'error', 5 * 1000);
	}
	notify._hide();
	await loadFileList();
};

/* Event Center */

EventHandler.requestHeartBeating = async () => {
	logger.log('AI', 'HeartBeating...');
	var hint = document.body.querySelector('.panel_container .panel_logo .thinking_hint');
	hint.classList.add('show');
	if (!!tmrThinkingHint) {
		clearTimeout(tmrThinkingHint);
	}
	tmrThinkingHint = setTimeout(() => {
		tmrThinkingHint = null;
		hint.classList.remove('show');
	}, 2000);
};
ActionCenter.gotoConfig = () => {
	location.href = `./config.html`;
};
ActionCenter.clearConversation = async () => {
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
	if (running) {
		Notification.show(messages.cypriteName, messages.mentions.clearConversationWhileRunning, 'middleTop', 'warn', 2 * 1000);
		return;
	}

	var container = document.body.querySelector('.panel_operation_area[group="' + currentMode + '"]');
	var content = container.querySelector('.content_container');
	content.innerHTML = '';

	if (currentMode === 'crossPageConversation') {
		let conversation = await chrome.storage.session.get(currentTabId + ':crosspageConv');
		conversation = (conversation || {})[currentTabId + ':crosspageConv'];
		if (!!conversation) {
			conversation = conversation.filter(item => item[0] === 'system');
			let item = {};
			item[currentTabId + ':crosspageConv'] = conversation;
			await chrome.storage.session.set(item);
		}
		addChatItem('crossPageConversation', messages.newTab.crossPageConversationHint, 'cyprite');
	}
	else if (currentMode === 'instantTranslation') {
		addChatItem('instantTranslation', messages.translation.instantTranslateHint, 'cyprite');
	}
};
ActionCenter.showArticleChooser = () => {
	var container = document.body.querySelector('.panel_container');
	if (!container) return;
	container.setAttribute('showMask', "showArticleList");
	container.setAttribute('showArticleList', "true");
};
ActionCenter.hideFloatWindow = () => {
	var container = document.body.querySelector('.panel_container');
	if (!container) return;
	var target = container.getAttribute('showMask');
	if (!target) return;
	container.removeAttribute('showMask');
	container.removeAttribute(target);
};
ActionCenter.sendMessage = async (button) => {
	running = true;

	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
	var target = button.getAttribute('target');
	var inputter = button.parentNode.querySelector('.input_container');
	var sender = button.parentNode.querySelector('.input_sender');
	var frame = button.parentNode.querySelector('.content_container') || button.parentNode.parentNode.querySelector('.content_container');
	var content = getPageContent(inputter, true);
	if (!content) {
		if (target === 'instantTranslation') {
			if (!lastTranslatContent) {
				return;
			}
			else {
				content = lastTranslatContent;
			}
		}
		else {
			return;
		}
	}
	var cid = addChatItem(target, content, 'human', null, true), conversation;

	inputter.innerText = messages.conversation.waitForAI;
	inputter.setAttribute('contenteditable', 'false');
	wait(60).then(() => {
		onInputFinish(inputter, sender, frame);
	});

	var result;
	if (target === 'crossPageConversation') {
		conversation = await prepareXPageConv(content);
		conversation[conversation.length - 1].push(cid);
		try {
			result = await askAIandWait('directSendToAI', conversation);
		}
		catch (err) {
			result = null;
			logger.error('CrossPageConversation', err);
			err = err.message || err.msg || err.data || err.toString();
			Notification.show(messages.cypriteName, err, "middleTop", 'error', 5 * 1000);
		}
		if (!result) {
			conversation.pop();
		}
		else {
			conversation.push(['ai', result]);
		}
	}
	else if (target === 'instantTranslation') {
		lastTranslatContent = content;
		let lang = document.body.querySelector('[name="translation_language"]').value;
		lang = chooseTargetLanguage(lang);
		let action = 'translateSentence';
		let wordCount = calculateWordCount(content);
		wordCount = wordCount.unlatin + wordCount.latin * 2;
		let lineCount = content.replace(/\w+(\.\w+)+/g, 'w').split(/[\.\!\?。！？\n\r]/).map(line => line.trim()).filter(line => !!line).length;
		if (lineCount > 10 || wordCount > 200) {
			action = 'translateContent';
		}
		try {
			result = await askAIandWait(action, { lang, content });
		}
		catch (err) {
			result = null;
			logger.error('InstantTranslate', err);
			err = err.message || err.msg || err.data || err.toString();
			Notification.show(messages.cypriteName, err, "middleTop", 'error', 5 * 1000);
		}
	}
	else if (target === 'intelligentSearch') {
		conversation = advSearchConversation || [];
		let option = {
			request: content,
			time: timestmp2str("YYYY/MM/DD hh:mm :WDE:")
		};
		let prompt = PromptLib.assemble(PromptLib.deepThinkingContinueConversationTemplate, option);
		conversation.push(['human', prompt]);
		try {
			result = await askAIandWait('directSendToAI', conversation);
		}
		catch (err) {
			result = null;
			logger.error("IntelligentSearch", err);
			err = err.message || err.msg || err.data || err.toString();
			Notification.show(messages.cypriteName, err, "middleTop", 'error', 5 * 1000);
		}
		console.log('AISEARCH GOT REPLY:', result);
		conversation.pop();
		if (!!result) {
			let prompt = PromptLib.assemble(PromptLib.deepThinkingContinueConversationFrame, option);
			conversation.push(['human', prompt]);
			conversation.push(['ai', result]);
			result = parseReplyAsXMLToJSON(result);
			result = result.reply?._origin || result.reply || result._origin;
		}
	}
	else {
		console.log(target);
		await wait(3000);
		result = '哇哈哈哈哈哈哈';
	}
	cid = addChatItem(target, result, 'cyprite', null, true);
	if (!!conversation) {
		conversation[conversation.length - 1].push(cid);
		if (target === 'crossPageConversation') {
			let item = {};
			item[currentTabId + ':crosspageConv'] = conversation;
			chrome.storage.session.set(item);
		}
	}

	inputter.innerText = '';
	inputter.setAttribute('contenteditable', 'true');

	inputter.focus();

	running = false;
};
ActionCenter.copyContent = async (target, ui) => {
	var content = target.parentNode.parentNode.querySelector('.chat_content')._data;
	if (!content) content = getPageContent(target, true);
	await navigator.clipboard.writeText(content);
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
	Notification.show(messages.cypriteName, messages.mentions.contentCopied, 'middleTop', 'success', 2 * 1000);
	ui.inputter.focus();
};
ActionCenter.deleteConversation = async (target, ui) => {
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
	if (running) {
		Notification.show(messages.cypriteName, messages.mentions.actionWhileRunning, 'middleTop', 'warn', 2 * 1000);
		return;
	}

	var [group, ids] = getDialogPair(target);
	var mode = ui.frame.parentNode.getAttribute('group');
	if (mode === 'crossPageConversation') {
		let gid = currentTabId + ':crosspageConv';
		let conversation = await chrome.storage.session.get(gid);
		conversation = (conversation || {})[gid];
		if (!conversation) return;
		conversation = conversation.filter(item => !ids.includes(item[2]));
		group.forEach(item => item.parentNode.removeChild(item));
		let item = {};
		item[gid] = conversation;
		await chrome.storage.session.set(item);
		Notification.show(messages.cypriteName, messages.crossPageConv.hintConversationDeleted, 'middleTop', 'success', 2 * 1000);
	}
};
ActionCenter.reAnswerRequest = async (target, ui) => {
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
	if (running) {
		Notification.show(messages.cypriteName, messages.mentions.actionWhileRunning, 'middleTop', 'warn', 2 * 1000);
		return;
	}

	var [group, ids] = getDialogPair(target);
	var mode = ui.frame.parentNode.getAttribute('group');
	if (mode === 'crossPageConversation') {
		let gid = currentTabId + ':crosspageConv';
		let conversation = await chrome.storage.session.get(gid);
		conversation = (conversation || {})[gid];
		if (!conversation) return;
		let temp = [], next;
		conversation.some((item, i) => {
			temp.push(item);
			next = conversation[i + 1];
			return ids.includes(item[2]);
		});
		if (!next) return;
		running = true;
		let result, notify;
		notify = Notification.show(messages.cypriteName, messages.conversation.waitForAI, 'middleTop', 'message', 24 * 3600 * 1000);
		try {
			result = await askAIandWait('directSendToAI', temp);
		}
		catch (err) {
			result = null;
			logger.error('CrossPageConversation', err);
			err = err.message || err.msg || err.data || err.toString();
			Notification.show(messages.cypriteName, err, "middleTop", 'error', 5 * 1000);
		}
		notify._hide();
		if (!result) {
			Notification.show(messages.cypriteName, messages.crossPageConv.hintRefreshFailed, 'middleTop', 'error', 2 * 1000);
		}
		else {
			next[1] = result;
			let contentPad = group[1].querySelector('.chat_content');
			parseMarkdownWithOutwardHyperlinks(contentPad, result, messages.conversation.AIFailed);
			contentPad._data = result;
			let item = {};
			item[gid] = conversation;
			await chrome.storage.session.set(item);
			Notification.show(messages.cypriteName, messages.crossPageConv.hintRefreshSuccess, 'middleTop', 'success', 2 * 1000);
		}
		running = false;
	}
};
ActionCenter.changeRequest = async (target, ui) => {
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
	if (running) {
		Notification.show(messages.cypriteName, messages.mentions.actionWhileRunning, 'middleTop', 'warn', 2 * 1000);
		return;
	}

	var container = target.parentNode.parentNode, cid = container.getAttribute('chatID');
	var mode = ui.frame.parentNode.getAttribute('group');
	if (mode === 'crossPageConversation') {
		let gid = currentTabId + ':crosspageConv';
		let conversation = await chrome.storage.session.get(gid);
		conversation = (conversation || {})[gid];
		if (!conversation) return;
		let curr;
		conversation.some(item => {
			curr = item;
			return item[2] === cid;
		});

		let editEvent = evt => {
			var leave = false;
			if (evt.key === 'Escape') {
				contentPad.innerHTML = originContent;
				leave = true;
			}
			else if (evt.key === 'Enter' && evt.ctrlKey) {
				let content = getPageContent(contentPad);
				if (!content) {
					contentPad.innerHTML = originContent;
				}
				else {
					parseMarkdownWithOutwardHyperlinks(contentPad, content);
					contentPad._data = content;
					curr[1] = content;
					let item = {};
					item[gid] = conversation;
					chrome.storage.session.set(item).then(() => {
						Notification.show(messages.cypriteName, messages.crossPageConv.hintChangeDialogSuccess, 'middleTop', 'success', 2 * 1000);
					});
				}
				leave = true;
			}
			if (leave) {
				contentPad.contentEditable = false;
				contentPad.removeEventListener('keyup', editEvent);
				notify._hide();
			}
		};
		let contentPad = container.querySelector('.chat_content');
		let originContent = contentPad.innerHTML;
		contentPad.addEventListener('keyup', editEvent);
		contentPad.innerText = contentPad._data;
		contentPad.contentEditable = true;

		let notify = Notification.show(messages.cypriteName, messages.crossPageConv.hintModifyContent, 'middleTop', 'mention', 24 * 3600 * 1000);
		contentPad.focus();
	}
};
ActionCenter.onMayCopySearchResult = async (target, ui, evt) => {
	var ele = evt.target;
	if (ele.getAttribute('action') !== 'copySearchResult') return;
	await navigator.clipboard.writeText(searchResult);
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
	Notification.show(messages.cypriteName, messages.mentions.contentCopied, 'middleTop', 'success', 2 * 1000);
};

window.addEventListener('beforeunload', () => {
	chrome.storage.session.remove(currentTabId + ':crosspageConv');
});
window.addEventListener('resize', resizeCurrentInputter);

const init = async () => {
	// Init
	var ot = await Promise.all([
		chrome.storage.local.get('FilesOrderType'),
		getSearchRequestList(),
		getConfig()
	]);
	if (isArray(ot[1])) {
		let ul = document.body.querySelector('.search_history');
		ot[1].forEach(hist => {
			var li = newEle('li', 'search_result_item', 'more_question');
			li.innerText = hist.replace(/[\r\n]+/g, ' ');
			li._question = hist;
			ul.appendChild(li);
		});
	}
	ot = (ot[0] || {}).FilesOrderType;
	if (!!ot) {
		let t = OrderTypes[ot];
		if (!!t) orderType = ot;
	}
	await getConfig();
	updateAIModelList();

	// Branch Control: Trial Version
	if (TrialVersion) {
		for (let ele of document.querySelectorAll('[needFullVersion="true"]')) {
			let action = ele.getAttribute('versionAction');
			if (action === 'disable') {
				ele.setAttribute('disabled', 'true');
				ele.removeAttribute('versionAction');
				ele.removeAttribute('needFullVersion');
			}
			else {
				let parent = ele.parentNode;
				if (!parent) continue;
				parent.removeChild(ele);
			}
		}
	}

	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
	AIModelList = document.body.querySelector('.panel_model_chooser');
	aiSearchInputter = document.body.querySelector('.panel_operation_area .search_inputter > div.inner');
	var resultPanel = aiSearchInputter.parentNode.parentNode.querySelector('.result_panel');
	aiSearchInputter.resultLocal = resultPanel.querySelector('.local_result_panel');
	aiSearchInputter.resultWikipedia = resultPanel.querySelector('.wikipedia_result_panel');
	aiSearchInputter.resultArxiv = resultPanel.querySelector('.arxiv_result_panel');
	aiSearchInputter.resultSearch = resultPanel.querySelector('.search_result_panel');
	aiSearchInputter.answerPanel = resultPanel.querySelector('.answer_panel');
	aiSearchInputter.answerPanelHint = resultPanel.querySelector('.answer_panel_hint');
	aiSearchInputter.referencePanel = resultPanel.querySelector('.reference_panel');
	aiSearchInputter.morequestionPanel = resultPanel.querySelector('.morequestion_panel');

	await generateModelList('');
	document.body.querySelector('input[name="translation_language"]').value = LangName[myInfo.lang];

	// I18N
	renderI18N('newTab');
	document.querySelector('html').setAttribute('lang', myInfo.lang);
	// Group Control
	setGroupSwitcher();
	// Events
	AIModelList.addEventListener('click', onChooseModel);
	document.body.querySelector('.result_panel .reference_panel').addEventListener('click', onSelectReference);
	// Register Action
	registerAction();

	// Conversation Area
	[...document.body.querySelectorAll('[type="conversationArea"]')].forEach(item => {
		var frame = item.querySelector('.content_container');
		var inputter = item.querySelector('.input_container');
		var sender = item.querySelector('.input_sender');
		var resizer;

		inputter.addEventListener('keyup', evt => {
			if (evt.ctrlKey && evt.key === 'Enter') {
				ActionCenter.sendMessage(sender);
			}
			if (!!resizer) return;
			resizer = setTimeout(() => {
				onInputFinish(inputter, sender, frame);
				resizer = null;
			}, 300);
		});
		inputter.addEventListener('paste', onContentPaste);
		frame.addEventListener('click', ({target}) => {
			var action = target.getAttribute('action');
			if (!action) return;
			var handler = ActionCenter[action];
			if (!handler) return;
			handler(target, {frame, inputter, sender});
		});
	});
	document.body.querySelector('.panel_article_list').addEventListener('click', onSelectArticleItem);
	aiSearchInputter.addEventListener('paste', onContentPaste);
	aiSearchInputter.addEventListener('keydown', evt => {
		var handled = false;
		if (evt.ctrlKey && evt.key === 'Enter') {
			handled = true;
			try {
				ActionCenter.startAISearch();
			} catch {}
		}
		else if (evt.altKey) {
			if (evt.key === 'ArrowLeft') {
				let idx = SearchModeOrderList.indexOf(myInfo.searchMode);
				if (idx < 0) return;
				handled = true;
				aiSearchInputter.parentNode.querySelector('.mode_chooser > li[checked="true"]').removeAttribute('checked');
				idx ++;
				while (true) {
					let mode = SearchModeOrderList[idx];
					ele = aiSearchInputter.parentNode.querySelector('.mode_chooser > li[mode="' + mode + '"]:not([disabled="true"])');
					if (!!ele) {
						myInfo.searchMode = mode;
						chrome.storage.local.set({searchMode: mode});
						ele.setAttribute('checked', 'true');
						break;
					}
					idx ++;
					if (idx >= SearchModeOrderList.length) idx = 0;
				}
			}
			else if (evt.key === 'ArrowRight') {
				let idx = SearchModeOrderList.indexOf(myInfo.searchMode);
				if (idx < 0) return;
				handled = true;
				aiSearchInputter.parentNode.querySelector('.mode_chooser > li[checked="true"]').removeAttribute('checked');
				idx --;
				if (idx < 0) idx = SearchModeOrderList.length - 1;
				while (true) {
					let mode = SearchModeOrderList[idx];
					ele = aiSearchInputter.parentNode.querySelector('.mode_chooser > li[mode="' + mode + '"]:not([disabled="true"])');
					if (!!ele) {
						myInfo.searchMode = mode;
						chrome.storage.local.set({searchMode: mode});
						ele.setAttribute('checked', 'true');
						break;
					}
					idx --;
					if (idx < 0) idx = SearchModeOrderList.length - 1;
				}
			}
		}
		if (handled) {
			evt.preventDefault();
			evt.stopPropagation();
		}
	});
	document.body.querySelector('.articleManagerFileList').addEventListener('click', onClickFileItemOperator);
	document.body.addEventListener('keyup', evt => {
		if (evt.key !== 'Escape') return;
		ActionCenter.closeReference();
	});


	// Init
	addChatItem('crossPageConversation', messages.newTab.crossPageConversationHint, 'cyprite');
	addChatItem('instantTranslation', messages.translation.instantTranslateHint, 'cyprite');
	var ele = aiSearchInputter.parentNode.querySelector('.mode_chooser > li[mode="' + myInfo.searchMode + '"]:not([disabled="true"])');
	if (!ele) {
		SearchModeOrderList.some(mode => {
			ele = aiSearchInputter.parentNode.querySelector('.mode_chooser > li[mode="' + mode + '"]:not([disabled="true"])');
			if (!ele) return;
			myInfo.searchMode = mode;
			return true;
		});
		if (!!ele) ele.setAttribute('checked', 'true');
	}
	else {
		ele.setAttribute('checked', 'true');
	}

	var tab = await chrome.tabs.getCurrent();
	currentTabId = tab.id;
	var mode = await chrome.storage.session.get(currentTabId + ':mode');
	mode = mode[currentTabId + ':mode'] || DefaultPanel;
	changeTab(mode);
	if (DefaultPanel === 'intelligentSearch') {
		await wait(500);
		aiSearchInputter.focus();
	}
};

window.onload = init;