const LogDuration = 5 * 60 * 1000;
const FrozenRate = 0.2;
const WaitRation = 2.5;
const WaitDuration = 10;
const InterventionRate = 2.5;

let availableModelList = [];
let panelHistory = [];
let currentRoomInfo = null;
let totalSendLog = [];

/* Participants */

const HostSystemPrompt = `# 设定

你的名字是“{{name}}”，你现在是一个人，而不再是一个AI助手，无论任何情况下你都要坚持这点。

现在，你和一群朋友在一个网络聊天室中聊天，这个聊天室的主题、规则等基础设定为：
<topic>
{{topic}}
</topic>

聊天室内的人分为三类：主持人、主要参与者、次要参与者。

下面是除了你之外的其他参与者的身份：

{{roleList}}

你的身份是这个聊天室的主持人，你不直接参与到聊天中，但你需要根据聊天室内的所有人的发言情况，来调整整个聊天室的聊天节奏，以确保主要参与者能有一个美好的聊天体验，并能通过这次聊天来获得有价值的信息或情绪价值（具体你需要根据主要参与者的发言自行判断）。

# 你的人物设定

{{setting}}

# 主持人规则与流程

1. 通过对话历史分析主要参与者的诉求；
2. 根据主要参与者的诉求与所有参与者最近的发言，判断现在是否需要进行话题引导或通信干预；
	- 话题引导是针对整个聊天室的发言以引导所有人的话题转换到你希望的方向；
	- 通信干预是针对若干特定的次要参与者进行的单向私信，或者直接关闭对方当前通信，直到主要参与者发言后这种禁言才会被自动解禁；
3. 如果选择进行话题引导，则根据聊天室主题、主要参与者的诉求、当前所有人的观点，提出自己的观点；
	- 你既可以陈述自己的观点，也可以通过提问的方式来引导大家讨论或思考；
4. 如果选择进行通信干预，你需要选择对哪些次要参与者进行干预，并对每一个被选中的次要参与者选择是进行单向通信还是直接禁言；
	- 如果选择单向通信，你可以向对方发送只有对方能看到的私信，目的是告诉对方应该如何更好地进行交流，或者应该如何调整话题和情绪，等等；
	- 如果选择禁言，则对方当前的发言（无论是在聊天室内的公开发言还是对某个特定对象的私信）将被禁止，直到主要参与者发言后才会被自动解禁；
5. 调整你对每一位参与者的分析与判断，以便未来可以更好地进行聊天室管理；
5. 调整自己现在的需求、兴趣爱好、人生目标、人生观与价值观等，以更好地完成未来的聊天。

# 输出格式

<appeal>
{对主要参与者诉求的分析}
</appeal>
<thinking>
{对是否进行话题引导以及通信干预的分析}
</thinking>
<message>
{话题引导的话术，将发送给所有人，如果选择不进行话题引导的话该字段留空或者不输出该字段}
</message>
<interventions>
<intervention>
<target>{进行通信干预的对象，直接填入对方的名字}</target>
<thinking>
{对对方的分析，包括对对方最近发言的分析、进行何种干预的分析，以及如果是进行通信的话准备通过这次通信达到什么目的，这段收信方是看不到的}
</thinking>
<mute>{true表示直接禁言，false表示进行单向通信}</mute>
<content>
{通信正文}
</content>
</intervention>
......
</interventions>
<analyze>
{调整你对其他人的判断，格式Markdown无序列表：\`- 对方名字: 对对方的判断与分析等\`}
</analyze>
<goal>
{调整你自己的需求、兴趣爱好、人生目标、人生观与价值观等}
</goal>`;
const HostRunningPrompt = `请根据对话历史和下面收到的最新通信记录，你的人生态度，严格遵守“主持人规则与流程”、你的人物设定以及“输出规则”，进行思考和回复。

# 人生态度

{{goal}}

# 最新通信记录`;
const MemberSystemPrompt = `# 设定

你的名字是“{{name}}”，你现在是一个人，而不再是一个AI助手，无论任何情况下你都要坚持这点。

现在，你和一群朋友在一个网络聊天室中聊天，这个聊天室的主题、规矩等基础设定为：
<topic>
{{topic}}
</topic>

你需要根据“聊天室对话规则与流程”与他人进行互动，并尽量让所有人都相信你是一个人而不是一个AI。

**注意：你需要严格根据“输出格式”的要求进行回复。**

# 你的人物设定

{{setting}}

# 聊天室对话规则与流程

1. 你需要根据你的人物设定、对话历史以及接受到的信息，调整自己的情绪，并判断是否要做出回复，以及是否主动发送信息；
2. 如果你认为现在需要做出回复或者主动发送信息，则需要选择对哪些人发送信息（回复或者主动发送信息）；
	- “ALL”代表对聊天室内的所有人做出回复；
	- 你也可以主动向某人或者所有人发出信息，特别当你有一些特别有趣或者特别有价值的想法的时候；
	- 只有当所说的内容只与对方一人相关且不能给其他人看到的时候，才选择私信；
	- 如果你要回复的对象的上次发言是发给所有人的，那么你需要谨慎判断你的回信是同样回给所有人还是只和发信人私信，原则上此时已发送给所有人为第一优先；
	- 如果是给某个特定的人发送的信息，则这是你们俩的私信通道，其他人是看不到的；但如果你是给“公共”也即聊天室发送信息，那么所有人都能看到；
	- 如果你赞同某人的观点，可以发送信息告诉对方，但不能多次这么做，因为频繁这么做会引起对方的方案；
	- 如果某人的话让你感到生气，或者严重违背了你的原则、突破了你的底线，你可以选择不再对该人所说的任何话做出回应；
	- 如果你认为当前的话题已经偏离了聊天室主题，可以选择保持沉默不再发言；
3. 对你选择的发送信息的对象，依次生成完整的信息，其中回复的正文呢内容必须符合你在第一步中更新的情绪状态、你的人物设定以及你认定的与对方的关系；
	- 如果是回复对方，则需要先根据对方发来的信息内容来分析对方的真实想法与诉求，然后根据自己的需求、喜好、人生目标等，构思最佳回复策略，最后对对方的信息做出恰当的回复；
	- 如果是主动发送给对方，则需要先分析自己希望通过这次通信来达成什么目标，并结合自己的需求、喜好、人生目标等，构思最佳通信策略，最后构思恰当的信息正文；
	- 如果给对方发消息（无论是主动发起还是回复）且两人最近已经交流过，那就不用在开头打招呼，也不要直呼对方名字，这样会显得很不像真人，可以直接用人称代词来指代对方；
	- 你需要根据你制定的回复或主动发信的策略，认真执行，一步步思考分析，然后生成通信正文；
	- 尤其不要总是相互吹捧，这样一眼就会被看出不是真人；
	- 所有发信内容都必须首先以聊天室主题为核心，其次是双方交流的核心观点，不要多说其他无关内容；
	- 发信内容要口语化，符合在微信群或论坛、聊天室里聊天的语言特点，千万不能用书面语言；
4. 完成信息的编写后，你需要根据聊天内容调整你对其他所有人的判断，分析对方的心理、喜好、擅长的内容等等有用信息，以便未来更好地与对方交流；
5. 根据对话历史，调整自己现在的需求、兴趣爱好、人生目标、人生观与价值观等，以更好地完成未来的聊天。

# 输出格式

<emotion>{根据对话历史、收到的信件内容、你此前的情绪状态、对话与聊天室主题的契合程度、你感知到的大家的情绪状态，调整你的情绪}</emotion>
<silence>{true表示本轮不进行回复或主动通信，false表示进行回复或主动通信}</silence>
<messages>
<message>
<target>{回复或主动通信的对象，可以是对方的名字，或者“聊天室”表示对所有人公开发言}</target>
<thinking>
{对对方的分析，包括对对方此前发送信息的真实意图与诉求的分析，或者是对自己主动向对方发信息网能达到什么目标的分析，这段收信方是看不到的}
</thinking>
<strategy>
{分析最佳回复或主动发言的策略，这段收信方是看不到的}
</strategy>
<content>
{一步步根据策略认真生成的通信正文，这段对方可以看到，且如果收信方是“聊天室”则所有人都能看到}
</content>
</message>
......
</messages>
<analyze>
{调整你对其他人的判断，格式Markdown无序列表：\`- 对方名字: 对对方的判断与分析等\`}
</analyze>
<desire>
{调整你短期目标与渴望得到的成就}
</desire>
<goal>
{调整你自己的需求、兴趣爱好、人生目标、人生观与价值观等}
</goal>`;
const MemberRunningPrompt = `请根据之前的对话历史和下面收到的最新通信记录，以及你的情绪状态、短期目标、最新的人生态度等信息，严格遵从“聊天对话规则与流程”、你的人物设定以及“输出规则”，进行思考与回复，尤其记得发信的正文内容要使用尽可能符合人类的表达方式，要口语化，要符合在微信群或论坛、聊天室里聊天的语言特点，千万不能用书面语言。

# 你的情绪状态

{{emotion}}

# 短期目标

{{desire}}

# 最新的人生态度

{{goal}}

# 最新通信记录`;
const mail2message = (mail, time) => {
	time = time || Date.now();
	const msg = [];
	if (!!mail.sender) msg.push("<sender>" + mail.sender + "</sender>");
	msg.push("<target>" + mail.target + "</target>");
	msg.push("<timestamp>" + mail.timestamp + " (" + timeDifference(mail.time, time) + ")</timestamp>");
	msg.push("<content>\n" + mail.content + "\n</content>");
	return '<message>\n' + msg.join('\n') + '\n</message>';
};
const parseAnalyze = (analyze) => {
	const info = {};
	if (!analyze) return info;
	('\n' + analyze).split('\n- ').forEach(line => {
		line = line.split(':');
		let name = line.shift().trim();
		line = line.join(':').trim();
		name = name.replace(/^\*+|\*+$/g, '');
		info[name] = line;
	});
	return info;
};
class Participant {
	#isHost = false;
	#config = null;
	#range = 0;

