const PageName = 'HomeScreen';
const WikiPediaMaxForDeepThinking = 5;
const ArxivMaxForDeepThinking = 5;
const SearchMaxCount = 10;
const MaximumConcurrentWebpageReading = 3;
const MaximumWebpageRead = 15;
const SearchHistoryCount = 20;
const RelativeArticleLimitForXPageConversation = 5;
const DefaultPanel = 'intelligentSearch';
// const DefaultPanel = 'intelligentWriter';
const IntelligentOrderList = [
	'freelyConversation',
	'intelligentSearch',
	'crossPageConversation',
	'instantTranslation',
	'intelligentWriter',
	'articleManager',
	'cypriteHelper',
];
const SearchModeOrderList = [
	'fullAnalyze',
	'fullAnswer',
	'searchOnly',
	'keywordOnly',
];
const UseSearch = true;
const CurrentArticleList = [];
const CacheExpire = 1000 * 3600;
const TaskCategory = new Map();

var AIModelList = null;
var currentTabId = 0;
var curerntStatusMention = null;
var running = false;

var aiSearchInputter = null;
var tmrThinkingHint = null;
var searchRecord = {};
var ntfDeepThinking = null;
var orderType = 'totalDuration';
var webpageReaded = 0;

var advSearchConversation = null;
var xPageConversation = null;
var freeConversation = null;
var helpConversation = null;
var writerConversation = null;

var lastTranslatContent = '';

var directRewrite = false;
var autoRewrite = false;
var tmrWordCount = null;
var tmrAutoRewrite = null;

/* Cache Control */

const getCachedInformation = async (type, name) => {
	expireCachedInformation();

	var key = 'Cache:' + type + ':' + name;
	var info = await chrome.storage.session.get(key);
	if (!info) return null;
	info = info[key];
	if (!info) return null;
	if (!info.data || !info.timestamp) {
		await chrome.storage.session.remove(key);
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
		if (!isString(name)) {
			name = name[myInfo.lang] || name.en;
		}
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
	await chrome.storage.local.set({'AImodel': model});
	updateModelList(model);

	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
	Notification.show('', messages.mentions.changeModelSuccess, 'middleTop', 'success');
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
const switchAIMode = (isNext) => {
	var idx = -1;
	[...document.querySelectorAll('.panel_tab.active')].forEach(ele => ele.classList.remove('active'));
	IntelligentOrderList.some((tab, i) => {
		if (tab !== currentMode) return;
		idx = i;
		if (tab === 'crossPageConversation') {
			const container = document.body.querySelector('.panel_container');
			if (!!container) {
				container.removeAttribute('showMask');
				container.removeAttribute('showArticleList');
			}
		}
		return true;
	});
	if (idx < 0) return false;
	if (isNext) {
		idx ++;
		if (idx >= IntelligentOrderList.length) idx = 0;
	}
	else {
		idx --;
		if (idx < 0) idx = IntelligentOrderList.length - 1;
	}
	changeTab(IntelligentOrderList[idx]);
	return true;
};
const onSelectReference = ({target}) => {
	if (target.tagName !== 'LI') return;
	if (!target.classList.contains('reference_item')) return;

	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
	var panel = document.body.querySelector('.reference_page');
	var title = panel.querySelector('.title');
	var content = panel.querySelector('.content');
	title.innerText = (target._data?.title || 'Untitled').replace(/[\n\r]+/g, ' ');
	parseMarkdownWithOutwardHyperlinks(content, messages.aiSearch.hintReferenceTitle + '[URL](' + target._data.url + ')\n\n----\n\n' + target._data.reply);

	panel.style.display = 'block';
};
ActionCenter.closeReference = () => {
	document.body.querySelector('.reference_page').style.display = 'none';
};

/* Utils */

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
const addChatItem = (target, content, type, cid, need=false, animate=false) => {
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];

	const container = document.body.querySelector('.panel_operation_area[group="' + target + '"] .content_container');
	const needOperator = need && ['crossPageConversation', 'freelyConversation'].includes(target);

	const item = newEle('div', 'chat_item');
	var isOther = false;
	if (!cid) cid = newID();
	item.setAttribute('chatID', cid);

	const titleBar = newEle('div', "chat_title");
	const buttons = [];
	var animation;
	if (animate) animation = "enterFromLeft 350ms cubic-bezier(0.5, 0.1, 0.3, 1) 1";
	if (type === 'human') {
		item.classList.add('human');
		if (!!myInfo.name) {
			let comma = messages.conversation.yourTalkPrompt.substr(messages.conversation.yourTalkPrompt.length - 1, 1);
			titleBar.innerText = myInfo.name + comma;
		}
		else {
			titleBar.innerText = messages.conversation.yourTalkPrompt;
		}
		if (needOperator) buttons.push('<img button="true" action="changeRequest" src="../images/feather.svg">');
		buttons.push('<img button="true" action="copyContent" src="../images/copy.svg">');
		if (needOperator) buttons.push('<img button="true" action="deleteConversation" src="../images/trash-can.svg">');
		if (animate) animation = "enterFromRight 350ms cubic-bezier(0.5, 0.1, 0.3, 1) 1";
	}
	else if (type === 'cyprite') {
		item.classList.add('ai');
		titleBar.innerText = messages.cypriteName + ':';
		if (needOperator) buttons.push('<img button="true" action="reAnswerRequest" src="../images/rotate.svg">');
		buttons.push('<img button="true" action="copyContent" src="../images/copy.svg">');
		if (needOperator) buttons.push('<img button="true" action="deleteConversation" src="../images/trash-can.svg">');
	}
	else if (type === 'hint') {
		item.classList.add('other');
		item.classList.add('information');
		item.setAttribute('toggle', 'toggleChatItem');
		let imgDown = newEle('img', 'down');
		imgDown.src = "../images/angles-down.svg";
		imgDown.setAttribute('button', 'true');
		titleBar.appendChild(imgDown);
		let imgUp = newEle('img', 'up');
		imgUp.src = "../images/angles-up.svg";
		imgUp.setAttribute('button', 'true');
		titleBar.appendChild(imgUp);
		let cap = newEle('span', 'caption');
		cap.innerText = content[0];
		titleBar.appendChild(cap);
		content = content[1];
		isOther = true;
	}
	else if (type === 'process') {
		item.classList.add('other');
		item.classList.add('process');
		let cap = newEle('span', 'caption');
		cap.innerText = content;
		titleBar.appendChild(cap);
		let imgDown = newEle('img', 'rotate');
		imgDown.src = "../images/rotate.svg";
		imgDown.setAttribute('button', 'true');
		titleBar.appendChild(imgDown);
		content = '';
		isOther = true;
	}
	else if (type === 'processDone') {
		item.classList.add('other');
		item.classList.add('process');
		let cap = newEle('span', 'caption');
		cap.innerText = content;
		titleBar.appendChild(cap);
		let imgDown = newEle('img', 'done');
		imgDown.src = "../images/check.svg";
		imgDown.setAttribute('button', 'true');
		titleBar.appendChild(imgDown);
		content = '';
		isOther = true;
	}
	else {
		return;
	}
	item.appendChild(titleBar);

	if (!!content) {
		let contentPad = newEle('div', isOther ? "other_content" : 'chat_content');
		parseMarkdownWithOutwardHyperlinks(contentPad, content, messages.conversation.AIFailed);
		contentPad._data = content;
		if (isOther) {
			let frame = newEle('div', "chat_content");
			frame.appendChild(contentPad);
			item.appendChild(frame);
		}
		else {
			item.appendChild(contentPad);
		}
	}

	if (buttons.length > 0) {
		const operatorBar = newEle('div', 'operator_bar');
		operatorBar.innerHTML = buttons.join('');
		item.appendChild(operatorBar);
	}

	if (animate) {
		item.style.animation = animation;
		setTimeout(() => {
			item.style.animation = '';
		}, 1000);
	}
	container.appendChild(item);
	wait(60).then(() => {
		container.scrollTop = container.scrollHeight - container.offsetHeight
	});

	return cid;
};
const chooseTargetLanguage = (lang) => {
	return selectTranslationLanguages(lang, myInfo.lang);
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
const downloadConversation = async () => {
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];

	const gid = currentTabId + ':crosspageConv';
	const conversation = ((await chrome.storage.session.get(gid)) || {})[gid];
	if (!conversation) return;

	const name = messages.newTab.crossPageConversation;
	const model = myInfo.model;

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

	const saved = await saveContentToLocalFile(markdown, 'conversation.md', {
		description: 'Markdown',
		accept: {
			'text/markdown': ['.md'],
		},
	});
	if (saved) {
		Notification.show('', messages.crossPageConv.hintConversationDownloaded, 'middleTop', 'success');
	}
};
const restoreConversation = (conversation, mode, start=0) => {
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];

	conversation.forEach((item, i) => {
		if (i < start) return;
		var content = item[1] || '', type = item[0];
		if (type === 'human') {
			content = content.replace(/\s*\(Time: \d{1,4}\/\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{1,2}(:\d{1,2})?\s+\w*?\)\s*$/, '');
		}
		else if (type === 'ai') {
			type = 'cyprite';
			const json = parseReplyAsXMLToJSON(content);
			const strategy = json.strategy;
			if (!!strategy) {
				addChatItem(mode, [messages.freeCyprite.hintThinkingStrategy, strategy], 'hint');
			}
			content = json.reply?._origin ||json.reply || content.replace(/\s*<strategy>[\w\W]*?<\/strategy>\s*/i, '\n\n').trim();
		}
		else if (type === 'call') {
			(item[1] || []).forEach(item => {
				addChatItem(mode, item.hint || item.name, 'processDone');
			});
			return;
		}
		else {
			return;
		}
		addChatItem(mode, content, type, item[2], true);
	});
};
const resizeCurrentInputter = () => {
	const container = document.body.querySelector('.panel_operation_area[group="' + currentMode + '"]');
	if (!container) return;
	const inputter = container.querySelector('.input_container');
	const sender = container.querySelector('.input_sender');
	const content = container.querySelector('.content_container');
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
	else if (currentMode === 'freelyConversation') {
		await switchToFreeCyprite();
	}

	resizeCurrentInputter();
};

/* XPageConv */

