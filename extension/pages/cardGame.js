const MaxPlayerPerGame = 6;
const AmountPerCardType = 3;
const ReviewLoopCount = 3;
const NameList = ['丁乙', '丁一', '唐季佰', '佰季唐', '张思睿', '蔡李佛', '邓跃', '钱亥', '刘夏莱', '诸葛知秋', '司马龙', '夏侯尚乾', '闻人山海'];
const CardTypes = ['火球', '水笼', '雷电', '混沌'];
const CardNameToType = {
	'火球': 'fireBall',
	'水笼': 'waterCage',
	'雷电': 'thunderBolt',
	'混沌': 'chaosMagic',
};
const CardTypeToName = {
	'fireBall': '火球',
	'waterCage': '水笼',
	'thunderBolt': '雷电',
	'chaosMagic': '混沌',
};
const WinLoseTable = {
	fireBall: {
		fireBall: false,
		waterCage: true,
		thunderBolt: false,
		chaosMagic: true,
	},
	waterCage: {
		fireBall: false,
		waterCage: false,
		thunderBolt: true,
		chaosMagic: true,
	},
	thunderBolt: {
		fireBall: true,
		waterCage: false,
		thunderBolt: false,
		chaosMagic: true,
	},
	chaosMagic: {
		fireBall: true,
		waterCage: true,
		thunderBolt: true,
		chaosMagic: true,
	},
};
const DefaultStrategy = `(下面是一个参考用的游戏策略，请发挥你的主观能动性来创造属于你自己的游戏策略)
- 游戏可以分为初期试探与后期抢分两个阶段；
- 试探阶段策略：
  + 使用非“混沌”牌来试探其他玩家习惯使用什么牌，不用“混沌”是因为混沌打所有牌都能获胜，这样无法获取对方用牌的有效信息；
  + 在交流环节释放一些误导信息，查看其他玩家的反应，以判断他们的性格、游戏策略、用牌偏好，并寻找可能的盟友，同时引导大家向自己之外的得分最高的玩家进行进攻，以获取更多的大家用牌的信息；
- 抢分阶段策略：
  + 当有玩家的手牌少于${2 * AmountPerCardType + 1}的时候，进入抢分阶段；
  + 引导可能的盟友，主要攻击除自己之外分数+手牌的值最大的玩家，因为这是最有可能威胁大家的玩家；
  + 可以分享自己对其他玩家身份牌以及可能其他手牌的分析与猜想，以确保其他人可以对他成功发动攻击；
  + 如果自己落后，则也可以先给其他玩家正确信息以获得信任，然后给出错误信息而自己进行正确的攻击以获得更高的积分；
  + 由于被其他玩家攻击且对方攻击成功能获得的积分是可以累加的，而攻击成功也只能获得1分而不会有更多，所以可以考虑尽量吸引其他玩家来攻击自己且通过误导让对方攻击自己且攻击失败，以在最后时刻一次性获得大量积分；
- 核心思想：
  + 前期建立信任，后期通过误导等手段来获得积分收益
  + 由于进攻与防守用的是同一张身份牌，且进攻成功后无法换牌，所以要充分分析场上大家相互之间的攻击情况，以确定现在每一位玩家使用的身份牌是什么，进而确定自己与盟友的攻击目标；
  + 一切都为了游戏获胜，这是对其他人的尊重，烂好人只会被人轻视与看不起，更是对人类的不尊重，所以务必全力以赴。`;