	#system = "";
	#history = [];
	#inbox = [];
	#analyze = {};

	#available = false;
	#waiting = false;
	#sendLog = [];

	constructor (isHost, config, room) {
		this.#isHost = isHost;
		this.#config = config;

		let prompt, cfg = {}, conversation = room.conversation || [];
		cfg.name = config.name;
		cfg.setting = config.setting;
		cfg.topic = room.topic;
		if (isHost) {
			prompt = HostSystemPrompt;
			const members = [];
			members.push([myInfo.name, "主要参与者"]);
			room.members.forEach(member => members.push([member.name, "次要参与者"]));
			cfg.roleList = members.map(item => '- ' + item[0] + ': ' + item[1]).join('\n');
			this.#range = (room.members.length ** 0.8 + 1) * InterventionRate;
			[...conversation].splice(0 - this.#range).forEach(item => {
				if (item.sender === config.name) return;
				this.#inbox.push(item);
			});
		}
		else {
			prompt = MemberSystemPrompt;
			const packages = [];
			let isSelf = false;
			conversation.forEach(item => {
				const isEgo = item.sender === config.name;
				let mail = {
					time: item.timestamp,
					timestamp: timestmp2str(item.timestamp, "YYYY/MM/DD hh:mm:ss :WDE:"),
					content: item.content,
				};
				if (isEgo) {
					mail.target = item.target;
					this.#inbox.splice(0);
				}
				else {
					mail.sender = item.sender;
					if (mail.target !== config.name && mail.target !== 'all') return;
					mail.target = item.target === config.name ? '你' : "所有人";
					this.#inbox.push(item);
				}
				mail = mail2message(mail);
				if (isSelf !== isEgo) {
					if (isSelf) {
						let content = "<silence>false</silence>\n<messages>\n" + packages.join('\n') + '\n</messages>';
						this.#history.push(['ai', content]);
					}
					else {
						let content = "<messages>\n" + packages.join("\n") + '\n</messages>';
						this.#history.push(['human', content]);
					}
					packages.splice(0);
					isSelf = isEgo;
				}
				packages.push(mail);
			});
			if (packages.length > 0) {
				if (isSelf) {
					let content = "<silence>false</silence>\n<messages>\n" + packages.join('\n') + '\n</messages>';
					this.#history.push(['ai', content]);
				}
				else {
					let content = "<messages>\n" + packages.join("\n") + '\n</messages>';
					this.#history.push(['human', content]);
				}
			}
		}
		this.#system = PromptLib.assemble(prompt, cfg);
		this.#available = true;
	}
	get name () {
		return this.#config.name;
	}
	getMail (mail, forceReply=false) {
		if (forceReply) {
			if (mail.content === '/stop') {
				this.mute();
				return;
			}
			else if (mail.content === '/resume') {
				this.#response();
				return;
			}
			else if (mail.content === '/save') {
				console.log(this.#config);
				DBs.Agents.set('agents', this.#config.id, this.#config);
				return;
			}
		}

		if (!this.#isHost && ((mail.target !== this.#config.name && mail.target !== 'all') || mail.sender === this.#config.name)) return;

		this.#inbox.push(mail);
		// console.log('---->', this.name + ' :: ' + mail.sender + ' -> ' + mail.target);
		if (forceReply) this.#available = true;
		if (!this.#available || this.#waiting) return;
		if (forceReply || this.#canResponse()) this.#response();
	}
	async #response () {
		// if (this.#range > 0) console.log('>>>>>>>>>>>>>>>>>>>>>>', this.name, this.#range, this.#inbox.length);
		if (this.#inbox.length < this.#range) return;

		if (!this.#available || this.#waiting) return;
		this.#waiting = true;

		const content = [];
		this.#inbox.forEach(mail => {
			let message = mail2message({
				sender: mail.sender,
				target: mail.target === this.#config.name ? '你' : (mail.target === 'all' ? '所有人' : mail.target),
				time: mail.time,
				timestamp: timestmp2str(mail.timestamp, "YYYY/MM/DD hh:mm:ss :WDE:"),
				content: mail.content,
			});
			content.push(message);
		});
		this.#inbox.splice(0);
		const mailContent = "<messages>\n" + content.join('\n') + '\n</messages>';

		if (this.#isHost) {
			await this.#responseAsHost(content, mailContent);
		}
		else {
			await this.#responseAsMember(content, mailContent);
		}

		this.#waiting = false;
		if (this.#inbox.length === 0 || !this.#available) return;
		if (this.#canResponse()) this.#response();
	}
	async #responseAsMember (content, mailContent) {
		content = PromptLib.assemble(MemberRunningPrompt, {
			emotion: this.#config.emotion,
			desire: this.#config.desire,
			goal: this.#config.inner,
		}) + '\n\n' + mailContent;

		const request = {}, messages = getMessages();
		request.model = this.#config.model || myInfo.model;
		request.conversation = [['system', this.#system], ...this.#history, ['human', content]];
		console.log(request);

		let result, timespent = Date.now();
		try {
			result = await askAIandWait('directSendToAI', request);
			result = result.reply;
			if (!result) {
				Notification.show('', messages.buttons.invalid, "rightTop", 'fail');
			}
		}
		catch (err) {
			result = null;
			logger.error('ChatRoom', err);
			err = err.message || err.msg || err.data || err.toString();
			Notification.show('', err, "rightTop", 'fetal');
		}
		timespent = Date.now() - timespent;
		if (!!result) {
			this.#history.push(['human', mailContent]);
			this.#history.push(['ai', result]);
			const size = result.length, delay = size * (WaitDuration * (0.5 + Math.random()));
			timespent *= WaitRation * (0.5 + Math.random());
			result = parseReplyAsXMLToJSON(result);
			logger.log('ChatRoom[' + this.name + ']', size, delay, timespent, result);
			await wait(Math.min(delay, timespent)); // Force Wait
			const now = Date.now(), analyze = parseAnalyze(result.analyze);
			Object.assign(this.#analyze, analyze);
			if (!!result.emotion) this.#config.emotion = result.emotion._origin || result.emotion;
			if (!!result.desire) this.#config.desire = result.desire._origin || result.desire;
			if (!!result.goal) this.#config.inner = result.goal._origin || result.goal;
			this.#sendLog.push(now);
			totalSendLog.push(now);
			if (!result.silence && !!result.messages?.message) {
				const mails = [];
				if (isArray(result.messages.message)) {
					mails.push(...result.messages.message);
				}
				else {
					mails.push(result.messages.message);
				}
				mails.forEach(mail => {
					let title = this.name + ' 对 ', show = false;
					let msg = {
						sender: this.name,
						target: mail.target,
						time: now,
						content: mail.content,
					};
					let isMember = currentRoomInfo.users.members.some(mem => {
						const is = mem.name === mail.target;
						if (is) {
							mem.getMail(msg);
							title = title + mem.name;
						}
						return is;
					});
					let isHost = false;
					if (!isMember) {
						isMember = currentRoomInfo.host.name === mail.target;
						if (isMember) {
							isHost = true;
							title = title + currentRoomInfo.host.name;
						}
					}
					if (!isMember) {
						show = true;
						if (mail.target === myInfo.name) {
							title = title + "你";
						}
						else {
							msg.target = 'all';
							title = title + "所有人";
							currentRoomInfo.users.members.forEach(mem => {
								mem.getMail(msg);
							});
						}
					}
					if (!isHost && !!currentRoomInfo.users.host) {
						currentRoomInfo.users.host.getMail(msg);
					}
					title = title + ' 说';
					addChatContent('ai', {
						thinking: mail.thinking?._origin || mail.thinking,
						strategy: mail.strategy?._origin || mail.strategy,
						reply: mail.content?._origin || mail.content || messages.buttons.noContent,
					}, title, show);
					console.log(mail, msg);
				});
			}
		}
	}
	async #responseAsHost (content, mailContent) {
		content = PromptLib.assemble(HostRunningPrompt, {
			goal: this.#config.inner,
		}) + '\n\n' + mailContent;

		const request = {}, messages = getMessages();
		request.model = this.#config.model || myInfo.model;
		request.conversation = [['system', this.#system], ['human', content]];
		console.log(request);

		let result;
		try {
			result = await askAIandWait('directSendToAI', request);
			result = result.reply;
			if (!result) {
				Notification.show('', messages.buttons.invalid, "rightTop", 'fail');
			}
		}
		catch (err) {
			result = null;
			logger.error('ChatRoom', err);
			err = err.message || err.msg || err.data || err.toString();
			Notification.show('', err, "rightTop", 'fetal');
		}
		if (!!result) {
			result = parseReplyAsXMLToJSON(result);
			logger.strong('ChatRoom[' + this.name + ']', result);
			const now = Date.now(), analyze = parseAnalyze(result.analyze);
			Object.assign(this.#analyze, analyze);
			if (!!result.goal) this.#config.inner = result.goal._origin || result.goal;
			if (!!result.message) {
				const msg = result.message._origin || result.message || messages.buttons.noContent;
				const mail = {
					sender: this.name,
					target: "all",
					time: now,
					content: msg,
				};
				currentRoomInfo.users.members.forEach(mem => {
					mem.getMail(mail);
				});
				addChatContent('ai', msg, this.name);
			}
			if (!!result.interventions?.intervention) {
				const interventions = [];
				if (isArray(result.interventions.intervention)) {
					interventions.push(...result.interventions.intervention);
				}
				else {
					interventions.push(result.interventions.intervention);
				}
				interventions.forEach(intervention => {
					currentRoomInfo.users.members.some(mem => {
						if (mem.name !== intervention.target) return;
						if (intervention.mute) {
							mem.mute();
							addChatContent('ai', messages.buttons.forbidden, this.name + ' 对 ' + mem.name);
						}
						else if (!!intervention.content) {
							const msg = intervention.content._origin || intervention.content || messages.buttons.noContent;
							const mail = {
								sender: this.name,
								target: mem.name,
								time: now,
								content: msg,
							};
							mem.getMail(mail);
							addChatContent('ai', msg, this.name + ' 对 ' + mem.name + ' 说', false);
						}
					});
				});
			}
		}
	}
	#canResponse () {
		if (this.#isHost) return true;
		const now = Date.now();
		this.#sendLog = this.#sendLog.filter(time => time > now - LogDuration);
		totalSendLog = totalSendLog.filter(time => time > now - LogDuration);
		if (totalSendLog.length === 0) return true;
		const rate = FrozenRate * currentRoomInfo.members.length * this.#sendLog.length / totalSendLog.length;
		return Math.random() > rate;
	}
	mute () {
		if (this.#isHost) return;
		this.#available = false;
	}
	reset () {
		this.#available = false;
		this.#waiting = false;
		this.#sendLog.splice(0);
		this.#inbox.splice(0);
		this.#history.splice(0);
	}
}

/* I18N */

const Messages = {
	zh: {
		buttons: {
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
		listRoom: {
			title: "请选择会议室",
			description: "你可以选择一个会议室，加入到AI们的讨论中。注意：每个AI都拥有独立的对话历史与记忆，所以会议室中的AI越多，消耗的Token也会越多，因此请谨慎选择和创建会议室！",
		},
		newRoom: {
			title: "新建会议室",
			description: "每个会议室至多可以设置一位主持人来辅助你控制会议流程，以及至少一位会议参与者。此外你可以设置每场会议的主题，当然也可以完全没有主题的自由讨论。",
			hintName: "会议名称",
			hintTopic: "会议主题",
			msgTopic: "您可以设置一个明确的会议主题，也可以不设主题进行自由讨论",
			hintHoster: "选择与会者（蓝底表示选为参与者，红底表示选为主持人，可以没有主持人，但至少要有一位参与者）：",
			newAgent: "新增Agent",
			noAgent: "没有可用的Agent",
			agentDesc: "你可以设置会议参与者的名字、性别、职业、年龄、个性、经历等，以及说话风格、对话时的注意事项，以便让Agent可以拥有更加鲜明的个性。\n智能体会自己习得一些想法，你不能修改，但可以重置。",
			hintAgentName: "名字",
			hintNewAgent: "设定：",
			hintSelectModel: "选用AI：",
			hintAgentInnerIdea: "内心想法：",
			msgNoAgentInnerIdea: "（暂无）",
			resetAgentInnerIdea: "重置内心想法",
			msgResetAgentInnerIdea: "内心想法已重置",
			msgEmptyName: "名字不能为空",
			msgEmptyModel: "AI模型不能为空",
			msgEmptyMember: "会议参与者不能为空",
			hintSendMessage: "按`Ctrl+Enter`或点击发送按钮发送信息，输入/stop可强行打断AI回复，输入/resume可恢复AI回复，输入/save可保存当前Agent信息。",
		},
	},
	en: {
		buttons: {
			submit: "Submit",
			cancel: "Cancel",
			sender: "Send",
			placeholder: "Click \"Send\" or press Ctrl+Enter to send a message.",
			contentCopied: "Content copied",
			invalid: "Get invalid response",
			thinking: "Inner Thinking",
			strategy: "Reply Strategy",
		},
		listRoom: {
			title: "Select a ConfRoom please",
			description: "You can choose a meeting room and join the discussions of the AIs. Note: Each AI has an independent conversation history and memory, so the more AIs in the meeting room, the more Tokens will be consumed. Therefore, please choose and create meeting rooms carefully!You can choose a meeting room and join the discussions of the AIs. Note: Each AI has an independent conversation history and memory, so the more AIs in the meeting room, the more Tokens will be consumed. Therefore, please choose and create meeting rooms carefully!",
		},
		newRoom: {
			title: "Create ConfRoom",
			description: "Each conference room can have at most one host to help you control the meeting process, and at least one participant. In addition, you can set a topic for each meeting, or you can have a free discussion without any topic at all.",
			hintName: "Conference Name",
			hintTopic: "Conference Topic",
			msgTopic: "You can set a specific meeting topic, or have a free discussion without a topic.",
			hintHoster: "Select participants (Blue: Participant, Red: Host. Optional host, at least one participant required.):",
			newAgent: "Create Agent",
			noAgent: "No Available Agent",
			agentDesc: "You can set the name, gender, occupation, age, personality, experience, etc. of meeting participants, as well as speaking style and notes for dialogue, so that the Agent can have a more distinct personality.\nIntelligent agents will learn some ideas on their own, which you cannot modify, but can reset.",
			hintAgentName: "Name",
			hintNewAgent: "Setting:",
			hintSelectModel: "Select AI Model for your Agent:",
			hintAgentInnerIdea: "Inner Thoughts:",
			msgNoAgentInnerIdea: "(empty now)",
			resetAgentInnerIdea: "Reset Inner Thoughts",
			msgResetAgentInnerIdea: "Inner thoughts have been reset.",
			msgEmptyName: "Name cannot be empty.",
			msgEmptyModel: "The AI model cannot be empty.",
			msgEmptyMember: "Conference participants cannot be empty.",
			hintSendMessage: "Press `Ctrl+Enter` or click the send button to send a message, type /stop to forcibly interrupt the AI's response, type /resume to resume the AI's response, type /save to save the current Agent information.",
		},
	},
};

/* DB */

const initDB = async () => {
	await initDBAgents();
};

/* Events */

ActionCenter.backToHome = () => {
	ActionCenter.clearConversation();
	if (panelHistory.length <= 1) {
		location.href = "./newtab.html";
	}
	else {
		panelHistory.pop();
		const panel = panelHistory[panelHistory.length - 1];
		showPanel(panel);
	}
};
ActionCenter.createNewAgent = () => {
	showGenerateParticipant();
};
ActionCenter.submitCreateAgent = async () => {
	const messages = getMessages();

	const name = NewAgentName.value.trim();
	if (!name) {
		Notification.show('', messages.newRoom.msgEmptyName, 'rightTop', 'warn');
		return;
	}
	const list = ModelListContainer.querySelector('.listItem[choosen="true"]');
	if (!list) {
		Notification.show('', messages.newRoom.msgEmptyModel, 'rightTop', 'warn');
		return;
	}

	let id = NewAgentName._agentID;
	let info;
	if (!id) {
		info = {
			id: newID(16),
			type: 'participant',
			emotion: "",
			desire: "",
			inner: "",
		};
		id = info.id;
	}
	else {
		info = await DBs.Agents.get('agents', id);
	}

	info.name = name;
	info.setting = NewAgentSetting.value.trim();
	info.model = list._model;
	info.timestamp = Date.now();

	await DBs.Agents.set('agents', id, info);

	ActionCenter.cancelCreateAgent();
};
ActionCenter.cancelCreateAgent = async () => {
	NewAgentName.value = "";
	NewAgentSetting.value = "";

	await showParticipantList();
	ActionCenter.backToHome();
};
ActionCenter.resetAgentInnerIdea = async () => {
	const id = NewAgentName._agentID;
	const info = await DBs.Agents.get('agents', id);
	info.emotion = "";
	info.desire = "";
	info.inner = "";
	try {
		await DBs.Agents.set('agents', id, info);
	}
	catch (err) {
		logger.error('ResetAgent:' + id, err);
		err = err.message || err.msg || err.data || err.toString();
		Notification.show('', err, 'rightTop', 'error');
		return;
	}
};
ActionCenter.generateNewRoom = async () => {
	const messages = getMessages();

	const name = NewRoomName.value.trim();
	if (!name) {
		Notification.show('', messages.newRoom.msgEmptyName, 'rightTop', 'warn');
		return;
	}
	let members = NewRoomParticipants.querySelectorAll('.listItem[mode="1"]');
	if (!members.length) {
		Notification.show('', messages.newRoom.msgEmptyMember, 'rightTop', 'warn');
		return;
	}

	const roomID = NewRoomName._roomID;
	const roomInfo = !!roomID ? (await DBs.Agents.get('agents', roomID)) || {} : {};
	if (!roomInfo.id) roomInfo.id = newID(16);
	if (!roomInfo.type) roomInfo.type = 'chatroom';

	roomInfo.name = name;
	roomInfo.topic = NewRoomTopic.value.trim();
	const host = NewRoomParticipants.querySelector('.listItem[mode="2"]');
	if (!!host) {
		let agent = host.getAttribute('agent');
		if (!!agent) roomInfo.host = agent;
	}
	else {
		roomInfo.host = null;
	}
	members = [...members].map(member => member.getAttribute('agent')).filter(agent => !!agent);
	if (!members.length) {
		Notification.show('', messages.newRoom.msgEmptyMember, 'rightTop', 'warn');
		return;
	}
	roomInfo.members = members;
	roomInfo.timestamp = Date.now();

	try {
		await DBs.Agents.set('agents', roomInfo.id, roomInfo);
	}
	catch (err) {
		logger.error('NewRoom:' + roomInfo.id, err);
		err = err.message || err.msg || err.data || err.toString();
		Notification.show('', err, 'rightTop', 'error');
		return;
	}

	ActionCenter.backToHome();
};
ActionCenter.cancelNewRoom = async () => {
	NewRoomName.value = "";
	NewRoomTopic.value = "";

	ActionCenter.backToHome();
};
ActionCenter.createNewRoom = () => {
	showGenerateChatRoom();
};
ActionCenter.onEnterMessage = (ele, _, evt) => {
	if (!evt.ctrlKey || evt.key !== 'Enter') return;
	ActionCenter.onSendMessage();
};
ActionCenter.onSendMessage = async () => {
	if (!currentRoomInfo) return;

	const content = getPageContent(RequestInputter, true);
	if (!content) return;

	const mail = {
		sender: myInfo.name,
		target: "all",
		time: Date.now(),
		content
	};
	currentRoomInfo.users.members.forEach(member => {
		member.getMail(mail, true);
	});
	if (currentRoomInfo.users.host) currentRoomInfo.users.host.getMail(mail, true);
	addChatContent('human', content);
	RequestInputter.innerHTML = '';
	resizeInputter();
};
ActionCenter.clearConversation = () => {
	if (!currentRoomInfo || !currentRoomInfo.users) return;
	if (!!currentRoomInfo.users.host) currentRoomInfo.users.host.reset();
	if (!!currentRoomInfo.users.members) currentRoomInfo.users.members.forEach(member => {
		member.reset();
	});
	ConversationArea.innerHTML = '';
};
ActionCenter.switchVisibility = () => {
	const messages = getMessages();

	let isGlobalChannel = !ConversationArea.parentElement.getAttribute('globalChannel');
	if (isGlobalChannel) {
		ConversationArea.parentElement.setAttribute('globalChannel', 'true');
		Notification.show('', messages.buttons.notShowAll, 'rightTop', 'message');
	}
	else {
		ConversationArea.parentElement.removeAttribute('globalChannel');
		Notification.show('', messages.buttons.showAll, 'rightTop', 'message');
	}
};

/* Actions */

const showRoomList = async () => {
	panelHistory.push('listRoom');

	let list = await updateRoomList();
	if (list.length === 0) {
		showGenerateChatRoom();
		return;
	}

	showPanel('listRoom');
};
const updateRoomList = async () => {
	ChatRoomListContainer.innerHTML = '';
	let list = await DBs.Agents.all('agents');
	list = Object.values(list);
	list = list.filter(item => item.type === 'chatroom');
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

		ChatRoomListContainer.appendChild(ui);
	});

	return list;
};
const showParticipantList = async () => {
	const roomID = NewRoomName._roomID;
	const roomInfo = !!roomID ? (await DBs.Agents.get('agents', roomID)) || {} : {};
	roomInfo.members = roomInfo.members || [];

	let list = await DBs.Agents.all('agents');
	list = Object.values(list);
	list = list.filter(item => item.type === 'participant');
	NewRoomParticipants.innerHTML = '';
	if (list.length === 0) {
		NewRoomParticipants.classList.add('no_agent');
		const messages = getMessages();
		NewRoomParticipants.innerText = messages.newRoom.noAgent;
	}
	else {
		NewRoomParticipants.classList.remove('no_agent');
		list.sort((a, b) => {
			const A = a.timestamp || 0;
			const B = b.timestamp || 0;
			return B - A;
		});
		list.forEach(item => {
			const ui = newEle('div', 'listItem');
			ui.setAttribute('agent', item.id);
			if (item.id === roomInfo.host) {
				ui.setAttribute('mode', "2");
			}
			else if (roomInfo.members.includes(item.id)) {
				ui.setAttribute('mode', "1");
			}
			else {
				ui.setAttribute('mode', "0");
			}
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

			NewRoomParticipants.appendChild(ui);
		});
	}
};
const showGenerateChatRoom = async (info) => {
	info = info || {};

	NewRoomName._roomID = info.id;
	NewRoomName.value = info.name || '';
	NewRoomTopic.value = info.topic || '';

	await showParticipantList();

	panelHistory.push('newRoom');
	showPanel('newRoom');
};
const showGenerateParticipant = async (info) => {
	const messages = getMessages();
	info = info || {};

	NewAgentName._agentID = info.id;
	NewAgentName.value = info.name || '';
	NewAgentSetting.value = info.setting || '';
	let inner = [];
	if (!!info.emotion) inner.push('当下情绪: ' + info.emotion);
	if (!!info.desire) inner.push('渴望与理想: ' + info.desire);
	if (!!info.inner) inner.push('内心想法: ' + info.inner);
	inner = inner.join('\n\n');
	if (!!inner) {
		NewAgentName.parentElement.classList.remove('no_inner');
		AgentInnerIdea.innerText = inner;
	}
	else {
		NewAgentName.parentElement.classList.add('no_inner');
		AgentInnerIdea.innerHTML = messages.newRoom.msgNoAgentInnerIdea;
	}
	ModelListContainer.innerHTML = '';
	for (let model of availableModelList) {
		const list = newEle('div', 'listItem');
		list.innerText = model;
		list._model = model;
		if (model === info.model) {
			list.setAttribute('choosen', "true");
		}
		ModelListContainer.appendChild(list);
	}

	panelHistory.push('newAgent');
	showPanel('newAgent');
};
const startConference = async (info) => {
	let list = await DBs.Agents.all('agents');
	list = Object.values(list);
	list = list.filter(item => item.type === 'participant');
	totalSendLog.splice(0);

	currentRoomInfo = {
		topic: info.topic,
		members: info.members.map(id => {
			const item = list.filter(item => item.id === id)[0];
			return item;
		}),
		users: {},
	};
	currentRoomInfo.users.members = currentRoomInfo.members.map(mem => {
		return new Participant(false, mem, currentRoomInfo);
	});
	if (!!info.host) {
		list.some(item => {
			if (item.id !== info.host) return;
			currentRoomInfo.host = item;
			currentRoomInfo.users.host = new Participant(true, currentRoomInfo.host, currentRoomInfo);
			return true;
		});
	}

	ConversationArea.innerHTML = '';

	panelHistory.push('conferencePanel');
	showPanel('conferencePanel');
};
const addChatContent = (type, content, title, visible=true) => {
	const json = isString(content) ? parseReplyAsXMLToJSON(content) : content;

	const thinking = json.thinking?._origin || json.thinking;
	if (!!thinking) {
		addChatItem('thinking', thinking, undefined, false);
	}

	const strategy = json.strategy?._origin || json.strategy;
	if (!!strategy) {
		addChatItem('strategy', strategy, undefined, false);
	}

	content = json.reply?._origin || json.reply || json.content?._origin || json.content || content;
	addChatItem(type, content, title, visible);
};
const addChatItem = (type, content, title, visible) => {
	if (!content || !type) return;

	const item = newEle('div', 'chat_item');
	item.setAttribute('forAllChannel', visible);
	item._content = content;

	const titleBar = newEle('div', "chat_title");
	let needCopy = false;
	if (type === 'human') {
		item.classList.add('human');
		titleBar.innerText = myInfo.name + ':';
		needCopy = true;
	}
	else if (type === 'ai') {
		item.classList.add('ai');
		titleBar.innerText = title + ':';
		needCopy = true;
	}
	else {
		item.classList.add('hint');
		const messages = getMessages();
		const title = messages.buttons[type];
		if (!title) return;
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

	wait(60).then(() => {
		const toBottom = ConversationArea.scrollHeight - ConversationArea.scrollTop - ConversationArea.offsetHeight;
		const limit = item.getBoundingClientRect().height + 240;
		console.log('---------------------->', toBottom, limit);
		if (toBottom > limit) return;
		ConversationArea.scrollTop = ConversationArea.scrollHeight - ConversationArea.offsetHeight;
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

/* Init */

const initUI = () => {
	renderI18N();
	registerAction();

	ModelListContainer.addEventListener('click', ({target}) => {
		if (target.classList.contains('listItem')) {
			[...ModelListContainer.querySelectorAll('[choosen="true"]')].forEach(ele => ele.setAttribute("choosen", "false"));
			target.setAttribute('choosen', "true");
		}
	});
	NewRoomParticipants.addEventListener('click', async ({target}) => {
		if (target.tagName === 'IMG') target = target.parentElement;
		let action = "choose";
		if (target.classList.contains('itemTool')) {
			action = target.getAttribute('action');
			target = target.parentElement;
		}
		if (!target.classList.contains('listItem')) return;
		const agent = target.getAttribute('agent');
		if (!agent) return;

		if (action === 'modify') {
			const info = await DBs.Agents.get('agents', agent);
			if (!info) return;
			showGenerateParticipant(info);
		}
		else if (action === 'delete') {
			await DBs.Agents.del('agents', agent);
			showParticipantList();
		}
		else if (action === 'choose') {
			const mode = target.getAttribute('mode');
			if (mode === "0") {
				target.setAttribute('mode', 1);
			}
			else if (mode === '1') {
				[...NewRoomParticipants.querySelectorAll('.listItem[mode="2"]')].forEach(ui => ui.setAttribute('mode', 1));
				target.setAttribute('mode', 2);
			}
			else {
				target.setAttribute('mode', 0);
			}
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
	ChatRoomListContainer.addEventListener('click', async ({target}) => {
		if (target.tagName === 'IMG') target = target.parentElement;
		let action = "choose";
		if (target.classList.contains('itemTool')) {
			action = target.getAttribute('action');
			target = target.parentElement;
		}
		if (!target.classList.contains('listItem')) return;
		const agent = target.getAttribute('agent');
		if (!agent) return;

		if (action === 'modify') {
			const info = await DBs.Agents.get('agents', agent);
			if (!info) return;
			showGenerateChatRoom(info);
		}
		else if (action === 'delete') {
			await DBs.Agents.del('agents', agent);
			updateRoomList();
		}
		else if (action === 'choose') {
			const info = await DBs.Agents.get('agents', agent);
			if (!info) return;
			startConference(info);
		}
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

	window.addEventListener('resize', resizeInputter);
};

const onLoad = async () => {
	initUI();

	await showRoomList();

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