const switchToXPageConv = async () => {
	const content = document.body.querySelector('.panel_operation_area[group="' + currentMode + '"] .content_container');
	var needShowArticleList = true;
	if (content.querySelectorAll('.chat_item').length <= 1) {
		let conversation = await chrome.storage.session.get(currentTabId + ':crosspageConv');
		conversation = (conversation || {})[currentTabId + ':crosspageConv'];
		if (!!conversation && !!conversation.length) {
			restoreConversation(conversation, 'crossPageConversation');
		}
	}
	else {
		needShowArticleList = false;
	}

	refreshFileListInConversation();

	if (needShowArticleList) ActionCenter.showArticleChooser();
};
const askCrossPages = async (content, usage, cid) => {
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];

	var conversation = await prepareXPageConv(content);
	updateUsage(usage, conversation.usage);
	conversation = conversation.conversation;
	xPageConversation = conversation;

	const option = {
		request: content,
		time: timestmp2str("YYYY/MM/DD hh:mm :WDE:")
	};
	var prompt = PromptLib.assemble(PromptLib.deepThinkingContinueConversationTemplate, option);
	conversation.push(['human', prompt, cid]);

	const taskID = newID();
	TaskCategory.set(taskID, 'crossPageConversation');
	const request = {
		taskID,
		conversation,
		model: myInfo.model,
		tools: ['collectInformation'],
	};
	const tokens = estimateTokenCount(request.conversation);
	if (tokens > AILongContextLimit) {
		request.model = PickLongContextModel();
	}

	var result;
	try {
		result = await askAIandWait('directSendToAI', request);
		updateUsage(usage, result.usage);
		result = result.reply;
	}
	catch (err) {
		result = null;
		logger.error('CrossPageConversation', err);
		err = err.message || err.msg || err.data || err.toString();
		Notification.show('', err, "middleTop", 'error');
	}
	TaskCategory.delete(taskID);

	if (!!result) {
		prompt = PromptLib.assemble(PromptLib.deepThinkingContinueConversationFrame, option);
		let item = findLatestHumanChat(conversation);
		item[1] = prompt;
		item[2] = cid;
		conversation.push(['ai', result]);
		const json = parseReplyAsXMLToJSON(result);
		const strategy = parseArray(json.strategy?._origin || json.strategy || '', false).map(line => '- ' + line).join('\n');
		if (!!strategy) addChatItem('crossPageConversation', [messages.freeCyprite.hintThinkingStrategy, strategy], 'hint', undefined, undefined, true);
		result = json.reply?._origin || json.reply || result.replace(/\s*<strategy>[\w\W]*?<\/strategy>\s*/i, '\n\n').trim();
	}
	else {
		removeLatestConversation(conversation);
	}

	return [result, conversation];
};
const refreshFileListInConversation = async (condition) => {
	const container = document.body.querySelector('.panel_article_list .panel_article_list_container');
	var list = await getArticleList(true, orderType === 'lastVisit', condition);
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
			if (CurrentArticleList.includes(item.url)) {
				li.setAttribute('selected', 'true');
			}
			container.appendChild(li);
		});
	}
	else {
		let messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
		container.innerHTML = messages.crossPageConv.noArticle;
	}
	//
};
ActionCenter.searchArticleInConversation = async (ele, data, evt) => {
	if (evt.key !== 'Enter') return;

	var content = (ele.value || '').trim();
	refreshFileListInConversation(content);
};
const compareTwoArrays = (arr1, arr2) => {
	if (!isArray(arr1) || !isArray(arr2)) return false;

	const l = arr1.length;
	if (arr2.length !== l) return false;

	for (let i = 0; i < l; i ++) {
		if (arr1[i] !== arr2[i]) return false;
	}
	return true;
};
const assembleXPageConvSystemPrompt = async (articles) => {
	const config = { lang: LangName[myInfo.lang], related: '(No Reference Material)' };
	if (articles.length > 0) {
		let list = articles.map(item => {
			var data = {
				title: item.title || 'Untitled',
				url: item.url || '(no url)',
				content: item.content,
			};
			if (!item.content) data.length = 0;
			data.length = item.content.length;
			return data;
		}).filter(item => !!item.length);
		list.sort((a, b) => b.length - a.length);
		if (list.length > RelativeArticleLimitForXPageConversation) list.splice(RelativeArticleLimitForXPageConversation);
		let content = [];
		list.forEach(item => {
			if (!item.content) return;
			content.push('<currentArticle title="' + item.title + '" url="' + item.url + '">\n' + item.content.trim() + '\n</currentArticle>');
		});
		config.content = content.join('\n');
	}
	else {
		config.content = '(No Current Article)';
	}
	return PromptLib.assemble(PromptLib.askPageSystem, config);
};
const prepareXPageConv = async (request) => {
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
	const usage = {};
	const conversation = ((await chrome.storage.session.get(currentTabId + ':crosspageConv')) || {})[currentTabId + ':crosspageConv'] || [];

	// Determine whether to automatically filter related articles
	var needUpdateSP = false;
	var articles = [...document.body.querySelectorAll('.panel_article_list .panel_article_list_item[selected]')];
	// If the user has already selected some articles
	if (articles.length > 0) {
		articles = articles.map(item => item.url);
		articles.sort((a, b) => a === b ? 0 : (a > b ? 1 : -1));
		if (conversation.length === 0 || !compareTwoArrays(CurrentArticleList, articles)) {
			needUpdateSP = true;
			CurrentArticleList.splice(0);
			CurrentArticleList.push(...articles);

			let items;
			try {
				items = await askSWandWait('GetArticleInfo', {
					articles,
					isLastVisit: orderType === 'lastVisit',
				});
			}
			catch (err) {
				items = [];
				logger.error('GetArticleInfo', err);
				err = err.message || err.msg || err.data || err.toString();
				Notification.show('', err, "middleTop", 'error');
			}
			articles = items.map(item => {
				return {
					title: item.title,
					url: item.url,
					content: item.content
				};
			});
		}
	}
	// If the user has not yet selected any article
	else {
		needUpdateSP = true;
		// Search relative articles based on current topic
		let notify = Notification.show('', messages.crossPageConv.statusFindingSimilarFiles, 'middleTop', 'message', DurationForever);
		try {
			articles = await askAIandWait('selectArticlesAboutConversation', request);
			updateUsage(usage, articles.usage);
			articles = articles.articles;
			let items = await askSWandWait('GetArticleInfo', {
				articles: articles.map(item => item.url),
				isLastVisit: orderType === 'lastVisit',
			});
			articles.forEach(item => {
				var key = parseURL(item.url), has = false;
				items.some(art => {
					if (parseURL(art.url) !== key) return;
					item.content = art.content;
					has = true;
					return true;
				});
				if (!has) {
					item.content = "(No Content)";
				}
			});
		}
		catch (err) {
			articles = [];
			logger.error('SelectArticles', err);
			err = err.message || err.msg || err.data || err.toString();
			Notification.show('', err, "middleTop", 'error');
		}
		notify._hide();
		let list = articles.map(item => item.url);
		list.sort((a, b) => a === b ? 0 : (a > b ? 1 : -1));
		CurrentArticleList.splice(0);
		CurrentArticleList.push(...list);

		// Update UI and Chat History
		let items = [...document.body.querySelectorAll('.panel_article_list .panel_article_list_item')];
		items.forEach(li => {
			li.removeAttribute('selected');
		});
		if (articles.length > 0) {
			let hint = ['**' + messages.crossPageConv.hintFoundArticles + '**\n'];
			articles.forEach(item => {
				hint.push('-\t[' + item.title + '](' + item.url + ')');
				items.some(li => {
					if (li.url !== item.url) return;
					li.setAttribute('selected', 'true');
					return true;
				});
			});
			addChatItem('crossPageConversation', hint.join('\n'), 'cyprite', undefined, undefined, true);
		}
	}

	// Processing dialogue history
	if (conversation.length === 0) {
		const sp = await assembleXPageConvSystemPrompt(articles);
		conversation.push(['system', sp]);
	}
	else if (needUpdateSP) {
		const sp = await assembleXPageConvSystemPrompt(articles);
		conversation[0][1] = sp;
	}

	return {conversation, usage};
};
const getDialogPair = (button, conversation) => {
	const container = button.parentNode.parentNode;
	if (!container) return [[], []];
	const cid = container.getAttribute('chatID');
	if (!cid) return [[], []];

	var uis = [], ids = [];
	conversation.some((item, i) => {
		if (item[2] !== cid) return;

		if (item[0] === 'human') {
			ids.push(cid);
			const next = conversation[i + 1];
			if (!!next && next[0] === 'ai') {
				let nid = next[2];
				if (!nid) {
					nid = newID();
					next[2] = nid;
				}
				ids.push(nid);
			}
		}
		else if (item[0] === 'ai') {
			const prev = conversation[i - 1];
			if (!!prev && prev[0] === 'human') {
				let pid = prev[2];
				if (!pid) {
					pid = newID();
					prev[2] = pid;
				}
				ids.push(pid);
			}
			ids.push(cid);
		}
		else {
			return;
		}

		return true;
	});
	if (ids.length === 0) return [[], []];

	uis = ids.map(id => container.parentNode.querySelector('.chat_item[chatid="' + id + '"]'));
	if (ids.length !== uis.length) return [[], []];
	return [ids, uis];
};
ActionCenter.downloadConversation = () => {
	if (currentMode === 'crossPageConversation') {
		downloadConversation();
	}
	else if (currentMode === 'intelligentSearch' && !!searchRecord && !!searchRecord.mode) {
		dowloadAISearchRecord();
	}
	else if (currentMode === 'freelyConversation') {
		downloadFreeConversation();
	}
};
ActionCenter.saveConversation = () => {
	if (currentMode === 'intelligentSearch') {
		if (!!searchRecord && !!searchRecord.mode) {
			saveAISearchRecord();
		}
	}
};
ActionCenter.copyConversation = () => {
	if (currentMode === 'intelligentSearch') {
		if (!!searchRecord && !!searchRecord.mode) {
			copyAISearchRecord();
		}
	}
};
EventHandler.updateCurrentStatus = (msg) => {
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
	if (!!curerntStatusMention) curerntStatusMention._hide();
	if (!!msg) curerntStatusMention = Notification.show('', msg, 'middleTop', 'mention', DurationForever);
	else curerntStatusMention = null;
};
ActionCenter.deleteConversation = async (target, ui) => {
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
	if (running) {
		Notification.show('', messages.mentions.actionWhileRunning, 'middleTop', 'warn');
		return;
	}

	const mode = ui.frame.parentNode.getAttribute('group');
	const conversationTag = (mode === 'crossPageConversation') ? (currentTabId + ':crosspageConv') : ((mode === 'freelyConversation') ? TagFreeCypriteConversation : '');
	if (!conversationTag) return;

	var conversation = ((await chrome.storage.session.get(conversationTag)) || {})[conversationTag] || [];
	if (!conversation.length) return;

	const [cids, eles] = getDialogPair(target, conversation);
	if (!cids.length) return;

	eles.forEach(btn => btn.parentNode.removeChild(btn));

	conversation = conversation.filter(item => !cids.includes(item[2]));
	const data = {};
	data[conversationTag] = conversation;
	await chrome.storage.session.set(data);

	Notification.show('', messages.crossPageConv.hintConversationDeleted, 'middleTop', 'success');
};
ActionCenter.reAnswerRequest = async (target, ui) => {
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
	if (running) {
		Notification.show('', messages.mentions.actionWhileRunning, 'middleTop', 'warn');
		return;
	}

	const mode = ui.frame.parentNode.getAttribute('group');
	const conversationTag = (mode === 'crossPageConversation') ? (currentTabId + ':crosspageConv') : ((mode === 'freelyConversation') ? TagFreeCypriteConversation : '');
	if (!conversationTag) return;

	const conversation = ((await chrome.storage.session.get(conversationTag)) || {})[conversationTag] || [];
	if (!conversation.length) return;

	const [cids, eles] = getDialogPair(target, conversation);
	if (!cids.length || cids.length !== 2) return;

	const tempConversation = [], usage = {};
	conversation.some(item => {
		tempConversation.push(item);
		if (cids.includes(item[2])) {
			return true;
		}
	});

	const taskID = newID();
	TaskCategory.set(taskID, mode);
	const tools = ['collectInformation'];
	if (mode === 'freelyConversation') {
		tools.push('readArticle');
	}
	const request = {
		taskID,
		conversation: tempConversation,
		model: myInfo.model,
		tools,
	};
	const tokens = estimateTokenCount(request.conversation);
	if (tokens > AILongContextLimit) {
		request.model = PickLongContextModel();
	}

	running = true;
	var result, notify;
	notify = Notification.show('', messages.conversation.waitForAI, 'middleTop', 'message', DurationForever);
	try {
		result = await askAIandWait('directSendToAI', request);
		updateUsage(usage, result.usage);
		result = result.reply;
	}
	catch (err) {
		result = null;
		logger.error('ReAnswer', err);
		err = err.message || err.msg || err.data || err.toString();
		Notification.show('', err, "middleTop", 'error');
	}
	TaskCategory.delete(taskID);
	if (!!result) {
		const contentPad = eles[eles.length - 1].querySelector('.chat_content');
		const json = parseReplyAsXMLToJSON(result);
		const reply = json.reply?._origin || json.reply || result.replace(/\s*<strategy>[\w\W]*?<\/strategy>\s*/i, '\n\n').trim();
		parseMarkdownWithOutwardHyperlinks(contentPad, reply, messages.conversation.AIFailed);
		contentPad._data = reply;

		conversation.some(item => {
			if (item[2] !== cids[cids.length - 1]) return;
			item[1] = result;
			return true;
		});

		const data = {};
		data[conversationTag] = conversation;
		await chrome.storage.session.set(data);
		Notification.show('', messages.crossPageConv.hintRefreshSuccess, 'middleTop', 'success');
	}
	else {
		Notification.show('', messages.crossPageConv.hintRefreshFailed, 'middleTop', 'error');
	}
	tempConversation.splice(0);
	notify._hide();
	showTokenUsage(usage);
	running = false;
};
ActionCenter.changeRequest = async (target, ui) => {
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
	if (running) {
		Notification.show('', messages.mentions.actionWhileRunning, 'middleTop', 'warn');
		return;
	}

	const container = target.parentNode.parentNode, cid = container.getAttribute('chatID');
	const mode = ui.frame.parentNode.getAttribute('group');
	const conversationTag = (mode === 'crossPageConversation') ? (currentTabId + ':crosspageConv') : ((mode === 'freelyConversation') ? TagFreeCypriteConversation : '');
	if (!conversationTag) return;

	const conversation = ((await chrome.storage.session.get(conversationTag)) || {})[conversationTag] || [];
	if (!conversation.length) return;

	var curr;
	conversation.some(item => {
		if (item[2] !== cid) return;
		curr = item;
		return true;
	});

	const editEvent = evt => {
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
				curr[1] = content + '\n\n(Time' + timestmp2str("YYYY/MM/DD hh:mm :WDE:") + ')';
				let item = {};
				item[conversationTag] = conversation;
				chrome.storage.session.set(item).then(() => {
					Notification.show('', messages.crossPageConv.hintChangeDialogSuccess, 'middleTop', 'success');
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
	const contentPad = container.querySelector('.chat_content');
	const originContent = contentPad.innerHTML;
	contentPad.addEventListener('keyup', editEvent);
	contentPad.innerText = contentPad._data;
	contentPad.contentEditable = true;

	var notify = Notification.show('', messages.crossPageConv.hintModifyContent, 'middleTop', 'mention', DurationForever);
	contentPad.focus();
};
ActionCenter.showArticleChooser = () => {
	var container = document.body.querySelector('.panel_container');
	if (!container) return;
	container.setAttribute('showMask', "showArticleList");
	container.setAttribute('showArticleList', "true");
};
const onSelectArticleItem = ({target}) => {
	if (!target.classList.contains('panel_article_list_item')) return;
	var selected = target.getAttribute('selected');
	if (!!selected) {
		target.removeAttribute('selected');
		let idx = CurrentArticleList.indexOf(target.url);
		if (!idx >= 0) {
			CurrentArticleList.splice(idx, 1);
		}
	}
	else {
		target.setAttribute('selected', 'true');
		if (!CurrentArticleList.includes(target.url)) {
			CurrentArticleList.push(target.url);
		}
	}
};
EventHandler.appendAction = async (data) => {
	if (data.running) {
		const type = TaskCategory.get(data.task);
		if (!type) return
		addChatItem(type, data.hint, 'process', data.id, undefined, true);
	}
	else {
		if (!!data.conversation && !!data.conversation.call && !!data.conversation.tool) {
			const type = TaskCategory.get(data.task);
			// Save conversation item for tool use and tool result
			if (!!type) {
				let conversation;
				if (type === 'crossPageConversation') {
					conversation = xPageConversation;
				}
				else if (type === 'intelligentSearch') {
					conversation = advSearchConversation;
				}
				else if (type === 'freelyConversation') {
					conversation = freeConversation;
				}
				if (!!conversation) {
					conversation.push(['call', data.conversation.call]);
					conversation.push(['tool', data.conversation.tool]);
				}
			}
		}

		const ele = document.querySelector('.chat_item[chatid="' + data.id + '"]');
		if (!ele) return;
		if (!!data.hint) {
			const titlebar = ele.querySelector('.chat_title .caption');
			titlebar.innerText = data.hint;
		}
		const img = ele.querySelector('.chat_title img');
		img.src = '../images/check.svg';
		img.classList.remove('rotate');
		img.classList.add('done');
	}
};
const removeLatestConversation = (conversation) => {
	while (true) {
		let item = conversation.pop();
		if (conversation.length === 0) return;
		if (item[0] === "human") break;
	}
};
const findLatestHumanChat = (conversation) => {
	for (let i = conversation.length - 1; i >= 0; i --) {
		let item = conversation[i];
		if (item[0] === 'human') return item;
	}
};

/* Free Cyprite */

const switchToFreeCyprite = async () => {
	// Force to update all conversation history
	const content = document.body.querySelector('.panel_operation_area[group="' + currentMode + '"] .content_container');
	for (let item of content.querySelectorAll('.chat_item')) {
		item.parentElement.removeChild(item);
	}

	var conversation = await chrome.storage.session.get(TagFreeCypriteConversation);
	conversation = (conversation || {})[TagFreeCypriteConversation] || [];
	if (conversation.length === 0) return;

	restoreConversation(conversation, 'freelyConversation');
};
const downloadFreeConversation = async () => {
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];

	const conversation = ((await chrome.storage.session.get(TagFreeCypriteConversation)) || {})[TagFreeCypriteConversation] || [];
	if (conversation.length === 0) return;

	const name = messages.newTab.crossPageConversation;
	const model = myInfo.model;

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

	const saved = await saveContentToLocalFile(markdown, 'cyprite.md', {
		description: 'Markdown',
		accept: {
			'text/markdown': ['.md'],
		},
	});
	if (saved) {
		Notification.show('', messages.crossPageConv.hintConversationDownloaded, 'middleTop', 'success');
	}
};
const askFreeCyprite = async (content, usage, cid) => {
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];

	var conversation = await chrome.storage.session.get(TagFreeCypriteConversation);
	conversation = (conversation || {})[TagFreeCypriteConversation] || [];

	var prompt;
	if (!!PromptLib.freeCypriteUltra && PaCableModels.includes(myInfo.model)) {
		prompt = PromptLib.freeCypriteUltra;
	}
	else {
		prompt = PromptLib.freeCyprite;
	}
	prompt = PromptLib.assemble(prompt, { lang: LangName[myInfo.lang] });
	if (conversation.length === 0) {
		conversation.push(['system', prompt]);
	}
	else {
		conversation[0][1] = prompt;
	}

	conversation.push(['human', content + '\n\n(Time: ' + timestmp2str("YYYY/MM/DD hh:mm :WDE:") + ')', cid]);
	freeConversation = conversation;

	const taskID = newID();
	TaskCategory.set(taskID, 'freelyConversation');
	const request = {
		taskID,
		conversation,
		model: myInfo.model,
		tools: ['collectInformation', 'readArticle'],
	};

	var result;
	try {
		result = await askAIandWait('directSendToAI', request);
		updateUsage(usage, result.usage);
		result = result.reply;
	}
	catch (err) {
		result = null;
		logger.error('FreeCyprite', err);
		err = err.message || err.msg || err.data || err.toString();
		Notification.show('', err, "middleTop", 'error');
	}
	TaskCategory.delete(taskID);

	if (!!result) {
		conversation.push(['ai', result]);
		const json = parseReplyAsXMLToJSON(result);
		console.log(result, json);
		const strategy = parseArray(json.strategy?._origin || json.strategy || '', false).map(line => '- ' + line).join('\n');
		if (!!strategy) addChatItem('freelyConversation', [messages.freeCyprite.hintThinkingStrategy, strategy], 'hint', undefined, undefined, true);
		const thinking = json.thinking?._origin || json.thinking;
		if (!!thinking) addChatItem('freelyConversation', [messages.freeCyprite.hintThinkingStrategy, thinking], 'hint', undefined, undefined, true);
		result = json.reply?._origin || json.reply || result.replace(/\s*<strategy>[\w\W]*?<\/strategy>\s*/i, '\n\n').trim();
	}
	else {
		removeLatestConversation(conversation);
	}

	return [result, conversation];
};

/* Translation */

EventHandler.finishFirstTranslation = (content) => {
	addChatItem('instantTranslation', content, 'cyprite', null, true);
};
EventHandler.translationSuggestion = (content) => {
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];

	var list = [];
	if (!!content.deficiencies) {
		list.push('**' + messages.freeCyprite.hintTranslationDeficiencies + '**');
		list.push(parseArray(content.deficiencies, false).map(line => '- ' + line).join('\n'));
	}
	if (!!content.suggestions) {
		list.push('**' + messages.freeCyprite.hintTranslationSuggestions + '**');
		list.push(parseArray(content.suggestions, false).map(line => '- ' + line).join('\n'));
	}
	if (list.length === 0) return;
	list = list.join('\n\n');

	addChatItem('instantTranslation', [messages.freeCyprite.hintTranslationSuggestions, list], 'hint', undefined, undefined, true);
};
const callTranslator = async (content, usage) => {
	lastTranslatContent = content;
	var lang = document.body.querySelector('[name="translation_language"]').value;
	chrome.storage.local.set({transLang: lang});
	lang = chooseTargetLanguage(lang);
	var action = 'translateSentence';

	var wordCount = calculateWordCount(content);
	var punctuationCount = wordCount.punctuation;
	var lineCount = content.replace(/\w+(\.\w+)+/g, 'w').split(/[\.\!\?。！？\n\r]/).map(line => line.trim()).filter(line => !!line).length;
	wordCount = wordCount.unlatin + wordCount.latin * 2;

	if (punctuationCount < 3 && wordCount < 10) {
		action = "translateAndInterpretation";
	}
	else if (lineCount > 10 || wordCount > 200) {
		action = 'translateContent';
	}

	var result;
	try {
		result = await askAIandWait(action, { lang, content });
		console.log(result);
		if (!!result && !!result.usage) {
			updateUsage(usage, result.usage);
		}
		result = result.translation || '';
	}
	catch (err) {
		result = null;
		logger.error('InstantTranslate', err);
		err = err.message || err.msg || err.data || err.toString();
		Notification.show('', err, "middleTop", 'error');
	}

	return result;
};

