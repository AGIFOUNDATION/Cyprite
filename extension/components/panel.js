const ChatHistory = [];
const ChatVectorLimit = 20;
const ArticleSimilarRate = 1.0;
const MatchRelevantArticlesBasedOnConversation = false;

var currentMode = '';
var showChatter = false, runningAI = false;
var relativeArticles = [];
var extraTranslationRequirement = '';
const UIList = {}, UIAction = {};

/* UI */

const renderI18N = (messages, container) => {
	[...container.querySelectorAll('[titlePath]')].forEach(item => {
		var path = item.getAttribute('titlePath');
		if (item.tagName === 'IMG') {
			item.title = readData(messages, path);
		}
		else {
			item.innerText = readData(messages, path);
		}
	});
	[...container.querySelectorAll('[htmlPath]')].forEach(item => {
		var path = item.getAttribute('htmlPath');
		item.innerHTML = readData(messages, path);
	});
	[...container.querySelectorAll('[hintPath]')].forEach(item => {
		var path = item.getAttribute('hintPath');
		item.title = readData(messages, path);
	});
	[...container.querySelectorAll('[placeholderName]')].forEach(item => {
		var path = item.getAttribute('placeholderName');
		item.placeholder = readData(messages, path) || path;
	});
};
const mountPage = (messages) => {
	var pageHTML = globalThis.PageContents.mainPage;
	pageHTML = pageHTML.replace(/\{extension_root\}/gi, chrome.runtime.getURL('').replace(/\/\s*$/, ''));

	var temp = newEle('div');
	temp.style.display = 'none';
	temp.innerHTML = pageHTML;
	[...temp.querySelectorAll('*')].forEach(ele => {
		var id = ele.getAttribute('id');
		if (!!id) {
			UIList[id] = ele;
			ele.removeAttribute('id');
		}
		[...ele.attributes].forEach(attr => {
			var name = attr.nodeName;
			if (!name.match(/^@/)) return;
			name = name.replace(/^@+/, '');
			if (!name) return;
			var action = UIAction[attr.nodeValue];
			if (!action) return;
			ele.addEventListener(name, action);
			ele.removeAttribute(attr.nodeName);
		});
		ele.classList.add('cyprite');
	});
	[...temp.children].forEach(ele => {
		renderI18N(messages, ele);
		document.body.appendChild(ele);
	});
	temp.innerHTML = '';
	temp = null;
};
const generateAIPanel = async (messages) => {
	await waitForMountUtil('panel');

	mountPage(messages);
	UIList.TranslationLanguage.value = LangName[myLang] || myLang;
	generateTranslationExtraRequirementPanel();

	document.body.appendChild(UIList.Container);
};
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

	UIList.ModelList.innerHTML = '';
	ModelList.forEach(mdl => {
		var name = ModelNameList[mdl];
		if (!name) return;
		var item = newEle('div', 'cyprite', 'panel_model_item');
		item.innerText = name;
		item.setAttribute('name', mdl);
		if (mdl === model) {
			item.classList.add('current');
		}
		UIList.ModelList.appendChild(item);
	});
};
const generateTranslationExtraRequirementPanel = () => {
	var inputter = UIList.Container.querySelector('.panel_extrareq_inputform textarea');
	var submitter = UIList.Container.querySelector('.panel_extrareq_inputform div.input_sender');
	submitter.addEventListener('click', () => {
		extraTranslationRequirement = inputter.value;
		var lang = UIList.TranslationLanguage.value || translationInfo.lang || myLang;
		translatePage(true, lang, translationInfo.content || '', extraTranslationRequirement);
	});
};
const addSummaryAndRelated = (messages, container, summary, relatedList) => {
	parseMarkdownWithOutwardHyperlinks(container, summary, messages.conversation.AIFailed);

	var related = newEle('h2', 'cyprite', 'related_articles_area');
	related.innerText = messages.summarizeArticle.relatedArticles;
	var list = newEle('ul', 'cyprite', 'related_articles_list');
	if (!relatedList || !relatedList.length) {
		list.innerHTML = '<li>' + messages.summarizeArticle.noRelatedArticle + '</li>';
	}
	else {
		relatedList.forEach(item => {
			var frame = newEle('li', 'cyprite', 'related_articles_item');
			var link = newEle('a', 'cyprite', 'related_articles_link');
			link.innerText = item.title;
			link.href = item.url;
			link.target = '_blank';
			frame.appendChild(link);
			list.appendChild(frame);
		});
	}
	container.appendChild(related);
	container.appendChild(list);
};
const addChatItem = (content, type) => {
	var messages = I18NMessages[myLang] || I18NMessages.en;
	var item = newEle('div', 'cyprite', 'chat_item'), isOther = false;

	var titleBar = newEle('div', 'cyprite', "chat_title");
	if (type === 'human') {
		titleBar.innerText = messages.conversation.yourTalkPrompt;
		item.classList.add('human');
	}
	else if (type === 'cyprite') {
		titleBar.innerText = messages.cypriteName + ':';
		item.classList.add('ai');
	}
	else {
		isOther = true;
		titleBar.innerText = type;
		item.classList.add('other');
	}
	item.appendChild(titleBar);

	if (!!content) {
		let contentPad = newEle('div', 'cyprite', "chat_content");
		parseMarkdownWithOutwardHyperlinks(contentPad, content, messages.conversation.AIFailed);
		contentPad._data = content;
		item.appendChild(contentPad);
	}
	else {
		if (!isOther) return;
	}

	var operatorBar = newEle('div', 'cyprite', 'operator_bar');
	operatorBar.innerHTML = '<img button="true" action="copyContent" src="' + chrome.runtime.getURL('/images/copy.svg') + '">';
	item.appendChild(operatorBar);

	UIList.HistoryList.appendChild(item);
	wait(60).then(() => {
		UIList.History.scrollTop = UIList.History.scrollHeight - UIList.History.clientHeight;
	});
};
const resizeHistoryArea = (immediately) => {
	if (!!resizeHistoryArea.timer) clearTimeout(resizeHistoryArea.timer);

	var duration = isBoolean(immediately) ? (immediately ? 0 : 250) : (isNumber(immediately) ? immediately : 250);
	resizeHistoryArea.timer = setTimeout(() => {
		resizeHistoryArea.timer = null;

		var inputerBox = UIList.Asker.parentNode.getBoundingClientRect();
		var containerBox = UIList.History.parentNode.getBoundingClientRect();
		var height = containerBox.height - 20 - inputerBox.height - 25;
		UIList.History.style.height = height + 'px';
	}, duration);
};

