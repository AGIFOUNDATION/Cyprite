const OneMinute = 60 * 1000;
const ModelRequestHistory = {};
const ModelRequestPending = {};

const getRateLimitHistory = (model) => {
	var list = ModelRequestHistory[model];
	if (!list) {
		list = {
			start: [],
			finish: [],
		};
		ModelRequestHistory[model] = list;
	}
	return list;
};
const convertClaudeChinese = content => {
	if (!content) return '';
	content = content.trim();
	if (!content) return '';

	content = content.split(/\r*\n\r*/);
	content = content.map(line => {
		line = line.replace(/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]\s*[\(\)]|[\(\)]\s*[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/gi, (m) => {
			m = m.replace(/\s*([\(\)])\s*/g, (m, o) => {
				if (o === ',') return '，';
				if (o === ':') return '：';
				if (o === ';') return '；';
				if (o === '?') return '？';
				if (o === '!') return '！';
				if (o === '(') return '（';
				if (o === ')') return '）';
				return o;
			});
			return m;
		});
		line = line.replace(/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]\s*[,:;\?\!]/gi, (m) => {
			m = m.replace(/\s*([,:;\?\!\(\)])\s*/g, (m, o) => {
				if (o === ',') return '，';
				if (o === ':') return '：';
				if (o === ';') return '；';
				if (o === '?') return '？';
				if (o === '!') return '！';
				if (o === '(') return '（';
				if (o === ')') return '）';
				return o;
			});
			return m;
		});
		line = line.replace(/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]\s*\.+/gi, (m) => {
			m = m.replace(/\s*(\.+)\s*/g, (m, o) => {
				if (o.length === 1) return '。';
				return "……";
			});
			return m;
		});
		line = line.replace(/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]\s*\-{2,}|\-{2,}\s*[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/gi, (m) => {
			m = m.replace(/\s*(\-{2,})\s*/g, (m, o) => {
				return "——";
			});
			return m;
		});
		line = line.replace(/[\(（]\s*([\w\d_\-\+\*\\\/:;,\.\?\!@%#\^\&\(\)=]+)\s*[\)）]/g, (m, a) => '(' + a + ')');
		return line;
	});
	content = content.join('\n');

	return content;
};

globalThis.AI = globalThis.AI || {};
globalThis.AI.requestRateLimitLock = (model) => new Promise(async res => {
	var aiName = Model2AI[model] || '';
	var rpm = (ModelRateLimit[model] || {}).rpm || (ModelRateLimit[aiName] || {}).rpm || 0;
	if (rpm <= 0) return res();

	var time = Date.now();
	var rateLimiter = getRateLimitHistory(model);
	var delayS = 0, delayF = 0;
	rateLimiter.start = rateLimiter.start.filter(t => time - t <= OneMinute);
	if (rateLimiter.start.length >= rpm) delayS = OneMinute - time + rateLimiter.start[0];
	rateLimiter.finish = rateLimiter.finish.filter(t => time - t <= OneMinute);
	if (rateLimiter.finish.length >= rpm) delayF = OneMinute - time + rateLimiter.finish[0];

	var delay = Math.max(delayS, delayF);
	logger.strong('RPM', 'RPM ' + model + ' : ' + rpm + ' (' + rateLimiter.start.length + ', ' + rateLimiter.finish.length + ') ' + delay);
	var pending = ModelRequestPending[model];
	if (!pending) {
		pending = [];
		ModelRequestPending[model] = pending;
	}
	pending.push(res);
	if (delay === 0) {
		res = pending[0];
		pending.shift();
		if (!!res) res();
		return;
	}

	logger.strong('RPM', 'RPM Waiting: ' + model);
	while (delay > 0) {
		if (delay > 5000) {
			delay -= 5000;
			await wait(5000);
		}
		else {
			await wait(delay);
			delay = 0;
		}
	}
	await AI.requestRateLimitLock(model);
	logger.strong('RPM', 'RPM Continue: ' + model);
	res = pending[0];
	pending.shift();
	if (!!res) res();
});
globalThis.AI.updateRateLimitLock = (model, isStart, input, output) => {
	var time = Date.now();

	var rateLimiter = getRateLimitHistory(model);
	if (isStart) {
		rateLimiter.start.unshift(time);
	}
	else {
		rateLimiter.finish.unshift(time);
	}
	rateLimiter.start = rateLimiter.start.filter(t => time - t <= OneMinute);
	rateLimiter.finish = rateLimiter.finish.filter(t => time - t <= OneMinute);
};
globalThis.AI.sendRequestAndWaitForResponse = async (tag, locker, conversation, url, request, assembleConversation) => {
	assembleConversation();

	var replies = [], usage = { count: 0, input: 0, output: 0 }, isFirst = true, time = Date.now(), loop = 0;
	while (true) {
		let response;
		try {
			await AI.requestRateLimitLock(locker);
			AI.updateRateLimitLock(locker, true);
			response = await waitUntil(fetchWithCheck(url, request));
			AI.updateRateLimitLock(locker, false);
		}
		catch (err) {
			AI.updateRateLimitLock(locker, false);
			throw err;
		}

		let text = await response.text();
		// Occasionally, abnormal JSON structures may appear in some LLM's returned data, requiring additional processing.
		try {
			let inner = text.match(/^\s*b'\{[\w\W]+\}'\s*$/);
			if (!!inner) {
				text = text.replace(/^\s*b'|'\s*$/g, '').replace(/\\n/g, '\n');
			}
			response = JSON.parse(text);
		}
		catch (err) {
			logger.error(tag, err);
			response = {};
		}
		logger.info(tag, response);

		let error = response.error || response.error_msg;
		if (!!error && !!error.message) throw new Error(error.message);

		let usg = response.usage || response.usageMetadata;
		usage.count ++;
		if (!!usg) {
			usage.input += usg.prompt_tokens || usg.input_tokens || usg.promptTokenCount || 0;
			usage.output += usg.completion_tokens || usg.output_tokens || usg.candidatesTokenCount || 0;
		}

		let reply, dueToMaxToken = false;
		if (!!response.choices) {
			reply = response.choices;
			if (!!reply) reply = reply[0];

			if (!!reply) {
				reply = reply.message?.content;
			}

			if (!reply) {
				reply = "";
				let errMsg = response.error?.message || 'Error Occur!';
				logger.error(tag, errMsg);
				throw new Error(errMsg);
			}
			else {
				reply = reply.trim();
				replies.push(reply);
			}

			if ((reply.finish_reason || '').toLowerCase() !== 'length') {
				dueToMaxToken = true;
			}
		}
		else if (!!response.content) {
			reply = response.content;
			if (!!reply) reply = reply[0];

			if (!reply) {
				reply = "";
				let errMsg = response.error?.message || 'Error Occur!';
				logger.error(tag, errMsg);
				throw new Error(errMsg);
			}
			else {
				reply = convertClaudeChinese(reply.text);
				replies.push(reply);
			}

			if ((response.stop_reason || '').toLowerCase() !== 'max_tokens') {
				dueToMaxToken = true;
			}
		}
		else if (!!response.result) {
			reply = response.result;
			dueToMaxToken = !!response.is_truncated;
			if (!reply) {
				reply = "";
				let errMsg = 'Error Occur!';
				logger.error(tag, errMsg);
				throw new Error(errMsg);
			}
			else {
				reply = reply.trim();
				replies.push(reply);
			}
		}
		else if (!!response.candidates) {
			let candidate = response.candidates;
			if (!!candidate) candidate = candidate[0];
			if (!candidate) {
				let errMsg = response.error?.message || 'Error Occur!';
				logger.error(tag, errMsg);
				throw new Error(errMsg);
			}
			else {
				reply = candidate.content?.parts;
				if (!!reply) reply = reply[0];
				if (!reply) {
					reply = "";
					let errMsg = response.error?.message || 'Error Occur!';
					logger.error(tag, errMsg);
					throw new Error(errMsg);
				}
				else {
					reply = reply.text || "";
					reply = reply.trim();
					replies.push(reply);
				}
			}
			if ((candidate.finishReason || "").toLowerCase() !== 'max_tokens') {
				dueToMaxToken = true;
			}
		}

		if (dueToMaxToken) {
			break;
		}
		else {
			if (isFirst) {
				conversation.push(['ai', reply]);
				conversation.push(['human', PromptLib.continueOutput]);
				isFirst = false;
			}
			else {
				conversation[conversation.length - 2][1] = replies.join(' ');
			}
			assembleConversation();
		}

		loop ++;
		if (loop >= ModelContinueRequestLoopLimit) break;
	}
	time = Date.now() - time;
	logger.info(tag, 'Timespent: ' + (time / 1000) + 's; Input: ' + usage.input + '; Output: ' + usage.output);

	return {
		reply: replies.join(' '),
		usage,
	};
};