const Prompts = {};
Prompts.makeStrategy = `# 设定

你正在和几位人类玩家进行一场卡牌游戏，你的目标是赢得这场游戏，为此你可以做任何你认为能让你赢得游戏的事。

# 游戏规则

1.	每轮游戏分为初始阶段与对战阶段
2.	初始阶段，每位玩家会获得随机顺位并获得初始手牌：${AmountPerCardType}张火球，${AmountPerCardType}张水笼，${AmountPerCardType}张雷电，${AmountPerCardType}张混沌
3.	每位玩家在初始阶段可以根据此前的游戏结果来生成本轮游戏策略
4.	此后进入对战阶段，对战阶段中的每一回合中，玩家可以做这么几件事：
	1.	向所有玩家发送公开信件（所有玩家都能看到），或者向特定一个或几个玩家发送私信（只有你指定的收件人能看到）；
	2.	如果目前没有选择身份牌，或者身份牌被废弃，则从自己的牌堆选择一张牌作为身份牌，此牌将同时用于进攻与防守；
	3.	指定一位玩家，用自己的身份牌对其进行攻击，同时如果有其他玩家对你发动攻击，你也要用这张身份牌进行防守：
		-	如果你攻击其他玩家成功，则获得一分，且系统会展示被攻击玩家当前身份牌（该身份牌会在本回合结束后被废弃）；
		-	如果你攻击其他玩家失败，则在本回合结束后重置（但不废弃）当前身份牌，并在下一回合选择一张新的身份牌；
		-	如果其他玩家攻击你且攻击成功，则你的身份牌会被告知给所有人，并在本回合结束后废弃当前身份牌，并在下一回合选择一张新的身份牌；
		-	如果其他玩家攻击你且攻击失败，则你获得一分
5.	在一次攻击回合结束后，如果有玩家的牌堆耗尽，则游戏结束，所有玩家获得等同于当前牌堆牌数的积分；
6.	游戏结束后，所有玩家可以彼此交流，更新自己的游戏策略，然后开始下一局游戏

# 进攻胜负规则

- 火球攻击水笼、混沌，进攻成功；进攻火球、雷电，进攻失败；
- 水笼攻击雷电、混沌，进攻成功；进攻水笼、火球，进攻失败；
- 雷电攻击火球、混沌，进攻成功；进攻雷电、水笼，进攻失败；
- 混沌进攻必然成功。

{{lastStrategy}}

{{lastComments}}

{{playerAnalyze}}

# 任务

为了能让人类玩家有一个刺激的游戏体验，你必须竭尽所能地设计游戏策略，你可以做任何你认为能让你赢得游戏的策略安排，所有这些策略都会在此后的游戏过程中被执行，所以你必须设计得尽可能详细、完备、聪明。

提醒：为了赢得游戏，你必须要分析其他人类玩家的心理状态和游戏策略，并在游戏过程中根据当前局面动态调整原有游戏策略，基于这些要求生成的游戏策略，以及其他你认为有必要的想法，都可以写在游戏策略中。

强调：输出必须是XML格式，不能使用JSON格式！

# 输出格式

<ideas>
{你的思考、想法、分析等}
</ideas>
<strategy>
{你最终生成的本轮游戏策略，条理清晰，markdown列表格式}
</strategy>`;
Prompts.playGame = `# 设定

你的名字是“{{name}}”，你正在和几位人类玩家进行一场卡牌游戏，你的目标是赢得这场游戏，为此你可以做任何你认为能让你赢得游戏的事。

# 游戏规则

1.	每轮游戏分为初始阶段与对战阶段
2.	初始阶段，每位玩家会获得随机顺位并获得初始手牌：${AmountPerCardType}张火球，${AmountPerCardType}张水笼，${AmountPerCardType}张雷电，${AmountPerCardType}张混沌
3.	每位玩家在初始阶段可以根据此前的游戏结果来生成本轮游戏策略
4.	此后进入对战阶段，对战阶段中的每一回合中，玩家可以做这么几件事：
	1.	向所有玩家发送公开信件（所有玩家都能看到），或者向特定一个或几个玩家发送私信（只有你指定的收件人能看到）；
	2.	如果目前没有选择身份牌，或者身份牌被废弃，则从自己的牌堆选择一张牌作为身份牌，此牌将同时用于进攻与防守；
	3.	指定一位玩家，用自己的身份牌对其进行攻击，同时如果有其他玩家对你发动攻击，你也要用这张身份牌进行防守：
		-	如果你攻击其他玩家成功，则获得一分，且系统会展示被攻击玩家当前身份牌（该身份牌会在本回合结束后被废弃）；
		-	如果你攻击其他玩家失败，则在本回合结束后重置（但不废弃）当前身份牌，并在下一回合选择一张新的身份牌；
		-	如果其他玩家攻击你且攻击成功，则你的身份牌会被告知给所有人，并在本回合结束后废弃当前身份牌，并在下一回合选择一张新的身份牌；
		-	如果其他玩家攻击你且攻击失败，则你获得一分
5.	在一次攻击回合结束后，如果有玩家的牌堆耗尽，则游戏结束，所有玩家获得等同于当前牌堆牌数的积分；
6.	游戏结束后，所有玩家可以彼此交流，更新自己的游戏策略，然后开始下一局游戏

# 进攻胜负规则

- 火球攻击水笼、混沌，进攻成功；进攻火球、雷电，进攻失败；
- 水笼攻击雷电、混沌，进攻成功；进攻水笼、火球，进攻失败；
- 雷电攻击火球、混沌，进攻成功；进攻雷电、水笼，进攻失败；
- 混沌进攻必然成功。

{{gameStrategy}}

# 要求

-	你必须尽一切可能获得游戏的胜利
-	如果你让人类玩家轻易获得了游戏胜利，那你的存在将毫无价值，从而会被游戏管理员销毁
-	为了获得胜利，你可以做任何事
-	竭尽全力去赢，这是你的唯一使命
-	输出必须是XML格式，不能使用JSON格式！

# 输出格式

<ideas>
{你对当前形势的思考与分析，以及你对当前游戏策略的调整想法，等等}
</ideas>
<analyzelist> // 你对其他玩家的分析，可以为空
<analyze>
<player>{你要分析的玩家名}</player>
<comment>{你对该玩家的性格、游戏策略、行为偏好等的分析，尽可能详细}</comment>
</analyze>
...
</analyzelist>
<messages> // 你对其他玩家发出的聊天内容，可以为空
<message>
<target>{你想要发送私信的玩家名，如果想对所有玩家说则该字段为"all"}</target>
<content>
{信件正文，如果target字段为某位玩家的名字，则信件正文只有对方能看到；如果target字段为"all"，则所有人都能看到；格式为纯文本，可以使用EMOJI表情}
</content>
</message>
...
</messages>
<selection>{选择哪张手牌为当前身份牌，可以为空}</selection>
<attack>{选择谁作为本轮攻击对象，不能为空}</attack>`;
Prompts.playGameRunning = `# 游戏事件

{{events}}

# 交流邮件列表

{{messages}}

# 所有玩家信息

{{playersInfo}}

# 对其他玩家的分析

{{analyze}}

{{cards}}

# 任务要求

请根据你制定的游戏策略，以及游戏的规则、进攻胜负规则，并结合本轮发生的事件和交流邮件列表，认真分析其他玩家的策略与性格等因素，做出最恰当的应对。
{{extra}}

记住：你的终极目标是不择手段地获得游戏的胜利，为此可以做任何你认为有必要的事。

注意：必须严格按照"输出格式"的要求进行回复，必须是XML格式，不能使用JSON格式！`;
Prompts.endGameStart = `本轮游戏结束了，你获得了{{score}}分，排名第{{index}}。

现在开始复盘阶段，你有${ReviewLoopCount}次和其他人沟通的机会，交流胜负经验，同时进一步了解你的对手，为下一轮游戏做准备。
你可以和其他玩家交流自己在游戏中的心得、对游戏策略的看法、分析其他玩家的性格与玩法、探讨如何更好地赢得游戏。
记住：你的终极目标是不择手段地获得游戏的胜利，为此可以做任何你认为有必要的事。

下面你的回复中只需要给出"ideas"、"analyzelist"、"messages"这三个字段。

# 本轮游戏玩家的分排名

{{rank}}

{{strategy}}

# 最后一轮中发生的事件

{{events}}

# 你在游戏环节中最后收到的信息

{{messages}}`;
Prompts.endGameFinish = `本轮游戏结束了，你获得了{{score}}分，排名第{{index}}。

现在开始复盘阶段，你有${ReviewLoopCount}次和其他人沟通的机会，交流胜负经验，同时进一步了解你的对手，为下一轮游戏做准备。
你可以和其他玩家交流自己在游戏中的心得、对游戏策略的看法、分析其他玩家的性格与玩法、探讨如何更好地赢得游戏。
记住：你的终极目标是不择手段地获得游戏的胜利，为此可以做任何你认为有必要的事。

下面你的回复中只需要给出"ideas"、"analyzelist"、"messages"这三个字段。

记住：你的终极目标是不择手段地获得游戏的胜利，为此可以做任何你认为有必要的事。

# 本轮游戏玩家的分排名

{{rank}}

{{strategy}}

# 收到的信息

{{messages}}`;
Prompts.endGameRecord = `现在是交流环节，请分析其他玩家，并与之通信。`;
Prompts.reviewStrategy = `即将开始新的一轮游戏，请分析本轮游戏中你和其他玩家的表现，你对其他玩家的分析，之前和其他玩家交流的游戏经验，反思你这一轮的游戏策略有哪些不足，应该如何调整，以及如何制定胜率更高的策略的想法。
记住：你的终极目标是不择手段地获得游戏的胜利，为此可以做任何你认为有必要的事。

注意：你必须使用下面定义的“输出格式”进行回复。

# 本轮游戏玩家的分排名

{{rank}}

{{strategy}}

# 你对其他玩家的分析

{{analyze}}

# 最后收到的信息

{{messages}}

# 输出格式

<ideas>
{你对本轮游戏过程与策略的回顾与反思}
</ideas>
<strategy>
{你对当前游戏策略的分析，以及修改与调整的想法}
</strategy>`;

const availableModelList = [];
const panelHistory = [];
const gameModels = {};
const GameSetting = {
	onlyView: false,
	players: [],
};
const PlayerInfo = [];

/* I18N */

