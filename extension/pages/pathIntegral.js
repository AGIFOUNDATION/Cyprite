let availableModelList = [];
let currentAgent = null;
let resultShown = false;
let currentTaskID = null;
let currentReplies = null;
let currentReplyID = null;
let currentRequest = '';
let isRunning = false;

/* I18N */

const Messages = {
	zh: {
		buttons: {
			submit: "确认",
			cancel: "取消",
			sender: "发送",
			contentCopied: "内容已复制",
		},
		newAgent: {
			title: "新增智能体",
			hintAgentName: "智能体名字",
			hintNoEmptyName: "智能体名字不能为空",
			hintNoEmptyModels: "AI模型不能为空",
			systemPrompt: "智能体系统提示语：",
			hintSystemPrompt: "系统提示语，所有执行流程将共用此提示语，可以为空",
			runningPrompt: "运行时提示语模板：",
			hintRunningPrompt: "所有执行流程将共用此模板，请求占位符为`{{request}}`，模板可以为空",
			chooseModels: "选择要参与竞争的模型（多选）：",
			failed: "新增智能体失败……",
			updated: "智能体成功更新",
			resetStatics: "重置统计数据",
			staticsResetted: "统计数据已重置",
		},
		listAgent: {
			title: "请选择智能体",
			description: "在“竞技场”中，所有模型共用同一组系统提示语与对话历史，且会同时、共同对你做出回应，而你需要从所有回复中选择你认为最合适的回复，它将成为所有模型的新对话历史。这就像路径积分一样，每个模型是一条路径，而每次对话都是一次观测，最后所有的路径合并成为一的历史，欧耶！",
			readFail: "加载智能体失败",
			deleteFail: "删除智能体失败",
		},
		callAgent: {
			success: "成功获取回复",
			invalid: "获取无效回复",
			title: "选择回复",
			submit: "点击“发送”按钮或按“Ctrl+Enter”发送信息",
			infoNotAllDone: "请从已收到的回复中选择你认为最恰当的一个，或者等待更多回复。",
			infoAllDone: "请从已收到的回复中选择你认为最恰当的一个。",
			thinking: "内心思考",
			strategy: "回复策略",
		},
		statics: {
			hintReplyScore: "模型回复打分榜",
			hintSpeedScore: "模型回复速度榜",
		},
	},
	en: {
		buttons: {
			submit: "Submit",
			cancel: "Cancel",
			sender: "Send",
			contentCopied: "Content copied",
		},
		newAgent: {
			title: "New Agent",
			hintAgentName: "Agent Name",
			hintNoEmptyName: "Agent Name cannot be empty",
			hintNoEmptyModels: "Model list cannot be empty",
			systemPrompt: "System Prompt for Agent:",
			hintSystemPrompt: "System prompt, all execution processes will share this prompt, can be empty.",
			runningPrompt: "Runtime prompt template:",
			hintRunningPrompt: "All execution processes will share this template, the request placeholder is `{{request}}`, the template can be empty",
			chooseModels: "Select the models to participate in the competition (multiple choice):",
			failed: "Generate New Agent failed...",
			updated: "Agent updated successfully.",
			resetStatics: "Clear statistics",
			staticsResetted: "Statistical data has been reset.",
		},
		listAgent: {
			title:"Please select an Agent",
			description:"In the 'Arena' panel, all models share the same set of system prompts and conversation history, and will simultaneously respond to you. You need to choose the reply you think is most appropriate from all the responses, which will become the new conversation history for all models. Just as the 'Path Integral' in physcis suggests, each model is a path, and each conversation is an observation. In the end, all paths merge into one history. Oh yeah!",
			readFail: "Loading agent failed.",
			deleteFail: "Deleting agent failed.",
		},
		callAgent: {
			success: "Successfully obtained a reply",
			invalid: "Get invalid response",
			title: "Choose Reply",
			submit: "Click \"Send\" or press Ctrl+Enter to send a message.",
			infoNotAllDone: "Please choose the reply you find most suitable from the ones received, or wait for additional replies.",
			infoAllDone: "Please choose the reply you find most suitable from the ones received.",
			thinking: "Inner Thinking",
			strategy: "Reply Strategy",
		},
		statics: {
			hintReplyScore: "Model Response Rating Leaderboard",
			hintSpeedScore: "Model Response Speed Leaderboard",
		},
	},
};

/* DB */

const initDB = async () => {
	await initDBAgents();
};

/* Page Events */

