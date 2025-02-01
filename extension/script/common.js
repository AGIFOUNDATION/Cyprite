const HTMLTags = ('a|b|i|strong|em|u|del|img|div|span|p|input|textarea|button|br|hr|h1|h2|h3|h4|h5|h6|ul|ol|li|blockquote|script|style').split('|').map(tag => tag.toLowerCase());
const RegUnlatin = /(\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Hangul}|\p{Script=Thai}|\p{Script=Arabic})/gu;
const RegLatin = /(\p{L}+)/ug;
const RegPunctuation = /[\p{P}．，、。？！；：‘’“”"'\(\)\[\]\{\}《》〈〉<>«»“„\-_=\+~`\/\\\|@#\$%\^&\*…—·～¡¿・ー;\u00A1-\u00BF\u2000-\u206F\u3000-\u303F\uFF00-\uFFEF]/gu;

globalThis.IsPublished = true;

globalThis.OneMinute = 60 * 1000;
globalThis.DayLong = 24 * 3600 * 1000;

globalThis.TagSearchRecord = 'CACHE_SEARCH_RECORDS';
globalThis.TagArticleList = 'CACHE_ARTICLE_LIST';
globalThis.TagKeywordList = 'CACHE_KEYWORD_LIST';
globalThis.TagCategoryList = 'CACHE_CATEGORY_LIST';
globalThis.TagFreeCypriteConversation = "FREECYPRITECONVERSATION"

globalThis.ForceServer = false;
globalThis.TrialVersion = true;

globalThis.DurationForever = DayLong;

globalThis.DefaultLang = 'en';
globalThis.i18nList = ['en', 'zh', 'fr', 'de', 'it', 'jp'];
globalThis.LangName = {
	'zh': "中文",
	'en': "English",
	'fr': 'Français',
	'de': 'Deutsch',
	'it': 'Italiano',
	'jp': "日本語",
};

globalThis.wait = delay => new Promise(res => setTimeout(res, delay));
globalThis.PoolWaitLock = class PoolWaitLock {
	#limit = 1;
	#count = 0;
	#pool = [];
	constructor (limit=1) {
		if (!isNumber(limit) || limit < 1) return;
		this.#limit = limit;
	}
	start () {
		this.#count ++;
		return new Promise(res => {
			if (this.#count <= this.#limit) return res();
			this.#pool.push(res);
		});
	}
	finish () {
		this.#count --;
		if (this.#pool.length === 0) return;
		var res = this.#pool.shift();
		res();
	}
};

globalThis.newID = (len=16) => {
	var id = [];
	for (let i = 0; i < len; i ++) {
		let d = Math.floor(Math.random() * 36).toString(36);
		id.push(d);
	}
	return id.join('');
};

globalThis.parseValue = (value, grant=false) => {
	if (!isString(value)) return value;
	var num = value * 1;
	if (!isNaN(num) && value !== '') return num;
	var low = value.toLowerCase();
	if (grant) {
		if (['true', 'ok', 'yes'].includes(low)) return true;
		if (['false', 'no', 'not'].includes(low)) return false;
	}
	else {
		if (['true'].includes(low)) return true;
		if (['false'].includes(low)) return false;
	}
	return value;
};
globalThis.readData = (data, path) => {
	if (isString(path)) {
		path = path.split('.').map(line => line.trim()).filter(line => !!line);
	}
	if (path.length === 0) return data;
	if (path.length === 1) return data[path[0]];
	var key = path.shift();
	data = data[key];
	if (data === null || data === undefined) return data;
	return readData(data, path);
};
globalThis.writeData = (data, path, value) => {
	if (!isObject(data)) return;
	if (isString(path)) {
		path = path.split('.').map(line => line.trim()).filter(line => !!line);
	}
	if (path.length === 0) return;
	if (path.length === 1) data[path[0]] = value;
	var key = path.shift();
	var next = data[key];
	if (next === undefined) {
		next = {};
		data[key]  = next;
	}
	writeData(next, path, value);
};
globalThis.parseParams = param => {
	var json = {};
	param = (param || '').split('?');
	param.shift();
	param = (param || '').join('?').split('&');
	param.forEach(item => {
		item = item.split('=');
		var key = item.shift();
		if (!key) return;
		item = item.join('=').trim();
		var value = item * 1;
		if (!isNaN(value)) {
			item = value;
		}
		else {
			value = item.toLowerCase();
			if (value === 'true') {
				item = true;
			}
			else if (value === 'false') {
				item = false;
			}
		}
		json[key] = item;
	});
	return json;
};
globalThis.parseURL = url => {
	// For VUE SPA
	if (url.match(/\/#[\w\W]*[\?\/]/)) {
		url = url.replace(/\/#/, '/');
		let match = url.match(/[\w\d\-_]+=[\w\d\-_\.\/]+/gi);
		url = url.replace(/[#\?][\w\W]*$/, '');
		if (!!match) {
			match = match.map(item => {
				item = item.split('=');
				return item;
			});
			match.sort((a, b) => a[0] > b[0] ? 1 : (a[0] < b[0] ? -1 : 0));
			match = match.map(item => item.join('/')).join('/');
			url = url + '/' + match;
			url = url.replace(/\/\/+/g, '/');
		}
	}
	else {
		url = url.replace(/[#\?][\w\W]*$/, '');
	}
	return url;
};
globalThis.parseArray = (array, noSub=true) => {
	if (isArray(array)) return array;
	if (!isString(array)) return [];
	array = (array || '')
		.replace(/^\{|\}$/g, '').trim()
		.split(/\s*[\n\r]+\s*/).filter(line => !!line)
		.map(line => line.replace(/^(\s*(\-|\+|\*|\d+\.)\s+)+/, '').trim());
	if (noSub) {
		array = array.join(',').split(/\s*[,，;；、]\s*/);
	}
	return array;
};
globalThis.parseReplyAsXMLToJSON = (xml, forceLowerCase=true, init=true, blocks) => {
	if (!xml) {
		if (xml === 0) return 0;
		if (xml === false) return false;
		return {};
	}
	if (isObject(xml)) return xml;

	const reg = /<(\/?)([^>\n\r\t ]+?[^>\n\r]*?)>/gi;

	if (init) {
		// Mark special blocks
		blocks = blocks || {};
		let blockCount = 0;
		// xml = xml.replace(/```\w*[\n\r]+[\w\W]*?[\n\r]+```/gi, (m) => {
		// 	blockCount ++;
		// 	let tagName = 'BLOCK::' + blockCount;
		// 	blocks[tagName] = m;
		// 	return '[' + tagName + ']';
		// });
		xml = xml.replace(/<(svg)([^>]*?)?>[\w\W]*?<\/\1>/gi, (m) => {
			blockCount ++;
			let tagName = 'BLOCK::' + blockCount;
			blocks[tagName] = m;
			return '[' + tagName + ']';
		});

		xml = xml.replace(/<[^\n\r ]*?\s*\/>/g, ''); // Remove self-closed tags
		let tags = [], lev = 0;
		xml.replace(reg, (_, end, tag) => {
			end = !!end;
			if (end) lev --;
			else lev ++;
			tags.push([tag, end, lev]);
		});
		let hasChanged = true;
		while (hasChanged) {
			let last = [];
			let removes = [];
			tags.forEach((tag, i) => {
				if (tag[0] === last[0] && !last[1] && !!tag[1]) {
					removes.push(i - 1);
					removes.push(i);
				}
				last = tag;
			});
			if (removes.length === 0 || tags.length === 0) {
				hasChanged = false;
			}
			else {
				hasChanged = true;
				removes.reverse();
				removes.forEach(idx => tags.splice(idx, 1));
			}
		}
		let pres = [], posts = [];
		tags.some(tag => {
			if (tag[1]) {
				pres.push(tag[0]);
			}
			else {
				return true;
			}
		});
		tags.reverse().some(tag => {
			if (tag[1]) {
				return true;
			}
			else {
				posts.push(tag[0]);
			}
		});
		pres.forEach(tag => {
			xml = '<' + tag + '>' + xml;
		});
		posts.forEach(tag => {
			xml = xml + '</' + tag + '>';
		});
	}

	const recallContent = ctx => {
		let str = ctx;
		let result = ctx;
		while (true) {
			str = result.replace(/\[BLOCK::\d+\]/g, (m) => {
				let key = m.replace(/\[|\]/g, '');
				return (blocks || {})[key] || m;
			});
			if (result === str) break;
			result = str
		}
		return result;
	};

	let json = { _origin: recallContent(xml.trim()) };
	let stacks = [];
	xml.replace(reg, (m, end, tag, pos) => {
		if (!tag.match(/[a-z]/i)) return;
		let low = tag.toLowerCase();
		if (HTMLTags.includes(low)) return;
		if (forceLowerCase) tag = low;
		end = !!end;

		if (end) {
			let info = null, idx = -1;
			for (let i = stacks.length - 1; i >= 0; i --) {
				let stack = stacks[i];
				if (stack[1] === low) {
					info = stack;
					idx = i;
					break;
				}
			}
			if (!!info) {
				stacks.splice(idx);
				if (idx === 0) {
					let loc = info[2];
					tag = info[0];
					let sub = xml.substring(loc, pos).trim();
					let value;
					if (!!sub.match(reg)) {
						value = parseReplyAsXMLToJSON(sub, forceLowerCase, false, blocks);
					}
					else {
						let low = sub.toLowerCase();
						if (low === 'true') {
							value = true;
						}
						else if (low === 'false') {
							value = false;
						}
						else if (!!sub.match(/^(\d+|\d+\.|\.\d+|\d+\.\d+)$/)) {
							value = sub * 1;
						}
						else {
							value = recallContent(sub);
						}
					}
					if (json[tag] === undefined) {
						json[tag] = value;
					}
					else if (isArray(json[tag])) {
						json[tag].push(value);
					}
					else {
						json[tag] = [json[tag], value];
					}
				}
			}
		}
		else {
			stacks.push([tag, low, pos + m.length]);
		}
	});

	return json;
};

globalThis.simplyParseHTML = (content, host) => {
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
globalThis.getPageContent = (container, keepLink=false) => {
	var content = isString(container) ? container : container.innerHTML || '';
	if (!content) return;

	content = content.replace(/<img(\s+[\w\W]*?)?\/?>/gi, (m, prop) => {
		var link = (prop || '').match(/src=('|")([\w\W]*?)\1/);
		if (!link) link = '';
		else link = link[2].trim();

		var title = (prop || '').match(/alt=('|")([\w\W]*?)\1/);
		if (!title) title = '';
		else title = title[2].trim();

		if (title.indexOf('{') === 0) {
			if (keepLink) return '> ' + title + '\n\n![](' + link + ')';
			else return '> ' + title;
		}

		if (keepLink) return ' ![' + title + '](' + link + ') ';
		return ' ' + (title || '(image)') + ' ';
	});
	if (globalThis.document) content = clearHTML(content, true, true);
	content = content.replace(/<(h\d)(\s+[\w\W]*?)?>([\w\W]*?)<\/\1>/gi, (m, tag, prop, inner) => {
		var lev = tag.match(/h(\d)/i);
		lev = lev[1] * 1;
		if (lev === 1) return '\n\n##\t' + inner + '\n\n';
		if (lev === 2) return '\n\n###\t' + inner + '\n\n';
		if (lev === 3) return '\n\n####\t' + inner + '\n\n';
		if (lev === 4) return '\n\n#####\t' + inner + '\n\n';
		if (lev === 5) return '\n\n######\t' + inner + '\n\n';
		return inner;
	});
	content = content.replace(/<\/?(article|header|section|aside|footer|div|p|center|ul|ol|tr)(\s+[\w\W]*?)?>/gi, '<br><br>');
	content = content.replace(/<\/?(option|span|font)(\s+[\w\W]*?)?>/gi, '');
	content = content.replace(/<\/(td|th)><\1(\s+[\w\W]*?)?>/gi, ' | ');
	content = content.replace(/<(td|th)(\s+[\w\W]*?)?>/gi, '| ');
	content = content.replace(/<\/(td|th)>/gi, ' |');
	content = content.replace(/<hr(\s+[\w\W]*?)?>/gi, '<br>----<br>');
	content = content.replace(/<li mark="([\w\W]+?)">/gi, (m, mark) => mark + '\t');
	content = content.replace(/<li(\s+[\w\W]*?)?>/gi, '-\t');
	content = content.replace(/<\/li>/gi, '\n');
	content = content.replace(/<\/?(b|strong)(\s+[\w\W]*?)?>/gi, '**');
	content = content.replace(/<\/?(i|em)(\s+[\w\W]*?)?>/gi, '*');
	if (!keepLink) {
		content = content.replace(/<\/?a(\s+[\w\W]*?)?>/gi, '');
	}
	else {
		let temp = '';
		while (content !== temp) {
			temp = content;
			content = content.replace(/<a(\s+[\w\W]*?)?>([\w\W]*?)<\/a>/gi, (m, prop, inner) => {
				var match = (prop || '').match(/href=('|")([\w\W]*?)\1/);
				if (!match) return inner;
				match = match[2];
				return '[' + inner + '](' + match + ')';
			});
		}
	}

	content = content.replace(/\s*<br>\s*/gi, '\n');
	content = content.replace(/<\/?([\w\-\_]+)(\s+[\w\W]*?)?>/gi, '');
	content = content.replace(/\r/g, '');
	content = content.replace(/\n\n+/g, '\n\n');

	content = content.replace(/\[\s*[\n\r]+\s*/gi, '[');
	content = content.replace(/\s*[\n\r]+\s*\]/gi, ']');
	content = content.replace(/([\n\r]\s*[\-\+\*>])\s*[\n\r]+\s*/gi, (m, pre) => pre + ' ');

	content = content.trim();

	if (globalThis.document) {
		let parser = new DOMParser();
		let dom = parser.parseFromString(content, "text/html");
		content = dom.body.textContent;
	}

	return content;
};
globalThis.parseWebPage = (content, keepLink=false, host) => {
	if (!content) return '';
	content = simplyParseHTML(content, host);
	if (!!globalThis.document) {
		let container = newEle('section');
		container.style.display = 'none';
		container.innerHTML = content;
		content = getPageContent(container, keepLink);
		container.innerHTML = '';
		container = null;
	}
	else {
		content = getPageContent(content, keepLink);
	}
	return content;
};

globalThis.newEle = (tag, ...classList) => {
	var ele = document.createElement(tag);
	classList.forEach(cls => ele.classList.add(cls));
	return ele;
};

globalThis.calculateHash = async (content, algorithm='SHA-256') => {
	const encoder = new TextEncoder();
	const data = encoder.encode(content);

	var buffer = await crypto.subtle.digest(algorithm, data);

	const hashArray = Array.from(new Uint8Array(buffer));
	const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
	return hashHex;
};

globalThis.calculateWordCount = (text) => {
	if (!text) return {
		total: 0,
		words: 0,
		latin: 0,
		unlatin: 0,
		punctuation: 0,
	};

	var match = text.match(/(\p{L}+)/ug);
	if (!match) return 0;
	var countLatin = 0, countUnlatin = 0, countPunctuation = (text.match(RegPunctuation) || []).length;
	match.forEach(part => {
		part = part.replace(RegUnlatin, (m) => {
			countUnlatin += m.length;
			return ' ';
		});
		match = part.match(RegLatin) || [];
		countLatin += match.length;
	});
	return {
		total: countLatin + countUnlatin + countPunctuation,
		words: countLatin + countUnlatin,
		latin: countLatin,
		unlatin: countUnlatin,
		punctuation: countPunctuation,
	};
};
globalThis.calculateByteSize = (obj) => {
	obj = JSON.stringify(obj);
	var size = new Blob([obj]).size;
	return size;
};
globalThis.estimateTokenCount = (obj) => {
	var wc = calculateWordCount(JSON.stringify(obj));
	var bytes = calculateByteSize(obj);
	return Math.min(wc.unlatin + wc.latin * 3, Math.ceil(bytes / 3));
};

globalThis.updateUsage = (totalUsage, newUsage) => {
	if (!isObject(newUsage)) return;
	for (let key in newUsage) {
		let usg = newUsage[key];
		let item = totalUsage[key] || {count: 0, input: 0, output: 0};
		item.count += usg.count || 1;
		item.input += usg.input || 0;
		item.output += usg.output || 0;
		totalUsage[key] = item;
	}
};

/* Log Utils */

globalThis.logger = {};
logger.log = (tag, ...logs) => {
	console.log(`%c[${tag}]`, "color: blue; font-weight: bolder; padding: 2px 5px; border-radius: 5px; background-color: rgb(250, 250, 250);", ...logs);
};
logger.info = (tag, ...logs) => {
	console.info(`%c[${tag}]`, "color: green; font-weight: bolder; padding: 2px 5px; border-radius: 5px; background-color: rgb(250, 250, 250);", ...logs);
};
logger.warn = (tag, ...logs) => {
	console.warn(`%c[${tag}]`, "color: magenta; font-weight: bolder; padding: 2px 5px; border-radius: 5px; background-color: rgb(250, 250, 250);", ...logs);
};
logger.error = (tag, ...logs) => {
	console.error(`%c[${tag}]`, "color: red; font-weight: bolder; padding: 2px 5px; border-radius: 5px; background-color: rgb(250, 250, 250);", ...logs);
};
logger.em = (tag, ...logs) => {
	console.log(`%c[${tag}]`, "background-color: blue; color: white; font-weight: bolder; padding: 2px 5px; border-radius: 5px; border: 1px solid white;", ...logs);
};
logger.strong = (tag, ...logs) => {
	console.log(`%c[${tag}]`, "background-color: red; color: white; font-weight: bolder; padding: 2px 5px; border-radius: 5px; border: 1px solid white;", ...logs);
};
logger.blank = (tag, ...logs) => {
	console.log(`%c[${tag}]`, "background-color: black; color: white; font-weight: bolder; padding: 2px 5px; border-radius: 5px; border: 1px solid white;", ...logs);
};

/* Type Tools */

globalThis.AsyncFunction = (async function() {}).__proto__;
globalThis.isArray = obj => obj !== null && obj !== undefined && !!obj.__proto__ && obj.__proto__.constructor === Array;
globalThis.isString = obj => obj !== null && obj !== undefined && !!obj.__proto__ && obj.__proto__.constructor === String;
globalThis.isNumber = obj => obj !== null && obj !== undefined && !!obj.__proto__ && obj.__proto__.constructor === Number;
globalThis.isBoolean = obj => obj !== null && obj !== undefined && !!obj.__proto__ && obj.__proto__.constructor === Boolean;
globalThis.isObject = obj => obj !== null && obj !== undefined && !!obj.__proto__ && obj.__proto__.constructor === Object;
globalThis.isFunction = obj => obj !== null && obj !== undefined && !!obj.__proto__ && (obj.__proto__.constructor === Function || obj.__proto__ === AsyncFunction || obj.__proto__.constructor === AsyncFunction);
globalThis.isAsyncFunction = obj => obj !== null && obj !== undefined && !!obj.__proto__ && (obj.__proto__ === AsyncFunction || obj.__proto__.constructor === AsyncFunction);

/* Auxillary Utils and Extends for DateTime */

const WeekDayNames = {
	enS: ['Sun', "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
	enL: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
	zhM: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],
	zhT: ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'],
};

const getLongString = (short, len=2, isLeft=true) => {
	var long = short + '';
	while (long.length < len) {
		if (isLeft) long = '0' + long;
		else long = long + '0';
	}
	return long;
};
const getInfoStrings = (info, type) => {
	var short, long;

	if (type === 'Y') {
		long = info + '';
		short = long.substring(2);
	}
	else if (type === 'ms') {
		short = info + '';
		long = getLongString(info, 3, false);
	}
	else {
		short = info + '';
		long = getLongString(info);
	}

	return [short, long];
};
globalThis.timestmp2str = (time, format) => {
	if (isString(time) && !isString(format)) {
		format = time;
		time = null;
	}
	if (!isString(format)) format = "YYYY/MM/DD hh:mm:ss";

	time = time || new Date();
	if (isNumber(time)) time = new Date(time);

	var [shortYear       , longYear       ] = getInfoStrings(time.getYear() + 1900, 'Y');
	var [shortMonth      , longMonth      ] = getInfoStrings(time.getMonth() + 1, 'M');
	var [shortDay        , longDay        ] = getInfoStrings(time.getDate(), 'D');
	var [shortHour       , longHour       ] = getInfoStrings(time.getHours(), 'h');
	var [shortMinute     , longMinute     ] = getInfoStrings(time.getMinutes(), 'm');
	var [shortSecond     , longSecond     ] = getInfoStrings(time.getSeconds(), 's');
	var [shortMilliSecond, longMilliSecond] = getInfoStrings(time.getMilliseconds(), 'ms');
	var weekdayES = WeekDayNames.enS[time.getDay()];
	var weekdayEL = WeekDayNames.enL[time.getDay()];
	var weekdayZM = WeekDayNames.zhM[time.getDay()];
	var weekdayZT = WeekDayNames.zhT[time.getDay()];

	if (!!format.match(/YYYY+/)) {
		format = format.replace(/YYYY+/g, longYear);
	}
	else if (!!format.match(/Y+/)) {
		format = format.replace(/Y+/g, shortYear);
	}
	if (!!format.match(/MM+/)) {
		format = format.replace(/MM+/g, longMonth);
	}
	else if (!!format.match(/M+/)) {
		format = format.replace(/M+/g, shortMonth);
	}
	if (!!format.match(/DD+/)) {
		format = format.replace(/DD+/g, longDay);
	}
	else if (!!format.match(/D+/)) {
		format = format.replace(/D+/g, shortDay);
	}
	if (!!format.match(/hh+/)) {
		format = format.replace(/hh+/g, longHour);
	}
	else if (!!format.match(/h+/)) {
		format = format.replace(/h+/g, shortHour);
	}
	if (!!format.match(/mm+/)) {
		format = format.replace(/mm+/g, longMinute);
	}
	else if (!!format.match(/m+/)) {
		format = format.replace(/m+/g, shortMinute);
	}
	if (!!format.match(/ss+/)) {
		format = format.replace(/ss+/g, longSecond);
	}
	else if (!!format.match(/s+/)) {
		format = format.replace(/s+/g, shortSecond);
	}
	if (!!format.match(/xxx+/)) {
		format = format.replace(/xxx+/g, longMilliSecond);
	}
	else if (!!format.match(/x+/)) {
		format = format.replace(/x+/g, shortMilliSecond);
	}

	format = format.replace(/:wde:/g, weekdayES);
	format = format.replace(/:WDE:/g, weekdayEL);
	format = format.replace(/:wdz:/g, weekdayZM);
	format = format.replace(/:WDZ:/g, weekdayZT);

	return format;
};
globalThis.convertTimeToArray = time => {
	time = new Date(time);
	let Y = time.getYear() + 1900;
	let M = time.getMonth() + 1;
	let D = time.getDate();
	let h = time.getHours();
	let m = time.getMinutes();
	let s = time.getSeconds();
	return [Y, M, D, h, m, s];
};
globalThis.shiftTimeToDayStart = time => {
	let [y, m, d] = convertTimeToArray(time);
	time = new Date(y + '/' + m + '/' + d);
	return time.getTime();
};
globalThis.timeDifference = (timeA, timeB) => {
	if (!timeB) {
		timeB = Date.now();
	}
	else if (timeA > timeB) {
		[timeA, timeB] = [timeB, timeA];
	}

	const [Y1, M1, D1, h1, m1, s1] = convertTimeToArray(timeA);
	const [Y2, M2, D2, h2, m2, s2] = convertTimeToArray(timeB);
	let dY = Y2 - Y1;
	let dM = M2 - M1;
	let dD = D2 - D1;
	let dh = h2 - h1;
	let dm = m2 - m1;
	let ds = s2 - s1;

	if (dM < 0) {
		dY --;
		dM += 12;
	}
	else if (dM === 0) {
		if (dD < 0) {
			dY --;
			dM = 12;
		}
		else if (dD === 0) {
			if (dh < 0) {
				dY --;
				dM = 12;
			}
			else if (dh === 0) {
				if (dm < 0) {
					dY --;
					dM = 12;
				}
				else if (dm === 0) {
					if (ds < 0) {
						dY --;
						dM = 12;
					}
				}
			}
		}
	}
	if (dY > 0) return dY + ' years ago';

	if (dD < 0) {
		dM --;
	}
	else if (dD === 0) {
		if (dh < 0) {
			dM --;
		}
		else if (dh === 0) {
			if (dm < 0) {
				dM --;
			}
			else if (dm === 0) {
				if (ds < 0) {
					dM --;
				}
			}
		}
	}
	if (dM > 0) return dM + ' months ago';

	dD = Math.floor((timeB - timeA) / 1000 / 3600 / 24);
	if (dD > 0) return dD + ' days ago';

	dh = Math.floor((timeB - timeA) / 1000 / 3600);
	if (dh > 0) return dh + ' hours ago';

	dm = Math.floor((timeB - timeA) / 1000 / 60);
	if (dm > 0) return dm + ' minutes ago';

	ds = Math.floor((timeB - timeA) / 1000);
	return ds + ' seconds ago';
};

/* Memory Control */

globalThis.constructMemory = (inside, outside, tag) => {
	let stack = [];
	if (!!outside && !!outside.__stack__) stack.push(...outside.__stack__);
	stack.push(tag);
	return new Proxy(inside, {
		get: (inner, prop) => {
			if (prop === '__blueprint__') return inner;
			if (prop === '__stack__') return stack;

			let value = inner[prop];
			if (value === undefined) value = outside[prop];
			return value;
		},
		set: (inner, prop, value) => {
			if (prop === '__blueprint__') return false;
			if (prop === '__stack__') return false;

			let old;
			old = inner[prop];
			if (old !== undefined) {
				inner[prop] = value;
				return true;
			}

			old = outside[prop];
			if (old !== undefined) {
				outside[prop] = value;
				return true;
			}

			inner[prop] = value;
			return true;
		}
	});
};