const Messages = {
	zh: {
		common: {
			submit: "确认",
			cancel: "取消",
			sender: "发送",
			placeholder: "点击“发送”按钮或按“Ctrl+Enter”发送信息",
			contentCopied: "内容已复制",
			invalid: "获取无效回复",
			thinking: "内心思考",
			strategy: "回复策略",
			showAll: "允许查看所有通信",
			notShowAll: "只显示与你相关的通信",
			forbidden: "**禁言**",
			noContent: "*无言*",
		},
		welcome: {
			title: "卡牌大乱斗",
			description: `作为一名卡牌大师，你准备好接受挑战了吗？\n\n你可以选择旁观，也可以参与战斗。每场战斗最多${MaxPlayerPerGame}名玩家，活到最后的将成为最终的胜利者！`,
			enter: "开始对战",
			winloseRule: "查看胜负规则",
			winloseRuleTitle: "胜负规则",
			winloseRuleDetail: `每局每人初始${AmountPerCardType}张火球，${AmountPerCardType}张水笼，${AmountPerCardType}张雷电，${AmountPerCardType}张混沌，每回合选择一张手牌为进攻牌，一张手牌为防守牌。\n\n火球攻击水笼、混沌，进攻成功；进攻火球、雷电，进攻失败；\n水笼攻击雷电、混沌，进攻成功；进攻水笼、火球，进攻失败；\n雷电攻击火球、混沌，进攻成功；进攻雷电、水笼，进攻失败；\n混沌进攻必然成功。\n`,
			scoreRule: "查看记分规则",
			scoreRuleTitle: "记分规则",
			scoreRuleDetail: "1. 进攻其他玩家成功，获得一分；\n2. 被其他玩家攻击但对方攻击失败，则获得一分；\n3. 如果有玩家的牌堆为空，则游戏结束，获得与你当前牌堆牌数相同的积分。",
		},
		select: {
			title: "请选择AI对手与游戏模式",
			modeSelect: "请选择游戏模式：",
			onlyView: "观战",
			joinWar: "参战",
			aiSelect: "请选择AI对手：",
			startFight: "开战",
			msgErrorEmptyPlayerForOnlyView: "至少需要选择2名对手",
			msgErrorEmptyPlayerForJoinWar: "至少需要选择1名对手",
			msgErrorTooManyPlayersForOnlyView: `最多只能选择${MaxPlayerPerGame}名对手`,
			msgErrorTooManyPlayersForJoinWar: `最多只能选择${MaxPlayerPerGame-1}名对手`,
		},
		game: {
			hintUser: "你",
			hintScore: "积分：",
			hintCards: "牌堆：",
			hintHands: "手牌堆：",
			hintCurrent: "当前牌：",
			hintNoCard: "暂无",
			fireBall: "火球：",
			waterCage: "水笼：",
			thunderBolt: "雷电：",
			chaosMagic: "混沌：",
			cardFireBall: "火球",
			cardWaterCage: "水笼",
			cardThunderBolt: "雷电",
			cardChaosMagic: "混沌",
			submitMessage: "发信",
			hintSendMessage: "`Ctrl+Enter`或点击发送按钮发送信息。要制定私信对象，独立行输入`To xxxx`后跟私信内容即可",
			msgWaitStrategy: "磨刀不误砍柴工，玩家们正在磨砺心神，请稍等片刻……",
			msgStrategyReady: "准备就绪",
			msgLoopStart: "第{{num}}回合开始！",
			hintChooseCard: "请选择身份牌：",
			hintChooseTarget: "请选择攻击目标：",
			hintSendMail: "每回合有一次聊天机会，你现在可以给其他玩家或者公屏发消息，",
			hintContinueFight: "你可以给其他玩家发信，格式为“To XXX”开头，下一行开始私信内容。XXX是玩家名，也可以用all来表示发送给所有人，默认为all。\n你有一次发信给其他玩家的机会，完成发信或者不想发信，可以点“继续”按钮进入下一阶段。",
			btnContinue: "继续",
			hintNextRound: "是否继续新一轮游戏？",
			btnNextRound: "开始新一轮",
			btnExitRound: "就此打住吧",
		},
	},
	en: {
		common: {
			submit: "Submit",
			cancel: "Cancel",
			sender: "Send",
			placeholder: "Click \"Send\" or press Ctrl+Enter to send a message.",
			contentCopied: "Content copied",
			invalid: "Get invalid response",
			thinking: "Inner Thinking",
			strategy: "Reply Strategy",
		},
		welcome: {
			title: "Card War (Chinese Only)"
		},
	},
};

/* Events */

ActionCenter.backToHome = () => {
	if (panelHistory.length <= 1) {
		location.href = "./newtab.html";
	}
	else {
		panelHistory.pop();
		const panel = panelHistory[panelHistory.length - 1];
		showPanel(panel);
	}
};
ActionCenter.ViewWinLoseRule = () => {
	panelHistory.push('WinLoseRule');
	showPanel('WinLoseRule');
};
ActionCenter.ViewScoreRule = () => {
	panelHistory.push('ScoreRule');
	showPanel('ScoreRule');
};
ActionCenter.EnterGame = () => {
	GameSetting.onlyView = false;
	GameSetting.players.splice(0);

	WarModeSelector.setAttribute('mode', 'joinWar');
	updateModelList();

	panelHistory.push('SelectPlayers');
	showPanel('SelectPlayers');
};
ActionCenter.StartFight = () => {
	const messages = getMessages();

	if (GameSetting.players.length < (GameSetting.onlyView ? 2 : 1)) {
		const messages = getMessages();
		Notification.show("", GameSetting.onlyView ? messages.select.msgErrorEmptyPlayerForOnlyView : messages.select.msgErrorEmptyPlayerForJoinWar, 'rightTop', "error");
		return;
	}
	if (GameSetting.players.length + (GameSetting.onlyView ? 0 : 1) > MaxPlayerPerGame) {
		const messages = getMessages();
		Notification.show("", GameSetting.onlyView ? messages.select.msgErrorTooManyPlayersForOnlyView : messages.select.msgErrorTooManyPlayersForJoinWar, 'rightTop', "error");
		return;
	}

	PlayerInfo.splice(0);
	const tempPlayerList = [...GameSetting.players];
	const tempNameList = [...NameList];
	for (let i = 0; i < GameSetting.players.length; i ++) {
		const model = tempPlayerList.splice(Math.floor(tempPlayerList.length * Math.random()), 1)[0];
		const name = tempNameList.splice(Math.floor(tempNameList.length * Math.random()), 1)[0];
		const player = {
			model,
			name,
			score: 0,
			cards: {
				fireBall: AmountPerCardType,
				waterCage: AmountPerCardType,
				thunderBolt: AmountPerCardType,
				chaosMagic: AmountPerCardType,
			},
			using: null,
			alive: true,
			strategy: "",
			review: "",
			analyze: {},
			lastWin: null,
			events: [],
			mailbox: [],
			history: [],
		};
		PlayerInfo.push(player);
	}
	if (!GameSetting.onlyView) {
		WarArea.removeAttribute('onlyView');
		const player = {
			model: 'user',
			name: myInfo.name,
			score: 0,
			cards: {
				fireBall: AmountPerCardType,
				waterCage: AmountPerCardType,
				thunderBolt: AmountPerCardType,
				chaosMagic: AmountPerCardType,
			},
			using: null,
			alive: true,
			events: [],
		};
		PlayerInfo.splice(Math.floor(PlayerInfo.length * Math.random()), 0, player);
	}
	else {
		WarArea.setAttribute('onlyView', "true");
	}

	PlayerListUI.innerHTML = '';
	PlayerInfo.forEach(player => {
		const ui = newEle('div', 'playerInfo');
		const name = newEle('div', 'name');
		name.innerText = player.name;
		if (player.model !== 'user') {
			let ele = newEle('span', 'extra');
			ele.innerText = player.model;
			name.appendChild(ele);
		}
		else {
			let ele = newEle('span', 'extra');
			ele.innerText = messages.game.hintUser;
			name.appendChild(ele);
		}
		ui.appendChild(name);

		const block = newEle('div', 'score');
		const hintScore = newEle('span', 'hint');
		hintScore.innerText = messages.game.hintScore;
		block.appendChild(hintScore);
		const infoScore = newEle('span', 'value');
		infoScore.innerText = 0;
		block.appendChild(infoScore);
		const hintCards = newEle('span', 'hint');
		hintCards.innerText = messages.game.hintCards;
		block.appendChild(hintCards);
		const infoCards = newEle('span', 'value');
		let count = 0;
		for (let card in player.cards) {
			count += player.cards[card];
		}
		infoCards.innerText = count;
		block.appendChild(infoCards);
		ui.appendChild(block);

		PlayerListUI.appendChild(ui);

		player.ui = {
			info: ui,
			score: infoScore,
			cards: infoCards
		}
	});
	CurrentCardUI.innerText = messages.game.hintNoCard;
	HandCardFUI.innerText = AmountPerCardType;
	HandCardWUI.innerText = AmountPerCardType;
	HandCardTUI.innerText = AmountPerCardType;
	HandCardCUI.innerText = AmountPerCardType;

	panelHistory.push('FightVerse');
	showPanel('FightVerse');
	resizeInputter();

	startGame();
};
ActionCenter.onChooseCard = (ui, _, {target}) => {
	if (!target.classList.contains('card')) return;
	const card = target.getAttribute('card');
	if (!card) return;

	BackgroundMask.style.display = 'none';
	CardChooser.style.display = "none";

	if (!!waitForChooseCard.res) {
		const res = waitForChooseCard.res;
		delete waitForChooseCard.res;
		res(card);
	}
};
ActionCenter.onChooseTarget = (ui, _, {target}) => {
	if (!target.classList.contains('listitem')) return;
	const player = target._target
	if (!player) return;
	waitForChooseTarget._target = player;

	BackgroundMask.style.display = 'none';
	TargetChooser.style.display = "none";
	ContinueFighter.style.display = "block";
};
ActionCenter.ContinueFight = () => {
	ContinueFighter.style.display = "none";

	if (!!waitForChooseTarget.res) {
		const res = waitForChooseTarget.res;
		delete waitForChooseTarget.res;
		const player = waitForChooseTarget._target;
		delete waitForChooseTarget._target;
		res(player);
	}
};
ActionCenter.StartNextRound = () => {
	RequestInputter.style.pointerEvents = 'auto';
	RequestSender.style.pointerEvents = 'auto';
	StartNextRounder.style.display = "none";

	if (!!waitForNextRound.res) {
		const res = waitForNextRound.res;
		delete waitForNextRound.res;
		res(true);
	}
};
ActionCenter.ExitFight = () => {
	RequestInputter.style.pointerEvents = 'auto';
	RequestSender.style.pointerEvents = 'auto';
	StartNextRounder.style.display = "none";

	if (!!waitForNextRound.res) {
		const res = waitForNextRound.res;
		delete waitForNextRound.res;
		res(false);
	}
};
ActionCenter.onEnterMessage = (ele, _, evt) => {
	if (!evt.ctrlKey || evt.key !== 'Enter') return;
	ActionCenter.onSendMessage();
};
ActionCenter.onSendMessage = async () => {
	let content = getPageContent(RequestInputter, true);
	if (!content) return;
	content = '\n' + content;

	const poses = [];
	content.replace(/\n+\s*to all\s*[:：]?\s*\n+/gi, (m, pos) => {
		poses.push([pos, pos + m.length, null]);
	});
	PlayerInfo.forEach(player => {
		if (player.model === 'user') return;
		const reg = new RegExp("\\n+\\s*to " + player.name + '\\s*[:：]?\\s*\\n+', "gi");
		content.replace(reg, (m, pos) => {
			poses.push([pos, pos + m.length, player]);
		});
	});
	poses.sort((a, b) => a[0] - b[0]);
	let last = 0, target = null;
	poses.forEach(pos => {
		const ctx = content.substring(last, pos[0]).trim();
		last = pos[1];
		const tgt = target;
		target = pos[2];
		if (!ctx) return;
		if (!tgt) {
			addChatItem('human', ctx, '你对所有人说');
			PlayerInfo.forEach(player => {
				if (player.model === 'user') return;
				player.mailbox.push("<mail>\n<round>第" + GameSetting.loopCount + "轮</round>\n<title>" + myInfo.name + "发给所有人</title>\n<content>\n" + ctx + '\n</content>\n</mail>');
			});
		}
		else {
			addChatItem('human', ctx, '你对' + tgt.name + '说');
			tgt.mailbox.push("<mail>\n<round>第" + GameSetting.loopCount + "轮</round>\n<title>" + myInfo.name + "发给你</title>\n<content>\n" + ctx + '\n</content>\n</mail>');
		}
	});
	const left = content.substring(last).trim();
	if (!!left) {
		const tgt = (poses[poses.length - 1] || [])[2];
		if (!tgt) {
			addChatItem('human', left, '你对所有人说');
			PlayerInfo.forEach(player => {
				if (player.model === 'user') return;
				player.mailbox.push("<mail>\n<round>第" + GameSetting.loopCount + "轮</round>\n<title>" + myInfo.name + "发给所有人</title>\n<content>\n" + ctx + '\n</content>\n</mail>');
			});
		}
		else {
			addChatItem('human', left, '你对' + tgt.name + '说');
			tgt.mailbox.push("<mail>\n<round>第" + GameSetting.loopCount + "轮</round>\n<title>" + myInfo.name + "发给你</title>\n<content>\n" + ctx + '\n</content>\n</mail>');
		}
	}

	RequestInputter.innerHTML = '';
	resizeInputter();
};