ActionCenter.backToHome = () => {
	if (isRunning) {
		showAgentList();
		isRunning = false;
	}
	else {
		location.href = "./newtab.html";
	}
};
ActionCenter.createNewAgent = () => {
	showGenerateAgent();
};
ActionCenter.generateNewAgent = async () => {
	const messages = getMessages();

	const name = NewAgentName.value;
	if (!name) {
		Notification.show('', messages.newAgent.hintNoEmptyName, 'rightTop', "error");
		return;
	}
	const system = AgentSystemPrompt.value;
	const running = AgentRunningPrompt.value;
	const models = [...ModelListContainer.querySelectorAll('.listItem[choosen="true"]')].map(item => item.getAttribute('model'));
	if (!models.length) {
		Notification.show('', messages.newAgent.hintNoEmptyModels, 'rightTop', "error");
		return;
	}

	let id = NewAgentName.getAttribute('agent');
	let info;
	if (!id) {
		id = newID(16);
		info = {};
	}
	else {
		info = await DBs.Agents.get('agents', id);
		info = info || {};
	}
	info.id = id;
	info.type = 'arena';
	info.name = name;
	info.system = system;
	info.running = running;
	info.models = models;
	info.timestamp = Date.now();
	try {
		await DBs.Agents.set('agents', info.id, info);
	}
	catch (err) {
		logger.error("NewAgent", err);
		Notification.show('', messages.newAgent.failed, 'rightTop', "error");
		return;
	}

	showAgentList();
};
ActionCenter.closeNewAgent = () => {
	showAgentList();
};
ActionCenter.onEnterMessage = (ele, _, evt) => {
	resizeInputter();
	if (!evt.ctrlKey || evt.key !== 'Enter') return;
	ActionCenter.onSendMessage();
};
ActionCenter.onSendMessage = async () => {
	const messages = getMessages();
	const content = getPageContent(RequestInputter, true);
	if (!content) return;

	let history = [...currentAgent.conversation];
	if (!!currentAgent.system) {
		history.unshift(['system', PromptLib.assemble(currentAgent.system, {
			lang: myInfo.lang,
			userName: myInfo.name,
			userInfo: myInfo.info,
		})]);
	}
	let prompt;
	if (!currentAgent.running) {
		prompt = content;
	}
	else {
		prompt = PromptLib.assemble(currentAgent.running, {
			request: content,
			now: timestmp2str("YYYY/MM/DD hh:mm:ss :WDE:"),
		});
	}
	currentRequest = content;
	history.push(['human', prompt]);

	const replies = {}, total = currentAgent.models.length, taskID = newID();
	currentReplies = replies;
	currentTaskID = taskID;

	let count = 0;
	RequestInputter.contentEditable = false;
	RequestSender.classList.add('invalid');
	await Promise.all(currentAgent.models.map(async model => {
		let timestamp = Date.now();

		const request = {
			conversation: [...history],
			model,
		};
		let result;

		try {
			result = await askAIandWait('directSendToAI', request);
			if (currentTaskID !== taskID) return;
			result = result.reply;
			if (!result) {
				Notification.show('', messages.callAgent.invalid, "rightTop", 'fail');
			}
		}
		catch (err) {
			if (currentTaskID !== taskID) return;
			result = null;
			logger.error('Arena', err);
			err = err.message || err.msg || err.data || err.toString();
			Notification.show('', err, "rightTop", 'fetal');
		}

		count ++;
		if (!!result) {
			Notification.show('', messages.callAgent.success + ' (' + count + ' / ' + total + ')', "rightTop", 'success');
			const info = {
				id: newID(),
				model,
				timespent: Date.now() - timestamp,
				reply: result,
			}
			replies[info.id] = info;
			if (!resultShown) showReplyListUI();
			appendReply(taskID, info);
		}
		if (count < total) {
			ReplyListInfo.innerText = messages.callAgent.infoNotAllDone + ' (' + count + ' / ' + total + ')';
		}
		else {
			ReplyListInfo.innerText = messages.callAgent.infoAllDone;
		}
	}));

	if (!resultShown) {
		RequestInputter.contentEditable = true;
		RequestSender.classList.remove('invalid');
	}
};
ActionCenter.confirmReply = () => {
	const reply = currentReplies[currentReplyID];
	currentAgent.score.reply[reply.model] += 0.5;
	for (let id in currentReplies) {
		let info = currentReplies[id];
		if (info.like === true) {
			currentAgent.score.reply[info.model] ++;
		}
		else if (info.like === false) {
			currentAgent.score.reply[info.model] --;
		}
	}

	const list = Object.keys(currentReplies).map(id => [id, currentReplies[id]]);
	list.sort((a, b) => b[1].timespent - a[1].timespent);
	const min = list[list.length - 1][1].timespent;
	const max = list[0][1].timespent;
	list.forEach((info, i) => {
		info = info[1];
		let scoreR = (max - info.timespent) / (max - min);
		let scoreI = (list.length - i) / list.length;
		const power = scoreI, copower = 1 - power;
		score = scoreR * power + scoreI * copower + 0.01;
		currentAgent.score.speed[info.model] += score;
	});

	currentAgent.conversation.push(['human', currentRequest]);
	currentAgent.conversation.push(['ai', reply.reply, reply.model]);
	addChatContent('human', currentRequest);
	addChatContent('ai', reply.reply, reply.model);
	updateScoreBoard();
	saveAgent();

	RequestInputter.innerHTML = '';
	resizeInputter();

	ActionCenter.closeReplyListPanel();
};
ActionCenter.closeReplyListPanel = () => {
	currentTaskID = null;
	resultShown = false;
	document.body.removeEventListener('keyup', onKeyUp);
	RequestInputter.contentEditable = true;
	RequestSender.classList.remove('invalid');
	ReplyListPanel.style.display = "none";
	wait(100).then(() => {
		RequestInputter.focus();
	});
};
ActionCenter.showStatics = () => {
	const show = document.body.getAttribute('showStatics');
	document.body.setAttribute('showStatics', show !== 'true');
};
ActionCenter.likeReply = () => {
	if (!currentReplyID) return;
	const reply = currentReplies[currentReplyID];
	if (!reply) return;
	reply.like = true;
	ScoreTab.setAttribute('like', true);
};
ActionCenter.unlikeReply = () => {
	if (!currentReplyID) return;
	const reply = currentReplies[currentReplyID];
	if (!reply) return;
	if (reply.like !== true) return;
	delete reply.like;
	ScoreTab.removeAttribute('like');
};
ActionCenter.dislikeReply = () => {
	if (!currentReplyID) return;
	const reply = currentReplies[currentReplyID];
	if (!reply) return;
	reply.like = false;
	ScoreTab.setAttribute('like', false);
};
ActionCenter.undislikeReply = () => {
	if (!currentReplyID) return;
	const reply = currentReplies[currentReplyID];
	if (!reply) return;
	if (reply.like !== false) return;
	delete reply.like;
	ScoreTab.removeAttribute('like');
};
ActionCenter.clearConversation = () => {
	ConversationArea.innerHTML = '';
	currentAgent.conversation.splice(0);
	saveAgent();
};
ActionCenter.resetStatics = async () => {
	const messages = getMessages();
	const id = NewAgentName.getAttribute('agent');
	if (!id) return;
	const info = await DBs.Agents.get('agents', id);
	info.score = {};
	try {
		await DBs.Agents.set('agents', id, info);
		Notification.show('', messages.newAgent.staticsResetted, 'rightTop', 'success');
	}
	catch (err) {
		logger.error('Arena', err);
		err = err.message || err.msg || err.data || err.toString();
		Notification.show('', err, 'rightTop', 'error');
	}
};