/* Events */

UIAction.onCloseMeByMask = ({target}) => {
	if (!target.classList.contains('panel_mask') && !target.classList.contains('panel_frame')) return;
	UIAction.onCloseMe();
};
UIAction.updateModelList = async (model) => {
	if (!model || !isString(model)) {
		let localInfo = await chrome.storage.local.get(['AImodel']);
		model = localInfo.AImodel || '';
	}

	[...UIList.ModelList.querySelectorAll('.panel_model_item')].forEach(item => {
		var mdl = item.getAttribute('name');
		if (model === mdl) {
			item.classList.add('current');
		}
		else {
			item.classList.remove('current');
		}
	});
};
UIAction.onChooseModel = async ({target}) => {
	if (!target.classList.contains("panel_model_item")) return;
	var model = target.getAttribute('name');
	chrome.storage.local.set({'AImodel': model});
	UIAction.updateModelList(model);

	var messages = I18NMessages[myLang] || I18NMessages.en;
	Notification.show(messages.cypriteName, messages.mentions.changeModelSuccess, 'middleTop', 'success', 2 * 1000);
};
UIAction.onCloseMe = () => {
	document.body.classList.remove('showCypritePanel');
	document.body.classList.add('showCypriteAccess');
};
UIAction.onShowPanel = () => {
	document.body.classList.remove('showCypriteAccess');
	UIList.QuickAccess.classList.remove('showDialogInputter');
	UIAction.onShowPageSummary();
};
UIAction.onShowDialogInputter = async () => {
	UIList.QuickAccess.classList.add('showDialogInputter');
	await wait(300);
	UIList.DialogInputter.focus();
};
const askCypriteOnPageContentAndConversation = async (question, messages) => {
		// Get Embedding Vector for Request
	var vector;
	if (MatchRelevantArticlesBasedOnConversation) {
		try {
			vector = await askAIandWait('embeddingContent', {title: "Request", article: question});
		}
		catch (err) {
			vector = undefined;
			Notification.show(messages.cypriteName, err, "middleTop", 'error', 5 * 1000);
		}
	}

	// Match relevant articles
	var related = null;
	if (!!vector) {
		if (!conversationVector && !!pageVector) {
			conversationVector = [];
			pageVector.forEach(item => {
				conversationVector.push({
					weight: item.weight,
					vector: [...item.vector],
				});
			});
		}
		if (!!conversationVector) {
			conversationVector.push(...vector);
			if (conversationVector.length > ChatVectorLimit) {
				conversationVector = conversationVector.splice(conversationVector.length - ChatVectorLimit, ChatVectorLimit);
			}
			related = await findRelativeArticles(messages);
		}
	}
	else {
		related = [...relativeArticles];
	}

	// Call AI for reply
	var {title, content} = pageInfo;
	if (!content) content = getPageContent(document.body, true);
	var result;
	try {
		result = await askAIandWait('askArticle', { url: location.href, title, content, question, related });
		if (!!result) {
			if (!!result.usage) showTokenUsage(result.usage, true);
			result = result.reply || '';
		}
	}
	catch (err) {
		Notification.show(messages.cypriteName, err, "middleTop", 'error', 5 * 1000);
	}

	if (!result) result = messages.conversation.AIFailed;
	return result;
};
UIAction.onQuickSend = async (evt) => {
	if (evt.key !== 'Enter' || !evt.ctrlKey) return;
	const question = UIList.DialogInputter.value;
	if (!question) return;
	UIList.DialogInputter.value = '';

	runningAI = true;

	const messages = I18NMessages[myLang] || I18NMessages.en;
	UIList.QuickAccess.classList.remove('showDialogInputter');
	var notification = Notification.show(messages.cypriteName, messages.thinkingHeartBeating, 'middleBottom', 'mention', 24 * 3600 * 1000);

	var result = await askCypriteOnPageContentAndConversation(question, messages);
	result = parseMarkdownWithOutwardHyperlinks(UIList.QuickReplyContent, result, messages.conversation.AIFailed);
	UIList.QuickAccess.classList.add('showQuickReply');

	notification._hide();

	runningAI = false;

	// Get Embedding Vector for Reply
	if (MatchRelevantArticlesBasedOnConversation && !!conversationVector) {
		askAIandWait('embeddingContent', {title: "Request", article: result}).then(vector => {
			if (!vector) return;
			conversationVector.push(...vector);
			if (conversationVector.length > ChatVectorLimit) conversationVector = conversationVector.splice(conversationVector.length - ChatVectorLimit, ChatVectorLimit);
		}).catch((err) => {
			Notification.show(messages.cypriteName, err, "middleTop", 'error', 5 * 1000);
		});
	}
};
UIAction.onCloseQuickDialog = () => {
	UIList.QuickAccess.classList.remove('showDialogInputter');
};
UIAction.onCloseQuickReply = () => {
	UIList.QuickAccess.classList.remove('showQuickReply');
	UIList.QuickReplyContent.innerHTML = '';
};
UIAction.onChatTrigger = async () => {
	if (!UIList.ChatTrigger) return;

	var messages = I18NMessages[myLang] || I18NMessages.en;
	showChatter = !showChatter;
	if (showChatter) {
		for (let tab of UIList.Panel.querySelectorAll('.panel_tabs_area .panel_button[group="' + currentMode + '"]')) tab.classList.add('show');
		UIList.ChatTrigger.innerText = messages.buttons.hideChatPanel;
		UIList.Panel.setAttribute('chat', 'true');
		await wait(100);
		UIList.Asker.focus();
		resizeHistoryArea(true);
		await wait(60);
		UIList.History.scrollTop = UIList.History.scrollHeight - UIList.History.clientHeight;
	}
	else {
		for (let tab of UIList.Panel.querySelectorAll('.panel_tabs_area .panel_button[group="' + currentMode + '"]')) tab.classList.remove('show');
		UIList.ChatTrigger.innerText = messages.buttons.showChatPanel;
		UIList.Panel.setAttribute('chat', 'false');
	}
};
UIAction.onContentPaste = evt => {
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
UIAction.onAfterInput = evt => {
	resizeHistoryArea();
	if (!evt.ctrlKey || evt.key !== 'Enter') return;
	evt.preventDefault();
	UIAction.onSendToCyprite();
};
UIAction.onSendToCyprite = async () => {
	runningAI = true;

	const messages = I18NMessages[myLang] || I18NMessages.en;
	const question = getPageContent(UIList.Asker, true);
	if (!question) return;
	addChatItem(question, 'human');
	UIList.Asker.innerText = messages.conversation.waitForAI;
	UIList.Asker.setAttribute('contentEditable', 'false');
	resizeHistoryArea(60);

	var result, usage;

	if (currentMode === 'summary') {
		result = await askCypriteOnPageContentAndConversation(question, messages);
	}
	else if (currentMode === 'translate') {
		let lang = UIList.TranslationLanguage.value || translationInfo.lang || myLang;
		// lang = chooseTargetLanguage(lang);
		try {
			result = await askAIandWait('translateSentence', { lang, content: question });
			if (!!result && !!result.usage) {
				usage = result.usage;
			}
			result = result.translation || '';
		}
		catch (err) {
			logger.error('OnSendToCyprite[Translate]', err);
			err = err.message || err.msg || err.data || err.toString();
			Notification.show(messages.cypriteName, err, "middleTop", 'error', 5 * 1000);
		}
		if (!result) result = messages.conversation.AIFailed;
	}

	addChatItem(result, 'cyprite');

	UIList.Asker.innerText = '';
	UIList.Asker.setAttribute('contentEditable', 'true');
	resizeHistoryArea(60);
	if (!!usage) showTokenUsage(usage);

	await wait();
	UIList.Asker.focus();

	runningAI = false;

	// Get Embedding Vector for Reply
	if (MatchRelevantArticlesBasedOnConversation && !!conversationVector) {
		askAIandWait('embeddingContent', {title: "Request", article: result}).then(vector => {
			if (!vector) return;
			conversationVector.push(...vector);
			if (conversationVector.length > ChatVectorLimit) conversationVector = conversationVector.splice(conversationVector.length - ChatVectorLimit, ChatVectorLimit);
		}).catch((err) => {
			Notification.show(messages.cypriteName, err, "middleTop", 'error', 5 * 1000);
		});
	}
};
UIAction.clearSummaryConversation = async () => {
	if (runningAI) {
		Notification.show(messages.cypriteName, messages.mentions.clearConversationWhileRunning, 'middleTop', 'warn', 2 * 1000);
		return;
	}
	askSWandWait('ClearSummaryConversation', location.href).catch((err) => {
		Notification.show(messages.cypriteName, err, "middleTop", 'error', 5 * 1000);
	});
	UIList.HistoryList.innerHTML = '';
};
UIAction.summarizePage = async () => {
	summarizePage(true);
};
UIAction.onClickChatItem = ({target}) => {
	while (target.getAttribute('button') !== 'true') {
		target = target.parentNode;
		if (target === document.body) return;
	}

	var action = target.getAttribute('action');
	if (action === 'copyContent') {
		onCopyContent(target);
	}
};
UIAction.onShowPageSummary = () => {
	showPageSummary(pageSummary || '');
};
UIAction.onShowTranslationResult = () => {
	showTranslationResult(translationInfo.translation);
};
UIAction.onShowComprehensive = () => {
	sendMessage('GotoConversationPage', null, 'BackEnd');
};
UIAction.copyReplyContent = async () => {
	var content;
	if (currentMode === 'summary') {
		content = pageSummary;
	}
	else if (currentMode === 'translate') {
		content = translationInfo.translation;
	}
	await navigator.clipboard.writeText(content);
	var messages = I18NMessages[myLang] || I18NMessages.en;
	Notification.show(messages.cypriteName, messages.mentions.contentCopied, 'middleTop', 'success', 2 * 1000);
};
UIAction.onEditContentTitle = async (evt) => {
	if (evt.key !== 'Enter') return;
	evt.preventDefault();

	const messages = I18NMessages[myLang] || I18NMessages.en;
	const editor = evt.target;
	const content = editor.innerText;
	pageInfo.title = content;
	try {
		await askSWandWait('ChangePageTitle', {url: location.href, title: content});
		Notification.show('', messages.fileManager.msgModifyingFileTitle, 'middleTop', 'success', 2 * 1000);
	}
	catch (err) {
		logger.error('EditContentTitle', err);
		err = err.message || err.msg || err.data || err.toString();
		Notification.show(messages.cypriteName, err, 'middleTop', 'error', 5 * 1000);
	}
};

const showPageSummary = async (summary, quick=false) => {
	currentMode = 'summary';

	const messages = I18NMessages[myLang] || I18NMessages.en;
	const conversation = await restoreConversation();
	console.log(conversation);

	if (!UIList.Container) await generateAIPanel(messages);
	document.body.querySelector('.panel_title_editor').innerText = (pageInfo.title || 'Untitled').replace(/[\n\r]+/g, ' ');

	generateModelList();
	addSummaryAndRelated(messages, UIList.Container.querySelector('.content_container'), summary);
	restoreHistory(conversation);
	resizeHistoryArea(true);
	switchPanel('summary');

	if (quick) {
		document.body.classList.remove('showCypritePanel');
		document.body.classList.add('showCypriteAccess');
	}
	else {
		document.body.classList.add('showCypritePanel');
		document.body.classList.remove('showCypriteAccess');
		findRelativeArticles(messages);
	}
};
const showTranslationResult = async (translation, list) => {
	currentMode = 'translate';

	var messages = I18NMessages[myLang] || I18NMessages.en;

	if (!UIList.Container) await generateAIPanel(messages);

	UIList.TranslationLanguage.value = translationInfo.lang || LangName[myLang] || myLang;

	var conversation = [];
	conversation.push(['ai', messages.translation.instantTranslateHint]);
	if (!!list && !!list.length) conversation.push(...list);

	generateModelList();
	parseMarkdownWithOutwardHyperlinks(UIList.Container.querySelector('.content_container'), translation || messages.translation.noTranslatedYet, messages.conversation.AIFailed);
	restoreHistory(conversation);
	resizeHistoryArea(true);
	switchPanel('translate');

	document.body.classList.add('showCypritePanel');
	document.body.classList.remove('showCypriteAccess');
};
const switchPanel = group => {
	var actionName = 'show' + group[0].toUpperCase() + group.substring(1);

	UIList.Panel.setAttribute('name', group);

	for (let tab of UIList.Panel.querySelectorAll('.panel_tabs_area .panel_tab')) tab.classList.remove('active');
	UIList.Panel.querySelector(`.panel_tabs_area .panel_tab[action="${actionName}"]`).classList.add('active');

	for (let tab of UIList.Panel.querySelectorAll('.panel_container .panel_button')) tab.classList.remove('active');
	for (let tab of UIList.Panel.querySelectorAll(`.panel_container .panel_button[group="${group}"]`)) tab.classList.add('active');
};
const onCopyContent = async target => {
	while (!target.classList.contains('chat_item')) {
		target = target.parentElement;
		if (target === document.body) return;
	}
	target = target.querySelector('.chat_content');
	var content = target._data;
	if (!content) content = getPageContent(target, true);
	await navigator.clipboard.writeText(content);
	var messages = I18NMessages[myLang] || I18NMessages.en;
	Notification.show(messages.cypriteName, messages.mentions.contentCopied, 'middleTop', 'success', 2 * 1000);
	UIList.Asker.focus();
};
const restoreHistory = conversation => {
	UIList.HistoryList.innerHTML = '';
	if (!conversation) return;
	conversation.forEach(item => {
		if (item[0] === 'human') {
			addChatItem(item[1], 'human');
		}
		else if (item[0] === 'ai') {
			addChatItem(item[1], 'cyprite');
		}
	});
};
const restoreConversation = async () => {
	if (!pageInfo) return;
	var conversation;
	try {
		conversation = await askSWandWait('GetConversation', location.href);
	}
	catch (err) {
		conversation = null;
		logger.error('RestoreConversation', err);
		err = err.message || err.msg || err.data || err.toString();
		Notification.show(messages.cypriteName, err, "middleTop", 'error', 5 * 1000);
	}
	return conversation;
};
const normalVector = vectors => {
	var weight = 0, vector = [], len = 0;
	vectors.forEach(item => {
		len = Math.max(item.vector.length, len);
	});
	for (let i = 0; i < len; i ++) vector.push(0);

	vectors.forEach(item => {
		weight += item.weight;
		item.vector.forEach((v, i) => {
			vector[i] += v * item.weight;
		});
	});
	vector = vector.map(v => v / weight);

	len = 0;
	vector.forEach(v => len += v ** 2);
	len = len ** 0.5;
	vector = vector.map(v => v / len);

	return { weight, vector };
};
const findRelativeArticles = async (messages) => {
	if (!pageInfo) return [];

	const notify = Notification.show('', messages.crossPageConv.statusFindingSimilarFiles, 'middleTop', 'message', 24 * 3600 * 1000);

	// Get similar articles
	var related, time = Date.now();
	try {
		related = await askSWandWait('SearchSimilarArticleForCurrentPage', location.href);
	}
	catch (err) {
		notify._hide();
		logger.error('FindRelativeArticles', err);
		err = err.message || err.msg || err.data || err.toString();
		Notification.show(messages.cypriteName, err, "middleTop", 'error', 5 * 1000);
		return [];
	}
	if (!!related.usage) showTokenUsage(related.usage);
	related = related.list;
	if (!related) {
		notify._hide();
		return [];
	}
	time = Date.now() - time;
	logger.info('FindRelativeArticles', 'Count: ' + related.length + ', TimeSpent: ' + time + 'ms');

	// Organize and merge lists of similar articles
	const hashes = [];
	related = related.filter(item => {
		if (!item.hash) return true;
		if (hashes.includes(item.hash)) return false;
		hashes.push(item.hash);
		return true;
	});
	relativeArticles.forEach(item => {
		var article;
		related.some(art => {
			if (!!art.hash && !!item.hash) {
				if (art.hash === item.hash) {
					article = art;
					return true;
				}
			}
			else if (art.url === item.url) {
				article = art;
				return true;
			}
		});
		if (!!article) {
			if (article.similar < item.similar) {
				article.similar = item.similar
			}
		}
		else {
			related.push(item);
		}
	});
	related.sort((a, b) => b.similar - a.similar);
	relativeArticles = [...related];

	// Show similar articles
	const container = UIList.Panel.querySelector('.related_articles_list');
	if (!!container) {
		container.innerHTML = '';
		if (relativeArticles.length === 0) {
			container.innerHTML = '<li>' + messages.summarizeArticle.noRelatedArticle + '</li>';
		}
		else {
			relativeArticles.forEach(item => {
				var frame = newEle('li', 'cyprite', 'related_articles_item');
				var link = newEle('a', 'cyprite', 'related_articles_link');
				link.innerText = item.title;
				link.href = item.url;
				link.target = '_blank';
				frame.appendChild(link);
				container.appendChild(frame);
			});
		}
	}

	notify._hide();
	return related;
};