/* Cyprite Helper */

const askCypriteHelper = async (content, usage, cid) => {
	if (!helpConversation || !helpConversation.length) {
		helpConversation = [];
		let prompt = PromptLib.assemble(PromptLib.cypriteHelper, {
			abountCyprite: PromptLib.abountCyprite,
			cypriteOperation: PromptLib.cypriteOperation,
			cypritePrivacy: PromptLib.cypritePrivacy,
		});
		helpConversation.push(['system', prompt]);
	}
	helpConversation.push(['human', content, cid]);

	var result;
	try {
		result = await askAIandWait('directSendToAI', helpConversation);
		updateUsage(usage, result.usage);
		result = result.reply;
	}
	catch (err) {
		result = null;
		logger.error('CypriteHelper', err);
		err = err.message || err.msg || err.data || err.toString();
		Notification.show('', err, "middleTop", 'error');
	}

	if (!!result) {
		helpConversation.push(['ai', result]);
	}
	else {
		removeLatestConversation(helpConversation);
	}

	return [result, helpConversation];
};

/* Writer */

const askCypriteWriter = async (content, usage, cid) => {
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];

	const writerArea = document.querySelector('.panel_operation_area[group="intelligentWriter"] .writingArea');
	var context = getPageContent(writerArea, true) || '';
	var requirement = getPageContent(document.querySelector('.panel_operation_area[group="intelligentWriter"] .requirementArea'), true) || '（没有具体要求）';

	if (!!tmrWordCount) clearTimeout(tmrWordCount);
	if (!!tmrAutoRewrite) clearTimeout(tmrAutoRewrite);
	const wordCount = calculateWordCount(context);
	document.querySelector('.infoArea span.wordcount').innerText = messages.writer.hintWordCount + ': ' + wordCount.total;

	var prompt = PromptLib.assemble(PromptLib.writerSystemPrompt, {
		context: context || '（还没开始写）',
		requirement
	});
	if (!writerConversation || !writerConversation.length) {
		writerConversation = [['system', prompt]];
	}
	else {
		writerConversation[0][1] = prompt;
	}
	if (!content) {
		let chatBox = document.querySelector('.chat_item[chatid="' + cid + '"]');
		if (!!chatBox) {
			chatBox.parentElement.removeChild(chatBox);
		}
		content = PromptLib.quickOptimize;
	}
	prompt = PromptLib.assemble(PromptLib.writeTemplate, {request: content});
	writerConversation.push(['human', prompt, cid]);

	const taskID = newID();
	TaskCategory.set(taskID, 'intelligentWriter');
	const request = {
		taskID,
		conversation: writerConversation,
		model: myInfo.model,
		tools: ['collectInformation', 'readArticle'],
	};

	var result;
	try {
		result = await askAIandWait('directSendToAI', request);
		updateUsage(usage, result.usage);
		result = result.reply;
	}
	catch (err) {
		result = null;
		logger.error('CypriteWriter', err);
		err = err.message || err.msg || err.data || err.toString();
		Notification.show('', err, "middleTop", 'error');
	}
	TaskCategory.delete(taskID);
	writerConversation[writerConversation.length - 1][1] = content;

	if (!!result) {
		writerConversation.push(['ai', result]);
		const json = parseReplyAsXMLToJSON(result);
		console.log(result, json);
		result = [];
		if (!!json.category) {
			document.querySelector('.infoArea span.category').innerText = messages.writer.hintCategory + ': ' + (json.category._origin || json.category);
		}
		if (!!json.style) {
			document.querySelector('.infoArea span.style').innerText = messages.writer.hintStyle + ': ' + (json.style._origin || json.style);
		}
		if (!!json.feature) {
			document.querySelector('.infoArea span.feature').innerText = messages.writer.hintFeature + ': ' + (json.feature._origin || json.feature);
		}
		if (!!json.asreader) result.push(json.asreader._origin || json.asreader);
		if (!!json.aseditor) result.push(json.aseditor._origin || json.aseditor);
		if (!!json.aswriter) {
			let changed = false, originalContent = context, isRewrite = false;
			let ctx = json.aswriter._origin || json.aswriter;
			ctx = ctx.replace(/<idea>\s*([\w\W]*?)\s*<\/idea>/gi, (m, inner) => {
				var c = parseReplyAsXMLToJSON(inner);
				var paragraph = c.iscontinue ? 0 : c.paragraphnumber;
				var original = (c.iscontinue ? '' : (c.originalcontent || '')).replace(/[\n\r]+/g, ' ').replace(/^[\-\+\*>#\s]+/, '');
				var modify = (c.modifiedcontent || '').replace(/[\n\r]+/g, ' ').replace(/^[\-\+\*>#\s]+/, '');

				if (directRewrite && !isRewrite) {
					if (c.isrewrite && !!modify) {
						context = c.modifiedcontent;
						isRewrite = true;
						changed = true;
					}
					else if (c.iscontinue) {
						if (!!modify) {
							changed = true;
							context = context + '\n\n' + c.modifiedcontent;
						}
					}
					else {
						if (!!original) {
							let idx = context.indexOf(c.originalcontent);
							if (idx >= 0) {
								changed = true;
								context = context.replace(c.originalcontent, c.modifiedcontent || "");
							}
						}
					}
				}

				if (c.isrewrite) {
					return '\n\n> ' + (c.modifiedcontent || '""') + '\n\n';
				}
				else if (c.iscontinue) {
					return '\n\n> ' + (modify || '""') + '\n\n';
				}
				else {
					return '- P' + paragraph + '\n  + > ' + (original || '""') + '\n  + ' + (modify || '""') + '\n';
				}
			});
			result.push(ctx);
			if (changed) {
				document.querySelector('.panel_operation_area[group="intelligentWriter"] .writingArea').innerText = context || originalContent;
				// parseMarkdownWithOutwardHyperlinks(document.querySelector('.panel_operation_area[group="intelligentWriter"] .writingArea'), context, originalContent);
			}
		}
		if (result.length === 0) {
			result = json._origin;
		}
		else {
			result = result.join('\n\n----\n\n');
		}
	}
	else {
		removeLatestConversation(writerConversation);
	}

	return [result, writerConversation];
};

/* AISearch */

var isAISearching = false;
const WebpageReadLock = new PoolWaitLock(MaximumConcurrentWebpageReading);
const searchWebPage = async (keywords, mention, logName) => {
	logger.info('Search: ' + logName, keywords.join('; '));
	var notify = Notification.show('', mention, 'middleTop', 'mention', DurationForever);

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
				result = [];
				logger.error('Search: ' + logName, err);
				err = err.message || err.msg || err.data || err.toString();
				Notification.show('', err, "middleTop", 'error');
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
	var notify = Notification.show('', messages.aiSearch.hintCallingOtherLLMToSearch, 'middleTop', 'mention', DurationForever);
	var timeused = Date.now();

	var result = await getCachedInformation('LLMSearch', quest), usage = {};
	if (!result) {
		try {
			result = await askAIandWait('callLLMForSearch', quest);
			if (!!result && !!result.result) {
				updateUsage(usage, result.usage);
				result = result.result;
				if (!isArray(result)) {
					result = [];
				}
				else {
					await setCachedInformation('LLMSearch', quest, [...result]);
				}
			}
		}
		catch (err) {
			result = [];
			logger.error('LLMSearch', err);
			Notification.show('', err.message || err.msg || err.data || err.toString(), "middleTop", 'error', 5 * 1000);
		}
	}
	else {
		logger.blank('UseCachedLLMSearchResult', quest);
		result = [...result];
	}

	notify._hide();
	timeused = Date.now() - timeused;
	logger.info('LLMSearch', 'timeused: ' + timeused + 'ms, count: ' + result.length);

	return {result, usage};
};
const filterAndShowSearchRsult = async (resultSearch, searchResults, extraList, keywords, request, shouldFold=false, isFullAnalyze=false, messages) => {
	var notify = Notification.show('', messages.aiSearch.msgFilteringWebPagesTask, 'middleTop', 'mention', DurationForever), usage = {};

	// Don't read file in front end
	var readables = Object.values(searchResults).filter(item => {
		var url = parseURL(item.url);
		return !url.match(/\.(pdf|doc|docx|ps|tar|gz|zip|rar|png|jpg|jpeg|gif|bmp|mp3|m4a|mp4|mv)$/i);
	});

	// Filter Webpages
	var webPages = await filterSearchResult(readables, request, 100, messages);
	updateUsage(usage, webPages.usage);
	webPages = webPages.webPages;
	// Append webpages from other sources
	if (!!extraList && !!extraList.length) {
		webPages = [...extraList, ...webPages];
	}
	if (webPages.length === 0) {
		notify._hide();
		return {webPages, usage};
	}
	webPages.sort((wpa, wpb) => (wpb.summary || '').length - (wpa.summary || '').length);

	// Show search result
	showGoogleSearchResult(resultSearch, messages, keywords, webPages, searchResults, shouldFold);

	notify._hide();

	// Reading WebPages
	if (isFullAnalyze) {
		webPages = await readAndReplyWebpages(webPages, request, messages);
		updateUsage(usage, webPages.usage);
		webPages = webPages.webPages;
	}

	return {webPages, usage};
};
const listAndReadArxivResult = async (frame, arxivResults, keywords, request, shouldFold=false, isFullAnalyze=false, messages) => {
	var notify = Notification.show('', messages.aiSearch.msgReadingArxivSummary, 'middleTop', 'mention', DurationForever), usage = {};

	var webPages = Object.values(arxivResults);
	if (webPages.length === 0) {
		notify._hide();
		return {webPages, usage};
	}
	webPages.sort((wpa, wpb) => (wpb.summary || '').length - (wpa.summary || '').length);

	// Show Article List
	showOtherSearchResult(frame, messages, messages.aiSearch.hintArxivResult, keywords, webPages, shouldFold);

	notify._hide();

	// Reading Articles
	if (isFullAnalyze) {
		if (webPages.length > ArxivMaxForDeepThinking) webPages.splice(ArxivMaxForDeepThinking);
		webPages = await readAndReplyWebpages(webPages, request, messages);
		updateUsage(usage, webPages.usage);
		webPages = webPages.webPages;
	}

	return {webPages, usage};
};
const filterAndReadWikipediaResult = async (frame, wikipediaResults, keywords, request, shouldFold=false, isFullAnalyze=false, messages) => {
	var notify = Notification.show('', messages.aiSearch.msgReadingWikipediaEntries, 'middleTop', 'mention', DurationForever), usage = {};

	// Filter Webpages
	var webPages = await filterSearchResult(wikipediaResults, request, 10, messages);
	updateUsage(usage, webPages.usage);
	webPages = webPages.webPages;
	if (webPages.length === 0) {
		notify._hide();
		return {webPages, usage};
	}
	webPages.sort((wpa, wpb) => (wpb.summary || '').length - (wpa.summary || '').length);

	// Show Article List
	showOtherSearchResult(frame, messages, messages.aiSearch.hintWikipediaResult, keywords, webPages, shouldFold);

	notify._hide();

	// Reading Articles
	if (isFullAnalyze) {
		if (webPages.length > WikiPediaMaxForDeepThinking) webPages.splice(WikiPediaMaxForDeepThinking);
		webPages = await readAndReplyWebpages(webPages, request, messages);
		updateUsage(usage, webPages.usage);
		webPages = webPages.webPages;
	}

	return {webPages, usage};
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
			if (!item.url) return;
			var li = newEle('li', 'search_result_item');
			var link = newEle('a');
			link.href = item.url;
			link.target = "_blank";
			link.innerText = (item.title || 'Untitled').replace(/[\r\n]+/g, ' ');
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
	if (!keywords) keywords = [];
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
		if (!item.url) continue;
		let li = newEle('li', 'search_result_item');
		let link = newEle('a');
		link.href = item.url;
		link.target = "_blank";
		link.innerText = (item.title || 'Untitled').replace(/[\r\n]+/g, ' ');
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
	frame.scrollIntoView({behavior: "smooth"});
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
	if (!keywords) keywords = [];
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
		if (!item.url) continue;
		let li = newEle('li', 'search_result_item');
		let link = newEle('a');
		link.href = item.url;
		link.target = "_blank";
		link.innerText = (item.title || 'Untitled').replace(/[\r\n]+/g, ' ');
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
	frame.scrollIntoView({behavior: "smooth"});
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
		title.innerText = (item.title || 'Untitled').replace(/[\n\r]+/g, ' ');
		li.appendChild(title);

		var float = newEle('div', 'reference_float');

		title = newEle('div', 'reference_float_title');
		title.innerText = (item.title || 'Untitled').replace(/[\n\r]+/g, ' ');
		float.appendChild(title);
		inner = newEle('div', 'reference_float_desc');
		let summary = item.reply || item.summary || messages.hintNone;
		inner.innerText = summary.length > 200 ? summary.substring(0, 198) + '......' : summary;
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
	if (readList.length === 0) return {webPages: [], usage: {}};

	// Filter Webpages
	var results, usage = {};
	try {
		results = await askAIandWait('findRelativeWebPages', {
			requests: [request],
			articles: readList,
			isWebPage: true,
			limit,
		});
		updateUsage(usage, results.usage);
		results = results.relevants || [];
	}
	catch (err) {
		results = [];
		logger.error('FindRelativePage', err);
		err = err.message || err.msg || err.data || err.toString();
		Notification.show('', err, "middleTop", 'error');
	}

	return {webPages: results, usage};
};
const readAndReplyWebpages = async (webPages, request, messages) => {
	var notify = Notification.show('', messages.aiSearch.msgReadingWebPage, 'middleTop', 'mention', DurationForever), usage = {};

	await Promise.all(webPages.map(async (item, idx) => {
		if (!item.url) return;
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
				logger.error('ReadWebPage', err);
				err = err.message || err.msg || err.data || err.toString();
				Notification.show('', err, "middleTop", 'error');
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
				item.content = item.summary || '';
			}

			let image = item.content.match(/\!\[[^\]\n\r]*\]\(([^\)\n\r]+)\)/);
			if (!!image) {
				image = image[1];
				if (!!image) {
					item.cover = image;
				}
			}
		}

		var reply = await replyOnWebpage(item.title, item.content, request);
		if (!!reply.usage) updateUsage(usage, reply.usage);
		item.reply = reply.reply;
		if (!!item.reply) webpageReaded ++;

		WebpageReadLock.finish();
	}));

	webPages = webPages.filter(item => !!item.reply);
	notify._hide();

	return {webPages, usage};
};
const replyOnWebpage = async (title, content, request) => {
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
	var notify = Notification.show('', messages.aiSearch.msgReadingArticle + title, 'middleTop', 'mention', DurationForever);
	var reply, usage = {};
	try {
		reply = await askAIandWait('raedAndReply', {content, request});
		updateUsage(usage, reply.usage);
		reply = reply.reply || '';
		logger.log('ReadPage&Reply', (title || 'Untitled').replace(/\s+/gi, ' '));
		console.log(reply);
	}
	catch (err) {
		reply = '';
		logger.error('ReadPage&Reply', err);
		err = err.message || err.msg || err.data || err.toString();
		Notification.show('', err, "middleTop", 'error');
	}
	notify._hide();

	return {reply, usage};
};
const analyzeSearchKeywords = async (messages, quest) => {
	var notify = Notification.show('', messages.aiSearch.msgAnaylzeSearchTask, 'middleTop', 'mention', DurationForever), usage = {};
	var timeused = Date.now();

	var result;
	try {
		result = await askAIandWait('getSearchKeyWord', quest);
		updateUsage(usage, result.usage);
		result = result.keywords;
		notify._hide();
	}
	catch (err) {
		logger.error('SearchKeywords', err);
		result = {};
		notify._hide();
		err = err.message || err.msg || err.data || err.toString();
		Notification.show('', err.message || err.msg || err.data || err.toString(), "middleTop", 'error', 5 * 1000);
	}
	result.search = result.search || [];
	result.search.unshift(quest); // Add the original question to the search in hopes of finding more useful web pages.

	logger.info('SearchKeywords', result.analyze);
	logger.info('SearchKeywords', 'timeused: ' + (Date.now() - timeused) + 'ms');

	if (myInfo.searchMode !== 'keywordOnly') return {keywords: result, usage};

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
	aiSearchInputter.answerPanel.scrollIntoView({behavior: "smooth"});
	await wait(10);
	aiSearchInputter.answerPanelHint.scrollIntoView({behavior: "smooth"});

	aiSearchInputter.setAttribute('contentEditable', 'true');

	return {keywords: result, usage};
};
const searchWebpageFromInternet = async (messages, quest) => {
	var searchInfo = await analyzeSearchKeywords(messages, quest); // Analyze Search Keywords
	var usage = searchInfo.usage;
	searchInfo = searchInfo.keywords;

	var tasks = [];
	// Search Google
	if (UseSearch && !!searchInfo.search && !!searchInfo.search.length) {
		tasks.push(searchWebPage(searchInfo.search, messages.aiSearch.msgSearchingWebPagesTask, 'Google'));
	}
	else {
		searchInfo.search = [];
		tasks.push({});
	}
	if (UseSearch && !!searchInfo.arxiv && !!searchInfo.arxiv.length) {
		searchInfo.arxiv = searchInfo.arxiv.map(kw => kw + ' site:arxiv.org');
		tasks.push(searchWebPage(searchInfo.arxiv, messages.aiSearch.msgSearchingArxivTask, 'ARXIV'));
	}
	else {
		searchInfo.arxiv = []
		tasks.push({});
	}
	if (UseSearch && !!searchInfo.wikipedia && !!searchInfo.wikipedia.length) {
		searchInfo.wikipedia = searchInfo.wikipedia.map(kw => kw + ' site:wikipedia.org');
		tasks.push(searchWebPage(searchInfo.wikipedia, messages.aiSearch.msgSearchingWikipediaTask, "WIKI"));
	}
	else {
		searchInfo.wikipedia = [];
		tasks.push({});
	}
	var [searchResults, arxivResults, wikipediaResults] = await Promise.all(tasks);

	// Decompose the search results
	for (let url in searchResults) {
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

	return [searchInfo, searchResult, usage];
};
const searchDocumentLocally = async (messages, quest) => {
	var notify = Notification.show('', messages.aiSearch.msgSearchingLocalArticle, 'middleTop', 'mention', DurationForever);
	var articles, usage = {};
	try {
		articles = await askAIandWait('selectArticlesAboutConversation', quest);
		updateUsage(usage, articles.usage);
		articles = articles.articles;
	}
	catch (err) {
		articles = [];
	}
	notify._hide();

	// Show Article List
	if (articles.length > 0) {
		showOtherSearchResult(aiSearchInputter.resultLocal, messages, messages.aiSearch.hintLocalResult, [], articles, true);
	}

	return {articles, usage};
};
const searchInformationByKeywrods = async (messages, quest, shouldFold=false, isFull=false) => {
	var notify = Notification.show('', messages.aiSearch.msgSearchingWebPagesTask, 'middleTop', 'mention', DurationForever);
	var timeused = Date.now();

	var usage = {}; // Token Usage
	var [searchInfo, localArticles, llmResults] = await Promise.all([
		searchWebpageFromInternet(messages, quest),
		isFull ? searchDocumentLocally(messages, quest) : {articles: [], usage: {}},
		searchByLLM(messages, quest)
	]);
	if (!!searchInfo[2]) {
		updateUsage(usage, searchInfo[2]);
	}
	if (!!localArticles) {
		if (!!localArticles.usage) {
			updateUsage(usage, localArticles.usage);
		}
		localArticles = localArticles.articles;
	}
	else {
		localArticles = [];
	}
	if (!!llmResults) {
		if (!!llmResults.usage) {
			updateUsage(usage, llmResults.usage);
		}
		llmResults = llmResults.result;
	}
	else {
		llmResults = [];
	}

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
	else tasks.push({webPages: [], usage: {}});
	if (Object.keys(searchResult.wikipedia).length > 0) tasks.push(filterAndReadWikipediaResult(aiSearchInputter.resultWikipedia, searchResult.wikipedia, searchInfo.wikipedia, quest, shouldFold, isFull, messages));
	else tasks.push({webPages: [], usage: {}});
	if (Object.keys(searchResult.search).length + llmResults.length > 0) tasks.push(filterAndShowSearchRsult(aiSearchInputter.resultSearch, searchResult.search, llmResults, searchInfo.search, quest, shouldFold, isFull, messages));
	else tasks.push({webPages: [], usage: {}});
	var [arxivResults, wikipediaResults, searchResults] = await Promise.all(tasks);

	if (!!arxivResults) {
		updateUsage(usage, arxivResults.usage);
		arxivResults = arxivResults.webPages;
	}
	if (!!wikipediaResults) {
		updateUsage(usage, wikipediaResults.usage);
		wikipediaResults = wikipediaResults.webPages;
	}
	if (!!searchResults) {
		updateUsage(usage, searchResults.usage);
		searchResults = searchResults.webPages;
	}

	logger.info('SearchInformation', 'timeused: ' + (Date.now() - timeused) + 'ms');

	return {
		search: searchResults,
		arxiv: arxivResults,
		wikipedia: wikipediaResults,
		local: localArticles,
		usage
	};
};
const searchResultButtons = (all=true) => {
	var buttons = [];
	buttons.push('<img button="true" action="copySearchResult" src="../images/copy.svg">');
	if (all) {
		buttons.push('<img button="true" action="saveSearchResult" src="../images/save.svg">');
		buttons.push('<img button="true" action="downloadSearchResult" src="../images/download.svg">');
	}
	return buttons.join(' ');
};
const generateSearchResultContent = () => {
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
	var info = {
		quest: searchRecord.quest,
		answer: searchRecord.answer,
		time: searchRecord.datestring,
	};
	if (!!searchRecord.reference) {
		info.reference = searchRecord.reference.map(item => {
			return '- [' + (item.title || messages.hintNone) + '](' + item.url + ')';
		}).join('\n');
	}
	else {
		info.reference = messages.hintNone;
	}
	if (!!searchRecord.conversation) {
		const limit = searchRecord.mode === "fullAnalyze" ? 5 : 3;
		const chat = [];
		for (let i = limit; i < searchRecord.conversation.length; i ++) {
			const part = [];
			const item = searchRecord.conversation[i];
			let content = item[1] || '';
			if (item[0] === 'human') {
				part.push('##\t' + myInfo.name);
				content = content.replace(/\s*\(Time: \d{1,4}\/\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{1,2}(:\d{1,2})?\s+\w*?\)\s*$/, '');
			}
			else if (item[0] === 'ai') {
				part.push('##\t' + messages.cypriteName);
				content = content.replace(/^[\w\W]*?<reply>\s*|\s*<\/reply>[\w\W]*?$/gi, '');
			}
			else {
				continue;
			}
			part.push(content);
			chat.push(part.join('\n\n'));
		}
		info.conversation = chat.join('\n\n----\n\n');
	}
	var content = PromptLib.assemble(messages.newTab.templateContent, info);
	return content;
};
const replyQuestBySearchResult = async (messages, quest) => {
	searchRecord = {};
	searchRecord.mode = 'fullAnswer';
	searchRecord.quest = quest;
	searchRecord.searchResult = {};

	var {search, arxiv, wikipedia, local, usage} = await searchInformationByKeywrods(messages, quest, true);
	searchRecord.searchResult.google = search;
	searchRecord.searchResult.arxiv = arxiv;
	searchRecord.searchResult.wikipedia = wikipedia;
	var readList = [...search, ...arxiv, ...wikipedia];
	readList = readList.filter(item => !!item.summary);

	var notify = Notification.show('', messages.aiSearch.msgAnswering, 'middleTop', 'mention', DurationForever), answer, moreList;
	try {
		answer = await askAIandWait('replyBasedOnSearch', {
			request: quest,
			webpages: readList,
		});
		updateUsage(usage, answer.usage);
		answer = answer.reply;
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
		Notification.show('', err.message || err.msg || err.data || err.toString(), "middleTop", 'error', 5 * 1000);
	}
	searchRecord.answer = answer;
	searchRecord.more = moreList;

	// Show Answer
	aiSearchInputter.answerPanelHint.innerText = messages.aiSearch.hintAnswering;
	aiSearchInputter.answerPanelHint.innerHTML = aiSearchInputter.answerPanelHint.innerHTML + searchResultButtons();
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
		article.push('<title>' + (item.title || 'Untitled').replace(/\s+/g, ' ') + '</title>');
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
	searchRecord.conversation = advSearchConversation;
	document.body.querySelector('.furthure_dialog').style.display = 'block';
	resizeCurrentInputter();

	showTokenUsage(usage);

	notify._hide();
	wait(100).then(() => {
		aiSearchInputter.answerPanel.scrollIntoView({behavior: "smooth"});
	});
};
const generateNaviMenu = () => {
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];

	aiSearchInputter.navMenuPanel.style.display = 'none';
	aiSearchInputter.navMenuPanel.innerHTML = '';

	var idx = 1;
	[...aiSearchInputter.answerPanel.querySelectorAll('h1')].forEach(item => {
		if (item.innerText === messages.aiSearch.hintMyPreliminaryThinking || item.innerText === messages.aiSearch.hintLearnFromInternet || item.innerText === messages.aiSearch.hintMyResponseAfterReflection) {
			const tag = 'header' + idx;
			idx ++;
			const anchor = newEle('a');
			anchor.innerText = item.innerText;
			anchor.name = tag;
			item.innerHTML = '';
			item.appendChild(anchor);
			const link = newEle('a');
			link.innerText = anchor.innerText;
			link.href = "#" + tag;
			link.addEventListener('click', evt => {
				evt.preventDefault();
				item.scrollIntoView({behavior: "smooth"});
			});
			aiSearchInputter.navMenuPanel.appendChild(link);
		}
	});

	if (idx > 1) aiSearchInputter.navMenuPanel.style.display = 'block';
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
const getAISearchRecordList = async (showUI=false) => {
	// Load from Cache
	var list;
	try {
		list = await chrome.storage.session.get(TagSearchRecord);
	}
	catch (err) {
		logger.error('LoadAISearchRecordList', err);
		list = null;
	}
	list = (list || {})[TagSearchRecord];

	// Load from DB
	if (!list) {
		try {
			list = await askSWandWait('LoadAISearchRecordList');
		}
		catch (err) {
			logger.error('GetSearchRecordList', err);
		}
		list = list || [];
	}

	if (!showUI || !list.length) return list;

	// Show UI
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
	const ul = document.body.querySelector('.search_records');
	const nowDay = Math.ceil(Date.now() / DayLong);
	var lastType = -1, area, titleBar, panel;
	list.forEach(item => {
		var day = Math.ceil(item.timestamp / DayLong);
		var duration = nowDay - day;
		var type = -1;
		if (duration <= 0) {
			type = 0;
		}
		else if (duration === 1) {
			type = 1;
		}
		else if (duration < 7) {
			type = 7;
		}
		else if (duration < 30) {
			type = 30;
		}
		else {
			type = 31;
		}
		if (type !== lastType) {
			area = newEle('div', 'search_record_area');

			titleBar = newEle('div', 'search_record_area_title');
			area.appendChild(titleBar);
			
			panel = newEle('ul', 'search_record_panel');
			area.appendChild(panel);
			
			ul.appendChild(area);

			lastType = type;
			if (type === 0) {
				titleBar.innerText = messages.aiSearch.hintToday;
			}
			else if (type === 1) {
				titleBar.innerText = messages.aiSearch.hintYesterday;
			}
			else if (type === 7) {
				titleBar.innerText = messages.aiSearch.hintThisWeek;
			}
			else if (type === 30) {
				titleBar.innerText = messages.aiSearch.hintThisMonth;
			}
			else {
				titleBar.innerText = messages.aiSearch.hintFarPast;
			}
		}
	
		var li = newEle('li', 'search_record_item');
		li._quest = item.quest;

		var cover = newEle('img', 'item_logo');
		if (item.mode === 'fullAnswer') {
			cover.src = '../images/newspaper.svg';
		}
		else {
			cover.src = '../images/book.svg';
		}
		li.appendChild(cover);

		var cap = newEle('span', 'item_title');
		cap.innerText = item.quest.replace(/(\s*[\n\r\t]\s*)+/g, ' ');
		li.appendChild(cap);

		var date = newEle('span', 'item_date');
		date.innerText = item.datestring;
		li.appendChild(date);

		var desc = newEle('span', 'item_desc');
		desc.innerText = item.quest;
		li.appendChild(desc);

		var closer = newEle('img', 'item_closer');
		closer.src = '../images/circle-xmark.svg';
		li.appendChild(closer);

		panel.appendChild(li);
	});

	return list;
};
const saveAISearchRecord = async () => {
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
	if (!searchRecord || !searchRecord.mode) return;

	const clearData = item => {
		const data = Object.assign({}, item);
		if (!!data.reply) {
			delete data.summary;
		}
		else {
			data.summary = data.summary || data.description;
		}
		delete data.content;
		delete data.description;
		delete data.embedding;
		delete data.hash;
		delete data.similar;
		delete data.totalDuration;
		delete data.currentDuration;
		delete data.viewed;
		delete data.reading;
		return data;
	};

	const data = Object.assign({}, searchRecord);
	data.conversation = advSearchConversation;
	data.timestamp = Date.now();
	data.datestring = timestmp2str("YYYY/MM/DD hh:mm :WDE:");
	if (!!searchRecord.reference) {
		data.reference = searchRecord.reference.map(item => {
			return clearData(item);
		});
	}
	if (!!searchRecord.searchResult) {
		data.searchResult = data.searchResult || {};
		if (!!searchRecord.searchResult.google) {
			data.searchResult.google = searchRecord.searchResult.google.map(item => {
				const data = {
					title: item.title,
					url: item.url,
				};
				return data;
			});
		}
		if (!!searchRecord.searchResult.arxiv) {
			data.searchResult.arxiv = searchRecord.searchResult.arxiv.map(item => {
				const data = {
					title: item.title,
					url: item.url,
				};
				return data;
			});
		}
		if (!!searchRecord.searchResult.wikipedia) {
			data.searchResult.wikipedia = searchRecord.searchResult.wikipedia.map(item => {
				const data = {
					title: item.title,
					url: item.url,
				};
				return data;
			});
		}
		if (!!searchRecord.searchResult.local) {
			data.searchResult.local = searchRecord.searchResult.local.map(item => {
				const data = {
					title: item.title,
					url: item.url,
				};
				return data;
			});
		}
	}

	try {
		await askSWandWait('SaveAISearchRecord', {quest: searchRecord.quest, record: data});
		logger.log('SaveSearchRecord', 'Quest Saved:', searchRecord.quest);
		Notification.show('', messages.newTab.hintSaveSearchRecordSuccess, 'middleTop', 'success');
	}
	catch (err) {
		logger.error('SaveSearchRecord', err);
		Notification.show('', messages.newTab.hintSaveSearchRecordFailed, 'middleTop', 'error');
	}
};
const dowloadAISearchRecord = async () => {
	const saved = await saveContentToLocalFile(generateSearchResultContent(), 'aisearch.md', {
		description: 'Markdown',
		accept: {
			'text/markdown': ['.md'],
		},
	});
	if (saved) {
		const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
		Notification.show('', messages.aiSearch.msgSearchRecordDownloaded, 'middleTop', 'success');
	}
};
const copyAISearchRecord = async () => {
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
	await navigator.clipboard.writeText(generateSearchResultContent());
	Notification.show('', messages.mentions.contentCopied, 'middleTop', 'success');
};
const hideAISearchPanel = () => {
	[...document.body.querySelectorAll('[group="intelligentSearch"] .chat_item')].forEach(item => {
		item.parentNode.removeChild(item);
	});
	document.body.querySelector('.furthure_dialog').style.display = 'none';
	document.body.querySelector('.search_records').style.display = 'none';
};
const switchSearchMode = (isNext) => {
	var idx = SearchModeOrderList.indexOf(myInfo.searchMode);
	if (idx < 0) return false;

	aiSearchInputter.parentNode.querySelector('.mode_chooser > li[checked="true"]').removeAttribute('checked');
	if (isNext) {
		idx ++;
		if (idx >= SearchModeOrderList.length) idx = 0;
	}
	else {
		idx --;
		if (idx < 0) idx = SearchModeOrderList.length - 1;
	}
	while (true) {
		let mode = SearchModeOrderList[idx];
		ele = aiSearchInputter.parentNode.querySelector('.mode_chooser > li[mode="' + mode + '"]:not([disabled="true"])');
		if (!!ele) {
			myInfo.searchMode = mode;
			chrome.storage.local.set({searchMode: mode});
			ele.setAttribute('checked', 'true');
			break;
		}
		if (isNext) {
			idx ++;
			if (idx >= SearchModeOrderList.length) idx = 0;
		}
		else {
			idx --;
			if (idx < 0) idx = SearchModeOrderList.length - 1;
		}
	}

	return true;
};
ActionCenter.changeMode = async (button) => {
	var mode = isString(button) ? button : button.getAttribute('mode');
	var ele = aiSearchInputter.parentNode.querySelector('.mode_chooser > li[checked]');
	if (!!ele) ele.removeAttribute('checked');
	await chrome.storage.local.set({searchMode: mode});
	ele = aiSearchInputter.parentNode.querySelector('.mode_chooser > li[mode="' + mode + '"]');
	ele.setAttribute('checked', 'true');
	myInfo.searchMode = mode;
};
const askViaSearchResult = async (content, usage, cid) => {
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];

	if (!advSearchConversation) advSearchConversation = [];
	var conversation = advSearchConversation;

	const option = {
		request: content,
		time: timestmp2str("YYYY/MM/DD hh:mm :WDE:")
	};
	let prompt = PromptLib.assemble(PromptLib.deepThinkingContinueConversationTemplate, option);
	conversation.push(['human', prompt]);
	const taskID = newID();
	TaskCategory.set(taskID, 'intelligentSearch');
	const request = {
		taskID,
		conversation,
		model: myInfo.model,
		tools: ['collectInformation'],
	};
	const tokens = estimateTokenCount(request.conversation);
	if (tokens > AILongContextLimit) {
		request.model = PickLongContextModel();
	}

	var result;
	try {
		result = await askAIandWait('directSendToAI', request);
		updateUsage(usage, result.usage);
		result = result.reply;
	}
	catch (err) {
		result = null;
		logger.error("IntelligentSearch", err);
		err = err.message || err.msg || err.data || err.toString();
		Notification.show('', err, "middleTop", 'error');
	}
	console.log('AISEARCH GOT REPLY:', result);
	TaskCategory.delete(taskID);

	if (!!result) {
		prompt = PromptLib.assemble(PromptLib.deepThinkingContinueConversationFrame, option);
		let item = findLatestHumanChat(conversation);
		item[1] = prompt;
		item[2] = cid;
		conversation.push(['ai', result]);
		const json = parseReplyAsXMLToJSON(result);
		const strategy = parseArray(json.strategy?._origin || json.strategy || '', false).map(line => '- ' + line).join('\n');
		if (!!strategy) addChatItem('intelligentSearch', [messages.freeCyprite.hintThinkingStrategy, strategy], 'hint', undefined, undefined, true);
		result = json.reply?._origin || json.reply || result.replace(/\s*<strategy>[\w\W]*?<\/strategy>\s*/i, '\n\n').trim();
	}
	else {
		removeLatestConversation(conversation);
	}

	return [result, conversation];
};
ActionCenter.startAISearch = async () => {
	if (isAISearching) return;
	isAISearching = true;

	[...aiSearchInputter.querySelectorAll('*')].forEach(ele => ele.removeAttribute('style'));

	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];

	var content = getPageContent(aiSearchInputter, true);
	if (!content) {
		Notification.show('', messages.aiSearch.msgEmptyRequest, 'middleTop', 'warn');
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
	aiSearchInputter.navMenuPanel.innerHTML = '';
	aiSearchInputter.navMenuPanel.style.display = 'none';
	aiSearchInputter.removeAttribute('contentEditable');
	if (!!ntfDeepThinking) {
		ntfDeepThinking._hide();
		ntfDeepThinking = null;
	}

	// Update Search History and Further Conversation
	advSearchConversation = null;
	hideAISearchPanel();

	var timeused = Date.now();
	searchRecord = null;
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

	await saveAISearchRecord();

	aiSearchInputter.setAttribute('contentEditable', 'true');
	isAISearching = false;
};
ActionCenter.chooseQuestion = (host, data, evt) => {
	if (!evt) return;
	var target = evt.target;
	if (!target) return;

	if (!target.classList.contains('more_question')) return;
	if (!target._question) return;
	if (!advSearchConversation) {
		aiSearchInputter.innerText = target._question;
		aiSearchInputter.scrollIntoView({behavior: "smooth"});
		aiSearchInputter.focus();
	}
	else {
		let inputter = document.querySelector('[group="intelligentSearch"] .furthure_dialog .input_container');
		inputter.innerText = target._question;
		inputter.scrollIntoView({behavior: "smooth"});
		inputter.focus();
	}
};
ActionCenter.loadSearchRecord = async (host, data, evt) => {
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
	const target = evt.target;

	// Delete Record
	if (target.classList.contains('item_closer')) {
		let ele = target.parentNode;
		let quest = ele._quest;
		if (!quest) return;
		try {
			await askSWandWait('DeleteAISearchRecord', quest);
			ele.parentNode.removeChild(ele);
			Notification.show('', messages.newTab.hintDeleteSearchRecordSuccess, 'middleTop', 'success');
		}
		catch (err) {
			logger.error('LoadSearchRecord', err);
			Notification.show('', messages.newTab.hintDeleteSearchRecordFailed, 'middleTop', 'error');
		}
	}
	// Load Record
	else if (target.classList.contains('search_record_item')) {
		let quest = target._quest;
		if (!quest) return;

		let info;
		try {
			info = await askSWandWait('GetAISearchRecord', target._quest);
		}
		catch (err) {
			logger.error('LoadAISearchRecord', err);
			Notification.show('', messages.newTab.hintLoadSearchRecordFailed, 'middleTop', 'error');
			return;
		}
		searchRecord = info;

		hideAISearchPanel();
		aiSearchInputter.innerText = target._quest;
		ActionCenter.changeMode(info.mode);
		if (!!info.searchResult) {
			if (!!info.searchResult.arxiv && !!info.searchResult.arxiv.length) {
				showOtherSearchResult(aiSearchInputter.resultArxiv, messages, messages.aiSearch.hintArxivResult, [], info.searchResult.arxiv, true);
			}
			if (!!info.searchResult.wikipedia && !!info.searchResult.wikipedia.length) {
				showOtherSearchResult(aiSearchInputter.resultWikipedia, messages, messages.aiSearch.hintWikipediaResult, [], info.searchResult.wikipedia, true);
			}
			if (!!info.searchResult.google && !!info.searchResult.google.length) {
				showGoogleSearchResult(aiSearchInputter.resultWikipedia, messages, [], info.searchResult.google, [], true);
			}
			if (!!info.searchResult.local && !!info.searchResult.local.length) {
				showOtherSearchResult(aiSearchInputter.resultLocal, messages, messages.aiSearch.hintLocalResult, [], info.searchResult.local, true);
			}
			[...document.querySelectorAll('.content_container .result_panel .foldable')].forEach(ui => ui.classList.add('folded'));
			[...document.querySelectorAll('.content_container .result_panel .foldhint')].forEach(ui => ui.classList.add('folded'));
		}
		aiSearchInputter.answerPanelHint.innerText = messages.aiSearch.hintAnswering;
		aiSearchInputter.answerPanelHint.innerHTML = aiSearchInputter.answerPanelHint.innerHTML + searchResultButtons();
		parseMarkdownWithOutwardHyperlinks(aiSearchInputter.answerPanel, info.answer, messages.aiSearch.msgEmptyAnswer);
		generateNaviMenu();
		if (info.more) {
			showMoreQuestions(info.more);
		}
		if (!!info.reference && !!info.reference.length) {
			showReferences(info.reference, messages);
		}
		if (!!info.conversation && !!info.conversation.length) {
			let last = info.conversation[info.conversation.length - 1];
			if (last[0] === 'human') info.conversation.pop();
			document.body.querySelector('.furthure_dialog').style.display = 'block';
			let limit = info.mode === 'fullAnalyze' ? 5 : 3;
			if (info.conversation.length > limit) {
				restoreConversation(info.conversation, 'intelligentSearch', limit);
			}
			advSearchConversation = info.conversation;
			resizeCurrentInputter();
		}
	}
};
EventHandler.updateDeepThinkingStatus = (msg) => {
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
	if (!!ntfDeepThinking) ntfDeepThinking._hide();
	ntfDeepThinking = Notification.show('', msg, 'middleTop', 'mention', DurationForever);
};
ActionCenter.switchFold = (host, data, evt) => {
	if (!evt) return;
	var target = evt.target;
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
const parseConditionSentence = (condition, subs=[]) => {
	// Parsing Parenthesis Pairs
	var pairs = [], lev = 0;
	condition.replace(/[\(\)（）]/g, (m, l) => {
		if (m === '(' || m === '（') {
			if (lev === 0) {
				pairs.push([l]);
			}
			lev ++;
		}
		else {
			lev --;
			if (lev <= 0) {
				pairs[pairs.length - 1][1] = l;
			}
		}
	});
	if (pairs.length > 0) {
		if (!pairs[pairs.length - 1][1]) pairs[pairs.length - 1][1] = condition.length;
		pairs.reverse().forEach(pair => {
			var pre = condition.substr(0, pair[0]);
			var post = condition.substring(pair[1] + 1);
			var inner = condition.substring(pair[0], pair[1] + 1);
			inner = inner.replace(/(\s*[\(（]\s*|\s*[\)）]\s*)/g, '');
			var idx = subs.length;
			condition = pre + '{[:' + idx + ':]}' + post;
			var sub = [true];
			subs.push(sub);
			inner = parseConditionSentence(inner, subs);
			sub.push(inner);
		});
	}

	// Parse symbols and conditional fields
	lev = 0;
	pairs = [];
	condition.replace(/(\+|\*|\||\&|\s+or\s+|\s+and\s+)/gi, (m, op, pos) => {
		var pre = condition.substring(lev, pos);
		pre = pre.trim();
		if (!!pre) pairs.push([false, pre]);
		lev = pos + op.length;
		op = op.trim().toLowerCase();
		if (op === '+' || op === 'or' || op === '|') {
			pairs.push([true, 'OR']);
		}
		else {
			pairs.push([true, 'AND']);
		}
	});
	if (lev < condition.length) {
		let post = condition.substring(lev);
		post = post.trim();
		if (!!post) pairs.push([false, post]);
	}
	while (true) {
		if (pairs.length === 0) break;
		if (!pairs[0][0]) break;
		pairs.shift();
	}
	while (true) {
		if (pairs.length === 0) break;
		if (!pairs[pairs.length - 1][0]) break;
		pairs.pop();
	}
	for (let i = pairs.length - 1; i > 0; i --) {
		if (!pairs[i][0]) continue;
		if (!pairs[i - 1][0]) continue;
		pairs.splice(i, 1);
	}
	if (pairs.length === 0) return [];

	// Parse Execution Process
	var execution = [];
	execution.push(['SET', pairs[0][1]]);
	for (let i = 1; i < pairs.length; i += 2) {
		let op = pairs[i][1], value = pairs[i + 1][1];
		execution.push([op, value]);
	}
	execution = execution.map(item => {
		var op = item[0];
		var value = item[1];
		var neg = value.match(/^(\s*[\!\-])+/);
		if (!neg) {
			neg = false;
		}
		else {
			neg = neg[0];
			value = value.replace(neg, '').trim();
			neg = neg.match(/[\!\-]/g).length;
			neg = neg >> 1 << 1 !== neg;
		}
		var match = value.match(/^\{\[:(\d+):\]\}$/);
		if (!!match) {
			let idx = match[1] * 1;
			let v = subs[idx];
			if (!v) {
				return {
					op,
					sub: false,
					neg,
					range: 'A',
					value,
				};
			}
			else {
				return {
					op,
					sub: true,
					neg,
					range: 'A',
					value: v[1],
				};
			}
		}
		else {
			let range = value.split(':');
			if (range > 1) {
				let r = range.shift();
				value = range.join(':');
				r = r.toLowerCase();
				if (r === 't' || r === 'title') {
					range = "T";
				}
				else if (r === 'k' || r === 'keyword' || r === 'keywords') {
					range = "K";
				}
				else if (r === 'c' || r === 'category' || r === 'categories') {
					range = "C";
				}
				else {
					range = 'A';
				}
			}
			else {
				range = 'A';
			}
			return {
				op,
				sub: false,
				neg,
				range,
				value,
			};
		}
	});

	return execution;
};
const applyConditionFilter = (condition, articleInfo) => {
	var available = true;

	condition.forEach(item => {
		if (item.op === 'OR' && available) return;
		if (item.op === 'AND' && !available) return;

		var value, target = item.value.toLowerCase();
		if (item.sub) {
			value = applyConditionFilter(item.value, articleInfo);
		}
		else {
			if (item.range === 'K') {
				if (!articleInfo.keywords) {
					value = false;
				}
				else {
					value = articleInfo.keywords.some(key => key.toLowerCase() === target);
				}
			}
			else if (item.range === 'C') {
				if (!articleInfo.category) {
					value = false;
				}
				else {
					value = articleInfo.category.some(key => key.toLowerCase() === target);
				}
			}
			else if (item.range === 'T') {
				if (!articleInfo.title) {
					value = false;
				}
				else {
					value = articleInfo.title.toLowerCase().indexOf(target) >= 0;
				}
			}
			else {
				value = (articleInfo.keywords || []).some(key => key.toLowerCase() === target) || (articleInfo.category || []).some(key => key.toLowerCase() === target) || ((articleInfo.title || '').toLowerCase().indexOf(target) >= 0);
			}
		}
		if (item.neg) value = !value;

		available = value;
	});

	return available;
};
const getArticleList = async (onlyCached, isLastVisit, filterCondition) => {
	var cachedArticleList = await chrome.storage.local.get(TagArticleList);
	cachedArticleList = (cachedArticleList || {})[TagArticleList];
	if (!!cachedArticleList) {
		if (onlyCached) {
			cachedArticleList = cachedArticleList.filter(item => item.isCached);
		}
		if (isLastVisit) {
			cachedArticleList.sort((pa, pb) => pb.lastVisit - pa.lastVisit);
		}
		else {
			cachedArticleList.sort((pa, pb) => pb.duration - pa.duration);
		}
	}
	else {
		try {
			cachedArticleList = await askSWandWait('GetArticleList', { onlyCached, isLastVisit });
		}
		catch (err) {
			cachedArticleList = [];
			logger.error('GetArticleList', err);
			err = err.message || err.msg || err.data || err.toString();
			Notification.show('', err, "middleTop", 'error');
		}
	}

	if (!!filterCondition) {
		filterCondition = parseConditionSentence(filterCondition);
		if (!!filterCondition && !!filterCondition.length) {
			cachedArticleList = cachedArticleList.filter(item => applyConditionFilter(filterCondition, item));
		}
	}

	return cachedArticleList;
};
const loadFileList = async (filterCondition) => {
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
	var container = document.body.querySelector('.articleManagerFileList');
	container.innerHTML = '';

	var notify = Notification.show('', messages.fileManager.loadingList, 'middleTop', 'message', DurationForever);
	var list = await getArticleList(false, orderType === 'lastVisit', filterCondition);
	list.forEach(item => {
		var li = newEle('li', 'file_item');
		var link = newEle('a');
		link.href = item.url;
		link.target = '_blank';
		link.innerText = (item.title || 'Untitled').replace(/\s+/g, ' ');
		li.appendChild(link);

		if (!!item.isCached) {
			btn = newEle('img');
			btn.src = '../images/memory.svg';
			btn.title = messages.fileManager.imgHasHash;
			li.appendChild(btn);
		}
		if (!!item.isLocal) { // for local files
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

		var ctkwHinter = newEle('div', 'article_ctkw');
		var hinter = [];
		if (!!item.category && !!item.category.length) {
			hinter.push(messages.fileManager.hintCategory + item.category.join(', '));
		}
		else {
			hinter.push(messages.fileManager.hintCategory + messages.hintNone);
		}
		if (!!item.keywords && !!item.keywords.length) {
			hinter.push(messages.fileManager.hintKeywords + item.keywords.join(', '));
		}
		else {
			hinter.push(messages.fileManager.hintKeywords + messages.hintNone);
		}
		ctkwHinter.innerText = hinter.join('\n');
		li.appendChild(ctkwHinter);

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
			Notification.show('', err, "middleTop", 'error');
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
				let notify = Notification.show('', messages.fileManager.msgModifyingFileTitle, 'middleTop', 'message', DurationForever);
				try {
					await askSWandWait('ChangePageTitle', {url, title});
				}
				catch (err) {
					logger.error('ChangePageTitle', err);
					err = err.message || err.msg || err.data || err.toString();
					Notification.show('', err, "middleTop", 'error');
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
ActionCenter.refreshFileList = async () => {
	await chrome.storage.local.remove(TagArticleList);
	await loadFileList();
};
ActionCenter.removeUncached = async () => {
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
	var notify = Notification.show('', messages.fileManager.loadingList, 'middleTop', 'message', DurationForever);
	try {
		await askSWandWait('RemovePageInfos');
	}
	catch (err) {
		logger.error('RemoveUncached', err);
		err = err.message || err.msg || err.data || err.toString();
		Notification.show('', err, "middleTop", 'error');
	}
	notify._hide();
	await loadFileList();
};
ActionCenter.searchArticleInVault = async (ele, data, evt) => {
	if (evt.key !== 'Enter') return;

	var content = (ele.value || '').trim();
	loadFileList(content);
};

/* Layout and Theme */

ActionCenter.changeLayoutToColumnTab = async () => {
	try {
		await chrome.storage.local.set({layout: 'column'});
	}
	catch (err) {
		logger.error('ChangeLayout', err);
		return;
	}

	document.body.setAttribute('layout', 'column');
	resizeCurrentInputter();
};
ActionCenter.changeLayoutToRowTab = async () => {
	try {
		await chrome.storage.local.set({layout: 'row'});
	}
	catch (err) {
		logger.error('ChangeLayout', err);
		return;
	}

	document.body.setAttribute('layout', 'row');
	resizeCurrentInputter();
};
ActionCenter.changeThemeToLight = async () => {
	try {
		await chrome.storage.local.set({theme: 'light'});
	}
	catch (err) {
		logger.error('ChangeTheme', err);
		return;
	}

	document.body.setAttribute('theme', 'light');
};
ActionCenter.changeThemeToDark = async () => {
	try {
		await chrome.storage.local.set({theme: 'dark'});
	}
	catch (err) {
		logger.error('ChangeTheme', err);
		return;
	}

	document.body.setAttribute('theme', 'dark');
};
ActionCenter.shrinkColumn = async () => {
	try {
		await chrome.storage.local.set({shrinked: 'yes'});
	}
	catch (err) {
		logger.error('ChangeLayout', err);
		return;
	}

	document.body.setAttribute('shrinked', 'yes');
	resizeCurrentInputter();
};
ActionCenter.expandColumn = async () => {
	try {
		await chrome.storage.local.set({shrinked: 'no'});
	}
	catch (err) {
		logger.error('ChangeLayout', err);
		return;
	}

	document.body.setAttribute('shrinked', 'no');
	resizeCurrentInputter();
};
ActionCenter.toggleDirectRewrite = async () => {
	var value = !directRewrite;
	try {
		await chrome.storage.local.set({directRewrite: value});
	}
	catch (err) {
		logger.error('ChangeDirectRewrite', err);
		return;
	}
	directRewrite = value;
	document.body.setAttribute('directRewrite', directRewrite);
};
ActionCenter.toggleAutoRewrite = async () => {
	var value = !autoRewrite;
	try {
		await chrome.storage.local.set({autoRewrite: value});
	}
	catch (err) {
		logger.error('ChangeAutoRewrite', err);
		return;
	}
	autoRewrite = value;
	document.body.setAttribute('autoRewrite', autoRewrite);
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
ActionCenter.gotoAboutPage = () => {
	location.href = `./config.html?tab=about`;
};
ActionCenter.clearConversation = async () => {
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
	if (running) {
		Notification.show('', messages.mentions.clearConversationWhileRunning, 'middleTop', 'warn');
		return;
	}

	var container = document.body.querySelector('.panel_operation_area[group="' + currentMode + '"]');
	var content = container.querySelector('.content_container');
	[...content.querySelectorAll('.chat_item')].forEach(item => {
		item.parentElement.removeChild(item);
	});

	if (currentMode === 'crossPageConversation') {
		let conversation = await chrome.storage.session.get(currentTabId + ':crosspageConv');
		conversation = (conversation || {})[currentTabId + ':crosspageConv'];
		if (!!conversation) {
			conversation = conversation.filter(item => item[0] === 'system');
			let item = {};
			item[currentTabId + ':crosspageConv'] = conversation;
			await chrome.storage.session.set(item);
		}
		addChatItem('crossPageConversation', messages.newTab.crossPageConversationHint, 'cyprite', undefined, undefined, true);
	}
	else if (currentMode === 'instantTranslation') {
		addChatItem('instantTranslation', messages.translation.instantTranslateHint, 'cyprite', undefined, undefined, true);
	}
	else if (currentMode === 'intelligentSearch') {
		if (!!advSearchConversation) {
			const limit = myInfo.searchMode === 'fullAnalyze' ? 5 : 3;
			if (advSearchConversation.length > limit) {
				advSearchConversation.splice(limit);
			}
		}
	}
	else if (currentMode === 'freelyConversation') {
		await chrome.storage.session.remove(TagFreeCypriteConversation);
	}
	else if (currentMode === 'cypriteHelper') {
		if (!!helpConversation) helpConversation.splice(0);
		addChatItem('cypriteHelper', messages.newTab.helperHint, 'cyprite', undefined, undefined, true);
	}
	else if (currentMode === 'intelligentWriter') {
		if (!!writerConversation) writerConversation.splice(0);
		addChatItem('intelligentWriter', messages.writer.hintWelcome, 'cyprite', undefined, undefined, true);
	}
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
	if (!content && target !== 'intelligentWriter') {
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
	var cid = addChatItem(target, content, 'human', null, true, true), conversation;

	inputter.innerText = messages.conversation.waitForAI;
	inputter.setAttribute('contenteditable', 'false');
	wait(50).then(() => {
		onInputFinish(inputter, sender, frame);
	});

	var result, usage = {};
	if (target === 'crossPageConversation') {
		[result, conversation] = await askCrossPages(content, usage, cid);
	}
	else if (target === 'instantTranslation') {
		result = await callTranslator(content, usage);
	}
	else if (target === 'intelligentSearch') {
		[result, conversation] = await askViaSearchResult(content, usage, cid);
	}
	else if (target === 'freelyConversation') {
		[result, conversation] = await askFreeCyprite(content, usage, cid);
	}
	else if (target === 'cypriteHelper') {
		[result, conversation] = await askCypriteHelper(content, usage, cid);
	}
	else if (target === 'intelligentWriter') {
		[result, conversation] = await askCypriteWriter(content, usage, cid);
	}

	if (!!result) {
		cid = addChatItem(target, result, 'cyprite', null, true, true);
	}
	else {
		cid = 0;
	}

	if (!!conversation) {
		conversation[conversation.length - 1].push(cid);
		if (target === 'crossPageConversation') {
			let item = {};
			item[currentTabId + ':crosspageConv'] = conversation;
			chrome.storage.session.set(item);
		}
		else if (target === 'freelyConversation' && !!result) {
			let item = {};
			item[TagFreeCypriteConversation] = conversation;
			chrome.storage.session.set(item);
		}
	}

	inputter.innerText = '';
	inputter.setAttribute('contenteditable', 'true');
	inputter.focus();

	showTokenUsage(usage);

	running = false;
};
ActionCenter.copyContent = async (target, ui) => {
	var content = target.parentNode.parentNode.querySelector('.chat_content')._data;
	if (!content) content = getPageContent(target, true);
	await navigator.clipboard.writeText(content);
	const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
	Notification.show('', messages.mentions.contentCopied, 'middleTop', 'success');
	ui.inputter.focus();
};
ActionCenter.onOperateSearchResult = async (target, ui, evt) => {
	if (!evt) return;
	const ele = evt.target;
	if (!ele) return;
	if (!searchRecord || !searchRecord.mode) return;

	const action = ele.getAttribute('action');
	if (action === 'copySearchResult') {
		await copyAISearchRecord();
	}
	else if (action === 'saveSearchResult') {
		await saveAISearchRecord();
	}
	else if (action === 'downloadSearchResult') {
		await dowloadAISearchRecord();
	}
};

window.addEventListener('resize', resizeCurrentInputter);
chrome.storage.local.onChanged.addListener(evt => {
	if (!!evt.AImodel?.newValue) {
		myInfo.model = evt.AImodel.newValue;
		updateModelList(myInfo.model);
	}
});

const init = async () => {
	// Init
	var ot = await Promise.all([
		chrome.storage.local.get(['FilesOrderType', 'transLang', 'layout', 'theme', 'shrinked', 'directRewrite', 'autoRewrite']),
		getConfig(),
		getAISearchRecordList(true),
	]);
	document.body.querySelector('[name="translation_language"]').value = (ot[0] || {}).transLang || LangName[myInfo.lang];
	document.body.setAttribute('layout', (ot[0] || {}).layout || 'column');
	document.body.setAttribute('theme', (ot[0] || {}).theme || 'light');
	document.body.setAttribute('shrinked', (ot[0] || {}).shrinked || 'no');
	directRewrite = (ot[0] || {}).directRewrite || false;
	autoRewrite = (ot[0] || {}).autoRewrite || false;
	document.body.setAttribute('directRewrite', directRewrite);
	document.body.setAttribute('autoRewrite', autoRewrite);
	orderType = (ot[0] || {}).FilesOrderType || orderType;
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
			else if (action === 'invalid') {
				ele.classList.add('invalid');
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
	aiSearchInputter.navMenuPanel = resultPanel.querySelector('.nav_menu_panel');

	await generateModelList('');

	// I18N
	renderI18N('newTab');
	document.querySelector('html').setAttribute('lang', myInfo.lang);

	// Group Control
	setGroupSwitcher();
	// Events
	AIModelList.addEventListener('click', onChooseModel);
	document.body.querySelector('.result_panel .reference_panel').addEventListener('click', onSelectReference);
	document.body.querySelector('.panel_operation_area[group="intelligentWriter"] .writingArea').addEventListener('keyup', evt => {
		if (!!tmrWordCount) clearTimeout(tmrWordCount);
		if (!!tmrAutoRewrite) clearTimeout(tmrAutoRewrite);
		tmrWordCount = setTimeout(() => {
			if (!!tmrWordCount) {
				clearTimeout(tmrWordCount);
			}
			const container = evt.target;
			const content = getPageContent(container, true);
			const wordCount = calculateWordCount(content);
			document.querySelector('.infoArea span.wordcount').innerText = messages.writer.hintWordCount + ': ' + wordCount.total;
		}, 500);
		if (!autoRewrite) return;
		tmrAutoRewrite = setTimeout(() => {
			ActionCenter.sendMessage(document.body.querySelector('.panel_operation_area[group="intelligentWriter"] .input_sender'));
		}, 5000);
	});
	document.body.querySelector('.panel_operation_area[group="intelligentWriter"] .writingArea').addEventListener('paste', onContentPaste);
	document.body.querySelector('.panel_operation_area[group="intelligentWriter"] .requirementArea').addEventListener('paste', onContentPaste);
	// Register Action
	registerAction();

	// Conversation Area
	[...document.body.querySelectorAll('[type="conversationArea"]')].forEach(item => {
		var frame = item.querySelector('.content_container');
		var inputter = item.querySelector('.input_container');
		var sender = item.querySelector('.input_sender');

		inputter.addEventListener('keyup', evt => {
			if (evt.ctrlKey && evt.key === 'Enter') {
				ActionCenter.sendMessage(sender);
			}

			onInputFinish(inputter, sender, frame);
		});
		inputter.addEventListener('paste', onContentPaste);
		frame.addEventListener('click', ({target}) => {
			var action = target.getAttribute('action');
			if (!!action) {
				let handler = ActionCenter[action];
				if (!!handler) {
					handler(target, {frame, inputter, sender});
				}
			}

			action = target.getAttribute('toggle');
			if (!!action) {
				let toggled = target.classList.contains('toggled');
				if (!!toggled) {
					target.classList.remove('toggled');
				}
				else {
					target.classList.add('toggled');
				}
				let handler = ActionCenter[action];
				if (!!handler) {
					handler(target, {frame, inputter, sender});
				}
			}
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
			if (!evt.ctrlKey) {
				if (evt.key === 'ArrowLeft') {
					handled = switchSearchMode(true);
				}
				else if (evt.key === 'ArrowRight') {
					handled = switchSearchMode(false);
				}
			}
		}
		if (handled) {
			evt.preventDefault();
			evt.stopPropagation();
			evt.cancelBubble = true;
		}
	});
	document.body.querySelector('.articleManagerFileList').addEventListener('click', onClickFileItemOperator);
	document.addEventListener('keyup', evt => {
		var handled = false;
		if (evt.key === 'Escape') {
			ActionCenter.closeReference();
			handled = true;
		}
		else if (evt.ctrlKey && evt.altKey) {
			if (evt.key === 'ArrowLeft') {
				handled = switchAIMode(false);
			}
			else if (evt.key === 'ArrowRight') {
				handled = switchAIMode(true);
			}
		}
		if (handled) {
			evt.preventDefault();
			evt.stopPropagation();
			evt.cancelBubble = true;
		}
	});

	// Init
	addChatItem('crossPageConversation', messages.newTab.crossPageConversationHint, 'cyprite');
	addChatItem('instantTranslation', messages.translation.instantTranslateHint, 'cyprite');
	addChatItem('cypriteHelper', messages.newTab.helperHint, 'cyprite');
	addChatItem('intelligentWriter', messages.writer.hintWelcome, 'cyprite');
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
	changeTab(DefaultPanel);
	if (DefaultPanel === 'intelligentSearch') {
		await wait(500);
		aiSearchInputter.focus();
	}
};

window.onload = init;