const initUI = () => {
	renderI18N();
	registerAction();

	ModelListContainer.addEventListener('click', evt => {
		const target = evt.target;
		if (!target.classList.contains('listItem')) return;

		const model = target.getAttribute('model');
		const choosen = JSON.parse(target.getAttribute('choosen'));
		target.setAttribute('choosen', !choosen);
	});
	AgentListContainer.addEventListener('click', async evt => {
		const target = evt.target;
		let agent, action;
		if (target.classList.contains('listItem')) {
			agent = target.getAttribute('agent');
			action = 'apply';
		}
		else if (target.tagName === 'SPAN') {
			agent = target.parentElement.getAttribute('agent');
			action = target.getAttribute('action');
		}
		else if (target.tagName === 'IMG') {
			agent = target.parentElement.parentElement.getAttribute('agent');
			action = target.parentElement.getAttribute('action');
		}

		const messages = getMessages();
		if (action === 'apply') {
			let info;
			try {
				info = await DBs.Agents.get('agents', agent);
			}
			catch (err) {
				logger.error("ListAgent", err);
				Notification.show('', messages.listAgent.readFail, 'rightTop', "error");
				return;
			}
			showCommunicationPanel(info);
		}
		else if (action === 'delete') {
			try {
				await DBs.Agents.del('agents', agent);
			}
			catch (err) {
				logger.error("DeleteAgent", err);
				Notification.show('', messages.listAgent.readFail, 'rightTop', "error");
				return;
			}
			showAgentList();
		}
		else if (action === 'modify') {
			let info;
			try {
				info = await DBs.Agents.get('agents', agent);
			}
			catch (err) {
				logger.error("ListAgent", err);
				Notification.show('', messages.listAgent.readFail, 'rightTop', "error");
				return;
			}
			showGenerateAgent(info);
		}
	});
	RequestInputter.addEventListener('paste', evt => {
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
	});
	ReplyListPanel.addEventListener('click', evt => {
		const target = evt.target;

		if (target.classList.contains('modelTab')) {
			const tid = target.getAttribute('taskid');
			if (currentTaskID !== tid) return;
			const rid = target.getAttribute('replyid');
			if (!rid) return;
			switchModelReplyTab(rid);
		}
	});
	ConversationArea.addEventListener('click', evt => {
		const target = evt.target;
		let container = target;
		while (!container.classList.contains('chat_item')) {
			container = container.parentNode;
			if (container === document.body) {
				container = null;
				return;
			}
		}
		if (!container) return;

		if (target.classList.contains('btnCopy')) {
			const content = container._content;
			if (!content) return;
			navigator.clipboard.writeText(content).then(() => {
				const messages = getMessages();
				Notification.show('', messages.buttons.contentCopied, 'rightTop', 'success');
			});
		}
		else if (container.classList.contains('hint')) {
			if (container.getAttribute('show')) {
				container.removeAttribute('show');
			}
			else {
				container.setAttribute('show', 'true');
			}
		}
	});
	StaticsPanel.addEventListener('dblclick', () => {
		const show = StaticsPanel.getAttribute('showLable');
		StaticsPanel.setAttribute('showLable', show !== 'true');
	});
	window.addEventListener('resize', resizeInputter);
};
const showAgentList = async () => {
	let list = await DBs.Agents.all('agents');
	list = Object.values(list);
	list = list.filter(item => !item.type || item.type === 'arena');
	if (list.length === 0) {
		showGenerateAgent();
		return;
	}

	AgentListContainer.innerHTML = '';
	list.sort((a, b) => {
		const A = a.timestamp || 0;
		const B = b.timestamp || 0;
		return B - A;
	});
	list.forEach(item => {
		const ui = newEle('div', 'listItem');
		ui.setAttribute('agent', item.id);
		const cap = newEle('span', 'itemName');
		cap.innerText = item.name;
		ui.appendChild(cap);
		const btnDel = newEle('span', 'itemTool');
		btnDel.setAttribute('action', 'delete');
		btnDel.innerHTML = '<img src="../images/trash-can.svg">';
		ui.appendChild(btnDel);
		const btnMod = newEle('span', 'itemTool');
		btnMod.setAttribute('action', 'modify');
		btnMod.innerHTML = '<img src="../images/feather-pointed.svg">';
		ui.appendChild(btnMod);

		AgentListContainer.appendChild(ui);
	});

	showPanel('listAgent');
};
const showGenerateAgent = (info) => {
	info = info || {};
	NewAgentName.parentElement.setAttribute('isEdit', !!info.id);
	NewAgentName.value = info.name || '';
	if (info.id) NewAgentName.setAttribute('agent', info.id);
	else NewAgentName.removeAttribute('agent');
	AgentSystemPrompt.value = info.system || '';
	AgentRunningPrompt.value = info.running || '';
	ModelListContainer.innerHTML = '';
	info.models = info.models || [];
	for (let model of availableModelList) {
		if (model.match(/search/i)) continue;
		let item = newEle('div', 'listItem');
		item.innerHTML = model;
		item.setAttribute('model', model);
		item.setAttribute('choosen', info.models.includes(model));
		ModelListContainer.appendChild(item);
	}

	showPanel('newAgent');
};
const showCommunicationPanel = async (info) => {
	isRunning = true;

	info.name = info.name || "Tester";
	info.system = info.system || "";
	info.running = info.running || "{{request}}";
	info.models = info.models || [];
	if (!info.models.length) info.models = [myInfo.model];
	info.conversation = info.conversation || [];
	info.score = info.score || {};
	info.score.reply = info.score.reply || {};
	info.score.speed = info.score.speed || {};
	info.models.forEach(model => {
		info.score.speed[model] = info.score.speed[model] || 0;
		info.score.reply[model] = info.score.reply[model] || 0;
	});
	currentAgent = info;

	ReplyScoreBoard.innerHTML = '';
	SpeedScoreBoard.innerHTML = '';
	ConversationArea.innerHTML = '';
	currentAgent.conversation.forEach(item => addChatContent(item[0], item[1], item[2]));
	updateScoreBoard();

	showPanel('communicationPanel');
	resizeInputter();
};
const showReplyListUI = async () => {
	resultShown = true;

	currentReplyID = null;
	ScoreTab.removeAttribute('like');
	ReplyListInfo.innerHTML = '';
	ModelListTab.innerHTML = '';
	ReplyListTab.innerHTML = '';
	document.body.addEventListener('keyup', onKeyUp);
	ReplyListTab.focus();
	ReplyListPanel.style.display = "block";
};
const appendReply = (taskID, info) => {
	if (currentTaskID !== taskID) return;

	let newTab = newEle('div', 'modelTab');
	newTab.innerText = Object.keys(currentReplies).length;
	newTab.setAttribute('taskid', taskID);
	newTab.setAttribute('replyid', info.id);
	ModelListTab.appendChild(newTab);
};
const addChatContent = (type, content, model) => {
	const json = parseReplyAsXMLToJSON(content);

	const thinking = json.thinking?._origin || json.thinking;
	if (!!thinking) {
		addChatItem('thinking', thinking);
	}

	const strategy = json.strategy?._origin || json.strategy;
	if (!!strategy) {
		addChatItem('strategy', strategy);
	}

	content = json.reply?._origin || json.reply || content;
	addChatItem(type, content, model);
};
const addChatItem = (type, content, model) => {
	if (!content || !type) return;

	const item = newEle('div', 'chat_item');
	item._content = content;

	const titleBar = newEle('div', "chat_title");
	let needOperations = 0;
	if (type === 'human') {
		item.classList.add('human');
		titleBar.innerText = myInfo.name + ':';
		needOperations = 1;
	}
	else if (type === 'ai') {
		item.classList.add('ai');
		titleBar.innerText = currentAgent.name + (!!model ? ' (' + model + ')' : '') + ':';
		needOperations = 2;
	}
	else {
		item.classList.add('hint');
		const messages = getMessages();
		const title = messages.callAgent[type];
		if (!title) return;
		titleBar.innerText = title;
		let imgDown = newEle('img', 'hint', 'down');
		imgDown.src = "../images/angles-down.svg";
		titleBar.appendChild(imgDown);
		let imgUp = newEle('img', 'hint', 'up');
		imgUp.src = "../images/angles-up.svg";
		titleBar.appendChild(imgUp);
	}
	if (needOperations > 0) {
		let panel = newEle('span', 'tool_panel');
		let imgCopy = newEle('img', 'btnCopy');
		imgCopy.src = "../images/copy.svg";
		panel.appendChild(imgCopy);
		item.appendChild(panel);
	}
	item.appendChild(titleBar);

	const contentPad = newEle('div', 'chat_content');
	parseMarkdownWithOutwardHyperlinks(contentPad, content, '(Parse Failed)');
	item.appendChild(contentPad);

	ConversationArea.appendChild(item);
	wait(60).then(() => {
		const toBottom = ConversationArea.scrollHeight - ConversationArea.scrollTop;
		if (toBottom <= 50) return;
		ConversationArea.scrollTop = ConversationArea.scrollHeight - ConversationArea.offsetHeight
	});
};
const updateScoreBoard = () => {
	const board = [];
	let max = -Infinity, min = Infinity;
	for (let model in currentAgent.score.reply) {
		let score = currentAgent.score.reply[model];
		if (score > max) max = score;
		if (score < min) min = score;
	}
	if (max < 0) max = 0;
	if (min > 0) min = 0;
	const total = max - min;
	for (let model in currentAgent.score.reply) {
		if (total === 0) {
			board.push([model, 0, 0, 0]);
		}
		else {
			let score = currentAgent.score.reply[model];
			let height = 0, top = 0;
			if (score > 0) {
				height = score / total * 100;
				top = (total + min - score) / total * 100;
			}
			else {
				height = 0 - score / total * 100;
				top = (total + min) / total * 100;
			}
			board.push([model, score, height, top]);
		}
	}
	ReplyScoreBoard.innerHTML = '';
	board.sort((a, b) => b[1] - a[1]);
	board.forEach(item => {
		const ele = newEle('span', 'boardItem');
		ele.style.height = "100%";
		ele.setAttribute('neg', item[1] < 0);
		const inner = newEle('span', 'boardInnerItem');
		inner.style.height = item[2] + '%';
		inner.style.top = item[3] + '%';
		inner.setAttribute('model', item[0]);
		ele.appendChild(inner);
		ReplyScoreBoard.appendChild(ele);
	});

	board.splice(0);
	for (let model in currentAgent.score.speed) {
		board.push([model, currentAgent.score.speed[model]]);
	}
	SpeedScoreBoard.innerHTML = '';
	board.sort((a, b) => b[1] - a[1]);
	board.forEach((item, i) => {
		const ele = newEle('span', 'boardItem');
		ele.style.height = (item[1] / board[0][1] * 100) + '%';
		ele.setAttribute('model', item[0]);
		SpeedScoreBoard.appendChild(ele);
	});
};
const resizeInputter = () => {
	var box = RequestInputter.getBoundingClientRect();
	var height = box.height;
	if (height === box._lastHeight) return;
	RequestSender.style.height = height + 'px';
	box = ConversationArea.parentElement.getBoundingClientRect();
	ConversationArea.style.height = (box.height - height - 10) + 'px';
	box._lastHeight = height;
};
const saveAgent = async () => {
	currentAgent.timestamp = Date.now();
	try {
		await DBs.Agents.set('agents', currentAgent.id, currentAgent);
	}
	catch (err) {
		logger.error("SaveAgent", err);
		const messages = getMessages();
		Notification.show('', messages.newAgent.updated, 'rightTop', "error");
	}
};
const switchModelReplyTab = (rid) => {
	currentReplyID = rid;
	const last = ReplyListPanel.querySelectorAll('.modelTab.active');
	if (!!last) [...last].forEach(ele => ele.classList.remove('active'));
	ReplyListPanel.querySelector('.modelTab[replyid="' + rid + '"]').classList.add('active');

	const reply = currentReplies[rid] || {};
	let content = reply.reply || '';
	const json = parseReplyAsXMLToJSON(content);
	content = json.reply?._origin || json.reply || content;
	parseMarkdownWithOutwardHyperlinks(ReplyListTab, content, '(parse failed)');
	ReplyListTab.scrollTop = 0;

	if (isBoolean(reply.like)) ScoreTab.setAttribute('like', reply.like);
	else ScoreTab.removeAttribute('like');
};
const onKeyUp = evt => {
	if (evt.key === 'PageDown') {
		let current = ModelListTab.querySelector('.modelTab.active');
		if (!current) {
			current = ModelListTab.querySelector('.modelTab');
		}
		else {
			current = current.nextElementSibling;
			if (!current) current = ModelListTab.querySelector('.modelTab');
		}
		switchModelReplyTab(current.getAttribute('replyid'));
	}
	else if (evt.key === 'PageUp') {
		let current = ModelListTab.querySelector('.modelTab.active');
		if (!current) {
			current = [...ModelListTab.querySelectorAll('.modelTab')];
			current = current[current.length - 1];
		}
		else {
			current = current.previousElementSibling;
			if (!current) {
				current = [...ModelListTab.querySelectorAll('.modelTab')];
				current = current[current.length - 1];
			}
		}
		switchModelReplyTab(current.getAttribute('replyid'));
	}
	else if (evt.key === 'l') {
		const reply = currentReplies[currentReplyID];
		if (!reply) return;
		if (reply.like === true) {
			delete reply.like;
			ScoreTab.removeAttribute('like');
		}
		else {
			reply.like = true;
			ScoreTab.setAttribute('like', true);
		}
	}
	else if (evt.key === 'd') {
		const reply = currentReplies[currentReplyID];
		if (!reply) return;
		if (reply.like === false) {
			delete reply.like;
			ScoreTab.removeAttribute('like');
		}
		else {
			reply.like = false;
			ScoreTab.setAttribute('like', false);
		}
	}
	else if (evt.key === 'Enter') {
		if (!currentReplyID) return;
		ActionCenter.confirmReply();
	}
	else if (evt.key === 'Escape') {
		ActionCenter.closeReplyListPanel();
	}
};

/* Init */

const onLoad = async () => {
	initUI();

	await showAgentList();

	document.body.removeAttribute('loading');
};
const init = async () => {
	const info = await Promise.all([
		chrome.tabs.getCurrent(),
		initDB(),
		getConfig(),
	]);

	currentTabId = info[0].id;

	let list = await askSWandWait('GetAvailableModelList');
	availableModelList = list.filter(model => !model.match(/search/i));
	checkInit('init');
};

initTasks.init = false;
init();