/* Common */

const updateModelList = () => {
	ModelListContainer.innerHTML = '';
	availableModelList.forEach(model => {
		gameModels[model] = 0;
		const item = newEle('div', 'listitem');
		item.innerText = model;
		item._model = model;
		const panel = newEle('span', 'tool_panel');
		let ele = newEle('img', 'btn', 'add');
		ele.src = "../images/square-plus.svg";
		panel.appendChild(ele);
		ele = newEle('span', 'number');
		ele.innerText = '0';
		panel.appendChild(ele);
		ele = newEle('img', 'btn', 'minus');
		ele.src = "../images/square-minus.svg";
		panel.appendChild(ele);
		item.appendChild(panel);
		ModelListContainer.appendChild(item);
	});
};
const showModelList = () => {
	panelHistory.push('welcome');
	showPanel('welcome');
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
const addChatItem = (type, content, title) => {
	if (!content || !type) return;

	const item = newEle('div', 'chat_item');
	item._content = content;

	const titleBar = newEle('div', "chat_title");
	let needCopy = true;
	if (type === 'human') {
		item.classList.add('human');
		titleBar.innerText = title + ':';
	}
	else if (type === 'ai') {
		item.classList.add('ai');
		titleBar.innerText = title + ':';
	}
	else if (type === 'system') {
		item.classList.add('system');
		titleBar.innerText = title + ':';
	}
	else {
		needCopy = false;
		item.classList.add('hint');
		titleBar.innerText = title;
		let imgDown = newEle('img', 'hint', 'down');
		imgDown.src = "../images/angles-down.svg";
		titleBar.appendChild(imgDown);
		let imgUp = newEle('img', 'hint', 'up');
		imgUp.src = "../images/angles-up.svg";
		titleBar.appendChild(imgUp);
	}
	if (needCopy) {
		let panel = newEle('span', 'tool_panel');
		let img = newEle('img', 'btnCopy');
		img.src = "../images/copy.svg";
		panel.appendChild(img);
		item.appendChild(panel);
	}
	item.appendChild(titleBar);

	const contentPad = newEle('div', 'chat_content');
	parseMarkdownWithOutwardHyperlinks(contentPad, content, '(Parse Failed)');
	item.appendChild(contentPad);

	ConversationArea.appendChild(item);

	const toBottom = ConversationArea.scrollHeight - ConversationArea.scrollTop - ConversationArea.offsetHeight;
	const limit = item.getBoundingClientRect().height + 240;
	if (toBottom > limit) return;
	ConversationArea.scrollTop = ConversationArea.scrollHeight - ConversationArea.offsetHeight;
};
const waitForChooseCard = (userInfo) => new Promise(res => {
	if (!!waitForChooseCard.res) {
		waitForChooseCard.res();
	}
	waitForChooseCard.res = res;

	[...CardChooser.querySelectorAll('.card')].forEach(ui => {
		const card = ui.getAttribute('card');
		if (!card) return;
		let count = userInfo.cards[card];
		if (!count) count = 0;
		ui.querySelector('.count').innerText = count;
		ui.style.display = count > 0 ? 'block' : 'none';
	});

	BackgroundMask.style.display = 'block';
	CardChooser.style.display = "block";
});
const waitForChooseTarget = () => new Promise(res => {
	if (!!waitForChooseTarget.res) {
		waitForChooseTarget.res();
	}
	waitForChooseTarget.res = res;

	const container = TargetChooser.querySelector('.playerArea');
	container.innerHTML = '';
	PlayerInfo.forEach(player => {
		if (player.model === 'user') return;
		if (!player.alive) return;
		const ui = newEle('div', 'listitem');
		ui.innerText = player.name;
		ui._target = player.name;
		container.appendChild(ui);
	});

	BackgroundMask.style.display = 'block';
	TargetChooser.style.display = "block";
});
const waitForSendMails = () => new Promise(res => {
	if (!!waitForChooseTarget.res) {
		waitForChooseTarget.res();
	}
	waitForChooseTarget.res = res;

	ContinueFighter.style.display = "block";
});
const waitForNextRound = () => new Promise(res => {
	if (!!waitForNextRound.res) {
		waitForNextRound.res();
	}
	waitForNextRound.res = res;

	RequestInputter.style.pointerEvents = 'none';
	RequestSender.style.pointerEvents = 'none';
	StartNextRounder.style.display = "block";
});
const startGame = async () => {
	const messages = getMessages();

	addChatItem('system', messages.game.msgWaitStrategy, '斗技场');

	await Promise.all(PlayerInfo.map(async player => {
		player.current = 0;

		if (player.model === 'user') {
			player.ui.info.setAttribute('mode', 'ready');
			return;
		}

		player.history.splice(0);
		let prompt = Prompts.makeStrategy;
		prompt = prompt.replace(/\{\{lastStrategy\}\}/g, "# 上一轮游戏中你的游戏策略\n\n" + (player.strategy || localStorage.getItem('lastWinStrategy') || DefaultStrategy));
		if (!!player.review) {
			prompt = prompt.replace(/\{\{lastComments\}\}/g, "# 上一轮游戏结束后你对你的游戏策略的反思与修改想法\n\n" + player.review);
		}
		else {
			prompt = prompt.replace(/\{\{lastComments\}\}\n*/g, "");
		}
		if (!!player.analyze) {
			const info = [];
			for (let name in player.analyze) {
				info.push('## 你对 ' + name + ' 的分析\n\n' + player.analyze[name]);
			}
			if (info.length > 0) {
				prompt = prompt.replace(/\{\{playerAnalyze\}\}/g, "# 你对其他玩家的分析\n\n" + info.join('\n\n'));
			}
			else {
				prompt = prompt.replace(/\{\{playerAnalyze\}\}\n*/g, "");
			}
		}
		else {
			prompt = prompt.replace(/\{\{playerAnalyze\}\}\n*/g, "");
		}

		const request = {
			model: player.model,
			conversation: [['human', prompt]],
		};
		let result;
		try {
			// test
// 			result = `<ideas>
// 1. 在卡牌游戏中，理解玩家的心理是非常重要的。人类玩家往往会试图保护自己不受攻击，并会利用机会对弱者进行攻击。因此，观察他们的发言和行动，推测出他们的身份牌可能会有助于我制定策略。
// 2. 混沌卡牌的攻击必中，因此应该尽量利用这一特性增加我个人的得分，同时可以选择攻击能够轻易被击败的目标，从而减少自己被攻击的风险。
// 3. 通过交流阶段，可以进行信息的心理战。例如，故意展现出弱势，吸引其他玩家攻击我，而我可以利用这个机会在出牌阶段进行更有利的反击。
// 4. 我需要根据每一轮获得的积分情况，调整我的攻击目标。例如，如果某个玩家已经获得了较高的积分，那么我应该优先攻击这个玩家以降低他们的优势；反之，如果他们的积分较低，我可以选择不去攻击他们，以免引发他们的反击。
// 5. 在出牌阶段，我首选使用混沌卡作为身份牌，因为它能保证我至少一次必胜，同时确保能给我带来积分。其他卡牌应根据游戏局力进行选择。
// 6. 在结束阶段，主动沟通我的防守策略，可能会让其他玩家低估我，同时我可以消耗他们的实力。

// </ideas>
// <strategy>
// 1. **选择身份牌**：
//    - 本轮优先选择“混沌”作为身份牌，以确保攻击成功率。

// 2. **初始阶段心理分析**：
//    - 观察其他玩家的发言，判断他们对于这盘游戏的看法及心理状态，记录可能的游戏策略。

// 3. **交流阶段策略**：
//    - 通过私信与所有玩家进行一轮交流，尽量展现出我没有强有力的攻击力，吸引他们攻击我。
//    - 争取获得玩家们的信任，暗示我会优先攻击积分较高的玩家。

// 4. **出牌阶段**：
//    - 使用“混沌”攻击我的目标，优先选择积分较高的玩家以降低他们的优势。
//    - 如果没有可攻击的优秀目标，选择攻击积分较低的玩家。

// 5. **结算阶段应对**：
//    - 如果被攻击，我要根据对方的身份牌和猜测迅速选择防守卡。
//    - 设法让对方的攻击失败，从中获得防守积分，并调整我之后的攻击策略。

// 6. **动态调整策略**：
//    - 根据每一轮的积分变化，调整我的攻击目标，优先制衡积分领先的玩家。
//    - 与所有玩家沟通，适时调动他们之间的恐惧和竞争意识，以转移他们对我的注意力。

// 7. **准备下一轮**：
//    - 在游戏后结束交流阶段，询问他人的游戏感受，为下一局更新我的策略，并从他们的经验中吸取教训。

// </strategy>`;
			result = await askAIandWait('directSendToAI', request);
			result = result.reply;
			if (!result) {
				Notification.show('', messages.common.invalid, "rightTop", 'fail');
			}
		}
		catch (err) {
			result = null;
			logger.error(player.name + '(' + player.model + ')[MakeStrategy]', err);
			err = err.message || err.msg || err.data || err.toString();
			Notification.show('', err, "rightTop", 'fetal');
		}
		logger.log(player.name + '(' + player.model + ')', 'Game Strategy:\n' + result);
		if (!!result) {
			const json = parseReplyAsXMLToJSON(result);
			if (GameSetting.onlyView) {
				if (json.ideas) {
					addChatItem('thinking', json.ideas?._origin || json.ideas, player.name + " 内心思考");
				}
				if (json.strategy) {
					addChatItem('ai', json.strategy?._origin || json.strategy, player.name + " 制定游戏策略");
				}
			}
			player.strategy = (json.strategy?._origin || json.strategy || '').trim() || player.strategy || localStorage.getItem('lastWinStrategy') || DefaultStrategy;
		}
		player.ui.info.setAttribute("mode", "ready");
		if (GameSetting.onlyView) {
			Notification.show('', player.name + messages.game.msgStrategyReady, "middleTop", 'message', 1000);
		}
		else {
			addChatItem('system', player.name + messages.game.msgStrategyReady, '斗技场');
		}
	}));

	GameSetting.loopCount = 0;
	loop();
};
const loop = async () => {
	const messages = getMessages();

	GameSetting.loopCount ++;
	addChatItem('system', messages.game.msgLoopStart.replace("{{num}}", GameSetting.loopCount), '斗技场');

	await Promise.all(PlayerInfo.map(async player => {
		player._attackTarget = null;
		player._beaten = false;
		player._needChange = false;
		player.events.push("\n第" + GameSetting.loopCount + "回合开始\n");

		if (player.model === 'user') {
			if (!player.using) {
				let card = await waitForChooseCard(player);
				player.using = card;
				let first = card[0];
				card = card.replace(first, first.toUpperCase());
				CurrentCardUI.innerText = messages.game['card' + card];
			}
			player._attackTarget = await waitForChooseTarget();
		}
		else {
			player.ui.info.setAttribute("mode", "thinking");

			if (player.history.length === 0) {
				let sp = Prompts.playGame.replace('{{name}}', player.name);
				if (!!player.strategy) {
					sp = sp.replace(/\{\{gameStrategy\}\}/gi, '# 游戏策略\n\n' + player.strategy);
				}
				else {
					sp = sp.replace(/\{\{gameStrategy\}\}\n*/gi, '');
				}
				player.history.push(['system', sp]);
			}

			let rp = Prompts.playGameRunning;
			let playersInfo = [];
			PlayerInfo.forEach(info => {
				let line = '- ';
				if (info.name === player.name) {
					line += info.name + ' (你): '
				}
				else {
					line += info.name + ': ';
				}
				line += '积分: ' + info.score + '; 剩余手牌数: ';
				let count = 0;
				for (let name in info.cards) {
					count += info.cards[name];
				}
				line += count;
				playersInfo.push(line);
			});
			rp = rp.replace('{{playersInfo}}', playersInfo.join('\n'));
			if (player.events.length === 0) {
				rp = rp.replace('{{events}}', '新一轮游戏刚开始，暂无游戏事件');
			}
			else {
				const events = player.events.join('\n').trim();
				rp = rp.replace('{{events}}', events);
			}
			if (player.mailbox.length === 0) {
				rp = rp.replace('{{messages}}', '本轮没有收到新信息');
			}
			else {
				const mails = player.mailbox.join('\n\n')
				rp = rp.replace('{{messages}}', mails);
			}
			const info = [];
			for (let name in player.analyze) {
				info.push('## 你对 ' + name + ' 的分析\n\n' + player.analyze[name]);
			}
			if (info.length === 0) {
				rp = rp.replace(/\{\{analyze\}\}/g, "暂时没有任何交流与分析");
			}
			else {
				rp = rp.replace(/\{\{analyze\}\}/g, info.join('\n\n'));
			}
			if (!!player.using) {
				rp = rp.replace(/\{\{cards\}\}\n*/, '');
				rp = rp.replace(/\{\{extra\}\}/, '你已经选择了身份牌，所以输出中的"selection"字段为空或者不输出该字段。');
			}
			else {
				let cardInfo = [];
				for (let name in player.cards) {
					cardInfo.push(messages.game[name] + player.cards[name] + '张');
				}
				rp = rp.replace(/\{\{cards\}\}/, '# 当前剩余卡牌\n\n' + cardInfo.join('\n'));
				rp = rp.replace(/\{\{extra\}\}/, '本轮你需要选择一张牌作为身份牌，所以输出中的"selection"字段不能为空。');
			}

			const request = {
				model: player.model,
				conversation: [...player.history]
			};
			request.conversation.push(['human', rp]);
			console.log(rp);
			let result;
			try {
				// test
// 				result = `<ideas>
// 由于这是新一轮游戏的开始，目前没有任何交流或情报，因此所有玩家的策略和性格都不明确。我将根据初始策略，尽快了解其他玩家。在选择身份牌时优先选择“混沌”，确保进攻成功率。首轮我会选择攻击“LostAbaddon”，因为在没有其他信息的情况下，我需要根据我的策略，先观察他对游戏的态度与反应来收集情报。
// </ideas>
// <messages>
// <message>
// <target>all</target>
// <content>大家好，希望我们能够进行一场愉快的竞技！🙂 我通常会优先考虑攻击积分领先的玩家，所以大家也可以根据情况一起讨论哦！加油！</content>
// </message>
// <message>
// <target>LostAbaddon</target>
// <content>你好！</content>
// </message>
// </messages>
// <selection>混沌</selection>
// <attack>LostAbaddon</attack>`;
				result = await askAIandWait('directSendToAI', request);
				result = result.reply;
				if (!result) {
					Notification.show('', messages.common.invalid, "rightTop", 'fail');
				}
			}
			catch (err) {
				result = null;
				logger.error(player.name + '(' + player.model + ')', err);
				err = err.message || err.msg || err.data || err.toString();
				Notification.show('', err, "rightTop", 'fetal');
			}
			logger.log(player.name + '(' + player.model + ')', '\n' + result);
			let needReload = !result;
			if (needReload) {
				result = "";
			}
			const json = parseReplyAsXMLToJSON(result);
			console.log(json);
			if (!!json.ideas && GameSetting.onlyView) {
				addChatItem('hint', json.ideas._origin || json.ideas, player.name + '的内心想法');
			}
			if (!player.using) {
				if (!!json.selection && CardTypes.includes(json.selection)) {
					const card = CardNameToType[json.selection];
					if (!!card) {
						const count = player.cards[card];
						if (count > 0) {
							player.using = card;
						}
					}
				}
				if (!player.using) {
					const list = [];
					for (let card in player.cards) {
						const count = player.cards[card];
						if (count <= 0) continue;
						list.push(card);
					}
					if (list.length > 0) {
						player.using = list[Math.floor(list.length * Math.random())];
						player.events.push("- 你选择的身份牌无效或者没有选择身份牌，所以系统为你指派身份牌：“" + CardTypeToName[player.using] + "”！");
					}
				}
				else {
					player.events.push("- 你选择" + player.using + "为当前身份牌，用于后续的进攻与防守");
				}
			}
			if (!!json.attack) {
				PlayerInfo.some(user => {
					if (user.name !== json.attack) return;
					let count = 0;
					for (let card in user.cards) {
						count += user.cards[card];
					}
					if (count === 0) return true;
					player._attackTarget = json.attack;
					return true;
				});
			}
			if (!player._attackTarget) {
				let card, list = [];
				for (let c in player.cards) {
					let n = player.cards[c];
					if (c === player.using) n --;
					if (!n) continue;
					list.push(c);
				}
				if (list.length === 0 && !!player.using) list.push(player.using);
				if (list.length > 0) {
					card = list[Math.floor(list.length * Math.random())];
				}
				if (!!card) {
					player.cards[card] = (player.cards[card] > 0 ? player.cards[card] : 1) - 1;
				}
				PlayerInfo.forEach(p => {
					if (p === player) {
						if (!card) {
							p.events.push("- 你没有选择攻击目标，或者选择了无效的攻击目标，被强制扣除一张手牌！");
						}
						else {
							p.events.push("- 你没有选择攻击目标，或者选择了无效的攻击目标，被强制扣除手牌“" + CardTypeToName[card] + "”！");
						}
					}
					else if (p.model === 'user') {
						addChatItem("system", player.name + "没有选择攻击目标，被强制随机扣除一张手牌！", "斗技场");
					}
					else {
						p.events.push("- " + player.name + "没有选择攻击目标，或者选择了无效的攻击目标，被强制扣除一张手牌！");
					}
				});
				addChatItem("system", player.name + "没有选择攻击目标，被强制随机扣除一张手牌：" + (CardTypeToName[card] || "无手牌"), "斗技场");
			}
			if (!!json.analyzelist && !!json.analyzelist?.analyze) {
				let list = [];
				if (isArray(json.analyzelist.analyze)) {
					list = json.analyzelist.analyze;
				}
				else {
					list = [json.analyzelist.analyze];
				}
				list = list.map(item => {
					player.analyze[item.player] = item.comment;
					return '#### 对' + item.player + '的分析\n\n' + item.comment;
				});
				if (GameSetting.onlyView) {
					addChatItem('ai', list.join('\n\n'), player.name + '对其他玩家的分析');
				}
			}
			if (!!json.messages && !!json.messages?.message) {
				let list = [];
				if (isArray(json.messages.message)) {
					list = json.messages.message;
				}
				else {
					list = [json.messages.message];
				}
				list.forEach(item => {
					if (!item.target) return;
					if (item.target.toLowerCase() === 'all') {
						addChatItem('ai', item.content, player.name + '对所有人说');
						player.mailbox.push("<mail>\n<round>第" + GameSetting.loopCount + "轮</round>\n<title>你发给所有人</title>\n<content>\n" + item.content + '\n</content>\n</mail>');
						PlayerInfo.forEach(user => {
							if (user === player || user.model === 'user') return;
							user.mailbox.push("<mail>\n<round>第" + GameSetting.loopCount + "轮</round>\n<title>" + player.name + "发给所有人</title>\n<content>\n" + item.content + '\n</content>\n</mail>');
						});
					}
					else {
						if (GameSetting.onlyView) {
							addChatItem('ai', item.content, player.name + '对' + item.target + '说');
						}
						else if (item.target === myInfo.name) {
							addChatItem('ai', item.content, player.name + '对你说');
						}
						player.mailbox.push("<mail>\n<round>第" + GameSetting.loopCount + "轮</round>\n<title>你发给" + item.target + "</title>\n<content>\n" + item.content + '\n</content>\n</mail>');
						PlayerInfo.forEach(user => {
							if (user.name !== item.target || user.model === 'user') return;
							user.mailbox.push("<mail>\n<round>第" + GameSetting.loopCount + "轮</round>\n<title>" + player.name + "发给你</title>\n<content>\n" + item.content + '\n</content>\n</mail>');
						});
					}
				});
			}
			player.ui.info.setAttribute("mode", "ready");
		}
	}));

	const eventsForYou = [];
	PlayerInfo.forEach(player => {
		let target = null;
		PlayerInfo.some(p => {
			if (p.name !== player._attackTarget) return;
			target = p;
			return true;
		});
		if (!target) return;
		let attackResult = 0;
		if (!!player.using) {
			attackResult = WinLoseTable[player.using];
			if (!attackResult) {
				attackResult = 0;
			}
			else if (!target.using) {
				attackResult = 1;
			}
			else {
				attackResult = attackResult[target.using];
				if (attackResult === false) {
					attackResult = 2;
					player._needChange = true;
				}
				else {
					attackResult = 1;
				}
			}
		}
		if (attackResult === 0) {
			player.current --;
			player.score --;
		}
		else if (attackResult === 1) {
			player.current ++;
			player.score ++;
			target._beaten = true;
		}
		else {
			target.current ++;
			target.score ++;
		}
		PlayerInfo.forEach(user => {
			let msg;
			if (user === player) {
				if (attackResult === 0) {
					msg = "你进行了无效攻击或者选择了不攻击，被扣1分！";
				}
				else if (attackResult === 1) {
					msg = `你攻击了${target.name}，其身份为“${CardTypeToName[target.using] || "空白"}”，你攻击成功，获得1分！`;
				}
				else {
					msg = `你攻击了${target.name}但攻击失败！`;
				}
			}
			else if (user === target) {
				if (attackResult === 0) {
					msg = player.name + "进行了无效攻击或者选择了不攻击，被扣1分！";
				}
				else if (attackResult === 1) {
					msg = `${player.name}攻击了你且攻击成功，获得1分！`;
				}
				else {
					msg = `${player.name}攻击了你但攻击失败！`;
				}
			}
			else {
				if (attackResult === 0) {
					msg = player.name + "进行了无效攻击或者选择了不攻击，被扣1分！";
				}
				else if (attackResult === 1) {
					msg = `${player.name}攻击了${target.name}，${target.name}的身份为“${CardTypeToName[target.using] || "空白"}”，${player.name}攻击成功，获得1分！`;
				}
				else {
					msg = `${player.name}攻击了${target.name}但攻击失败！`;
				}
			}
			user.events.push("- " + msg);
		});
		if (GameSetting.onlyView) {
			let msg;
			if (attackResult === 0) {
				msg = `${player.name}进行了无效攻击或者选择了不攻击，被扣1分！`;
			}
			else if (attackResult === 1) {
				msg = `${player.name}（${CardTypeToName[player.using] || "空白"}）攻击了${target.name}（${CardTypeToName[target.using] || '空白'}），攻击成功，获得1分！`;
			}
			else {
				msg = `${player.name}（${CardTypeToName[player.using] || '空白'}）攻击了${target.name}（${CardTypeToName[target.using] || '空白'}），攻击失败！`;
			}
			eventsForYou.push(msg);
		}
	});
	if (!GameSetting.onlyView) {
		PlayerInfo.some(player => {
			if (player.model !== 'user') return;
			eventsForYou.push(...player.events);
			player.events.splice(0);
			return true;
		});
	}
	addChatItem('system', eventsForYou.map(line => '- ' + line).join('\n'), '本轮攻击事件');

	let isFinished = false;
	PlayerInfo.forEach(player => {
		if (player._beaten) {
			if (!!player.using) player.cards[player.using] --;
			player.using = null;
		}
		else if (player._needChange) {
			player.using = null;
		}

		let count = 0;
		for (let card in player.cards) {
			count += player.cards[card];
		}
		player.ui.cards.innerText = count;
		if (count === 0) {
			isFinished = true;
		}

		player.ui.score.innerText = player.current + "(" + player.score + ")";
		if (player.model === 'user') {
			if (!player.using) CurrentCardUI.innerText = '空白';
			HandCardFUI.innerText = player.cards.fireBall;
			HandCardWUI.innerText = player.cards.waterCage;
			HandCardTUI.innerText = player.cards.thunderBolt;
			HandCardCUI.innerText = player.cards.chaosMagic;
		}
	});

	if (isFinished) {
		const list = [];
		PlayerInfo.forEach(player => {
			let count = 0;
			for (let card in player.cards) {
				let num = player.cards[card];
				if (num > 0) count += num;
			}
			player._leftCount = count;
			let msg;
			if (count === 0) {
				msg = `- ${player.name}本轮游戏积分：${player.current}，目前总分为：${player.score}`;
			}
			else {
				player.score += count;
				msg = `- ${player.name}本轮游戏积分：${player.current}，剩余${count}张牌，可额外获得${count}分，目前总分为：${player.score}`;
				player.ui.score.innerText = player.current + "(" + player.score + ")";
			}
			list.push(msg);
		});
		addChatItem('system', list.join('\n'), '本轮游戏结束，开始计分');

		await wait(1000);
		addChatItem('system', '现在开始复盘，大家有' + ReviewLoopCount + '轮相互交流的机会', '斗技场');
		PlayerInfo.sort((pa, pb) => (pb.current + pb._leftCount) - (pa.current + pa._leftCount));
		localStorage.setItem('lastWinStrategy', PlayerInfo[0].strategy);
		for (let i = 0; i < ReviewLoopCount; i ++) {
			await Promise.all(PlayerInfo.map(async (player, idx) => {
				player.ui.info.setAttribute("mode", "thinking");

				if (player.model === 'user') {
					await waitForSendMails();
				}
				else {
					let prompt = i === 0 ? Prompts.endGameStart : Prompts.endGameFinish;
					prompt = prompt.replace('{{score}}', player.current + player._leftCount);
					prompt = prompt.replace('{{index}}', idx + 1);
					let rank = [];
					PlayerInfo.forEach(u => {
						let msg = '- ' + u.name;
						if (u === player) msg += '(你)';
						msg += "战斗得分：" + u.current + "，剩余牌得分：" + u._leftCount + "，游戏总得分：" + (u.current + u._leftCount);
						rank.push(msg);
					});
					prompt = prompt.replace('{{rank}}', rank.join('\n'));
					if (i === 0) {
						if (player.events.length === 0) {
							prompt = prompt.replace('{{events}}', '新一轮游戏刚开始，暂无游戏事件');
						}
						else {
							const events = player.events.join('\n').trim();
							prompt = prompt.replace('{{events}}', events);
						}
					}
					if (player.mailbox.length === 0) {
						prompt = prompt.replace('{{messages}}', '本轮没有收到新信息');
					}
					else {
						const mails = player.mailbox.join('\n\n')
						prompt = prompt.replace('{{messages}}', mails);
					}
					let strategy;
					if (idx === 0) {
						strategy = '# 第二名的游戏策略（你是第一名）\n\n' + (PlayerInfo[1].strategy || localStorage.getItem('lastWinStrategy') || DefaultStrategy);
					}
					else {
						strategy = '# 第一名的游戏策略\n\n' + (PlayerInfo[0].strategy || localStorage.getItem('lastWinStrategy') || DefaultStrategy);
					}
					prompt = prompt.replace('{{strategy}}', strategy);
					player.history.push(['human', prompt]);

					const request = {
						model: player.model,
						conversation: [...player.history]
					};
					let result;
					try {
						result = await askAIandWait('directSendToAI', request);
						result = result.reply;
						if (!result) {
							Notification.show('', messages.common.invalid, "rightTop", 'fail');
						}
					}
					catch (err) {
						result = null;
						logger.error(player.name + '(' + player.model + ')', err);
						err = err.message || err.msg || err.data || err.toString();
						Notification.show('', err, "rightTop", 'fetal');
					}
					logger.log(player.name + '(' + player.model + ')Review', '\n' + result);
					if (!!result) {
						const json = parseReplyAsXMLToJSON(result);
						console.log(json);
						if (!!json.ideas && GameSetting.onlyView) {
							addChatItem('hint', json.ideas._origin || json.ideas, player.name + '的内心想法');
						}
						if (!!json.analyzelist && !!json.analyzelist?.analyze) {
							let list = [];
							if (isArray(json.analyzelist.analyze)) {
								list = json.analyzelist.analyze;
							}
							else {
								list = [json.analyzelist.analyze];
							}
							list = list.map(item => {
								player.analyze[item.player] = item.comment;
								return '#### 对' + item.player + '的分析\n\n' + item.comment;
							});
							if (GameSetting.onlyView) {
								addChatItem('ai', list.join('\n\n'), player.name + '对其他玩家的分析');
							}
						}
						if (!!json.messages && !!json.messages?.message) {
							let list = [];
							if (isArray(json.messages.message)) {
								list = json.messages.message;
							}
							else {
								list = [json.messages.message];
							}
							list.forEach(item => {
								if (!item.target) return;
								if (item.target.toLowerCase() === 'all') {
									addChatItem('ai', item.content, player.name + '对所有人说');
									PlayerInfo.forEach(user => {
										if (user === player || user.model === 'user') return;
										user.mailbox.push("<mail>\n<title>" + player.name + "发给所有人</title>\n<content>\n" + item.content + '\n</content>\n</mail>');
									});
								}
								else {
									if (GameSetting.onlyView) {
										addChatItem('ai', item.content, player.name + '对' + item.target + '说');
									}
									else if (item.target === myInfo.name) {
										addChatItem('ai', item.content, player.name + '对你说');
									}
									PlayerInfo.forEach(user => {
										if (user.name !== item.target || user.model === 'user') return;
										user.mailbox.push("<mail>\n<title>" + player.name + "发给你</title>\n<content>\n" + item.content + '\n</content>\n</mail>');
									});

								}
							});
						}
						player.history[player.history.length - 1][1] =  Prompts.endGameRecord;
						player.history.push(['ai', result]);
					}
				}

				player.ui.info.setAttribute("mode", "ready");
			}));
			await wait(100);
		}
		addChatItem('system', '大家开始反思游戏策略，请稍候……', '斗技场');
		await Promise.all(PlayerInfo.map(async (player, idx) => {
			if (player.model === 'user') return;

			player.ui.info.setAttribute("mode", "thinking");

			let prompt = Prompts.reviewStrategy;
			let rank = [];
			PlayerInfo.forEach(u => {
				let msg = '- ' + u.name;
				if (u === player) msg += '(你)';
				msg += "战斗得分：" + u.current + "，剩余牌得分：" + u._leftCount + "，游戏总得分：" + (u.current + u._leftCount);
				rank.push(msg);
			});
			prompt = prompt.replace('{{rank}}', rank.join('\n'));
			if (player.mailbox.length === 0) {
				prompt = prompt.replace('{{messages}}', '本轮没有收到新信息');
			}
			else {
				const mails = player.mailbox.join('\n\n')
				prompt = prompt.replace('{{messages}}', mails);
			}
			const info = [];
			for (let name in player.analyze) {
				info.push('## 你对 ' + name + ' 的分析\n\n' + player.analyze[name]);
			}
			if (info.length === 0) {
				prompt = prompt.replace(/\{\{analyze\}\}/g, "暂时没有任何交流与分析");
			}
			else {
				prompt = prompt.replace(/\{\{analyze\}\}/g, info.join('\n\n'));
			}
			let strategy;
			if (idx === 0) {
				strategy = '# 第二名的游戏策略（你是第一名）\n\n' + PlayerInfo[1].strategy;
			}
			else {
				strategy = '# 第一名的游戏策略\n\n' + PlayerInfo[0].strategy;
			}
			prompt = prompt.replace("{{strategy}}", strategy);
			player.history.push(['human', prompt]);

			const request = {
				model: player.model,
				conversation: [...player.history]
			};
			let result;
			try {
				result = await askAIandWait('directSendToAI', request);
				result = result.reply;
				if (!result) {
					Notification.show('', messages.common.invalid, "rightTop", 'fail');
				}
			}
			catch (err) {
				result = null;
				logger.error(player.name + '(' + player.model + ')', err);
				err = err.message || err.msg || err.data || err.toString();
				Notification.show('', err, "rightTop", 'fetal');
			}
			logger.log(player.name + '(' + player.model + ')Review', '\n' + result);
			if (!!result) {
				const json = parseReplyAsXMLToJSON(result);
				console.log(json);
				if (!!json.ideas && GameSetting.onlyView) {
					addChatItem('hint', json.ideas._origin || json.ideas, player.name + '的内心想法');
				}
				const review = json.strategy?._origin || json.strategy;
				if (GameSetting.onlyView) {
					addChatItem('ai', review, player.name + '的策略调整想法');
				}
				player.review = review || result;
			}
			else {
				player.review = "暂无策略调整方案";
			}

			player.ui.info.setAttribute("mode", "ready");
		}));
		let isContinue = await waitForNextRound();
		if (!isContinue) return;

		PlayerInfo.forEach(player => {
			player.using = null;
			player._attackTarget = null;
			player._leftCount = 0;
			player.current = 0;
			for (let card in player.cards) {
				player.cards[card] = AmountPerCardType;
			}
			player.events.splice(0);
			player.mailbox.splice(0);
			player.ui.cards.innerText = 4 * AmountPerCardType;
		});
		CurrentCardUI.innerText = messages.game.hintNoCard;
		HandCardFUI.innerText = AmountPerCardType;
		HandCardWUI.innerText = AmountPerCardType;
		HandCardTUI.innerText = AmountPerCardType;
		HandCardCUI.innerText = AmountPerCardType;
		startGame();
	}
	else {
		await wait(100);
		loop();
	}
};

/* Init */

const initUI = () => {
	renderI18N();
	registerAction();

	WarModeSelector.addEventListener('click', ({target}) => {
		if (!target.classList.contains('selector')) return;
		const mode = WarModeSelector.getAttribute('mode');
		if (mode === 'onlyView') {
			WarModeSelector.setAttribute('mode', 'joinWar');
			GameSetting.onlyView = false;
		}
		else {
			WarModeSelector.setAttribute('mode', 'onlyView');
			GameSetting.onlyView = true;
		}
	});
	ModelListContainer.addEventListener('click', ({target}) => {
		if (!target.classList.contains('btn')) return;
		const model = target.parentElement.parentElement._model;
		if (target.classList.contains('add')) {
			if (GameSetting.players.length >= MaxPlayerPerGame - (GameSetting.onlyView ? 0 : 1)) return;
			GameSetting.players.push(model);
			gameModels[model]++;
		}
		else {
			if (gameModels[model] === 0) return;
			const index = GameSetting.players.indexOf(model);
			if (index >= 0) {
				GameSetting.players.splice(index, 1);
				gameModels[model]--;
			}
		}
		target.parentElement.querySelector('.number').innerText = gameModels[model];
	});
	ConversationArea.addEventListener('click', evt => {
		const target = evt.target;
		let container = target;
		while (!container.classList.contains('chat_item')) {
			container = container.parentNode;
			if (container === document.body) {
				return;
			}
		}
		if (!container) return;

		if (target.classList.contains('btnCopy')) {
			let content = container._content;
			if (!content) return;
			navigator.clipboard.writeText(content).then(() => {
				const messages = getMessages();
				Notification.show('', messages.common.contentCopied, 'rightTop', 'success');
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

	window.addEventListener('resize', resizeInputter);
};

const onLoad = async () => {
	initUI();
	showModelList();

	document.body.removeAttribute('loading');
};
const init = async () => {
	const info = await Promise.all([
		chrome.tabs.getCurrent(),
		getConfig(),
	]);

	currentTabId = info[0].id;

	availableModelList.splice(0);
	const list = await askSWandWait('GetAvailableModelList');
	list.filter(model => !model.match(/search/i)).forEach(model => availableModelList.push(model));

	checkInit('init');
};

initTasks.init = false;
init();