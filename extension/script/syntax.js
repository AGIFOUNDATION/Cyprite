const RegPlaceHolder = /\[(array|str|sub|fun):\w+\]/;
const RegWholePlaceHolder = new RegExp('^' + RegPlaceHolder.toString().replace(/^\/|\/$/g, '') + '$');
const RegStartPlaceHolder = new RegExp('^' + RegPlaceHolder.toString().replace(/^\/|\/$/g, ''));
const RegGlobalPlaceHolder = new RegExp(RegPlaceHolder.toString().replace(/^\/|\/$/g, ''), "g");
const DefaultFunctions = [
	'add', 'plus', 'minus', 'times', 'divide', 'divideToInteger', 'remainder', 'power',
	'not', 'or', 'and', 'equal', 'notEqual', 'larger', 'largerEqual', 'less', 'lessEqual',
	'inside', 'outside',
	'set', 'plusAndSet', 'minusAndSet', 'timesAndSet', 'divideAndSet'
];

const setDefaultSyntaxConfig = config => {
	config = config || {};

	if (!isArray(config.quotations)) config.quotations = [];
	if (config.quotations.length === 0) config.quotations.push(...Syntax.defaultConfig.quotations);
	if (!isArray(config.brackets)) config.brackets = [];
	if (config.brackets.length === 0) config.brackets.push(...Syntax.defaultConfig.brackets);
	if (!isArray(config.arrayMark)) config.arrayMark = [];
	if (config.arrayMark.length === 0) config.arrayMark.push(...Syntax.defaultConfig.arrayMark);
	if (!isArray(config.delimiters)) config.delimiters = [];
	if (config.delimiters.length === 0) config.delimiters.push(...Syntax.defaultConfig.delimiters);
	if (!isArray(config.decorators)) config.decorators = [];
	if (config.decorators.length === 0) config.decorators.push(...Syntax.defaultConfig.decorators);
	if (!isArray(config.operators)) config.operators = [];
	if (config.operators.length === 0) config.operators.push(...Syntax.defaultConfig.operators);
	if (!isObject(config.functions)) config.functions = {};

	return config;
};
const convertOperators = operators => {
	const priorities = [];
	operators.forEach(op => {
		const p = op.priority || 0;
		if (priorities.includes(p)) return;
		priorities.push(p);
	});
	priorities.sort((a, b) => b - a);

	const opList = [];
	operators.forEach(op => {
		const p = op.priority || 0;
		const idx = priorities.indexOf(p);
		let list = opList[idx];
		if (!list) {
			list = [];
			opList[idx] = list;
		}
		list.push(op);
	});

	return opList;
};
const convertOp2Reg = operators => {
	const list = operators.flat().map(op => {
		op = op.op;
		let pre = '', post = '';
		if (op.match(/^[a-z]/i)) pre = '\\b';
		if (op.match(/[a-z]$/i)) post = '\\b';
		return pre + op.replace(/[\\\+\-\|\*\$\^]/g, m => '\\' + m) + post;
	}).sort((a, b) => b.length - a.length);
	return new RegExp('(' + list.join('|') + ')', 'gi');
};
const extractStrings = (content, quotations, elements) => {
	let inside = false, current, start = -1, last = 0;
	let result = [];
	for (let i = 0; i < content.length; i ++) {
		if (inside) {
			if (content.substr(i, current[1].length) === current[1]) {
				let pre = content.substring(0, i);
				let slashes = pre.match(/\\*$/)[0].length;
				if (slashes >> 1 << 1 === slashes) {
					inside = false;
					last = i + current[1].length;
					let part = content.substring(start + 1, i);
					let tag = "[str:" + Object.keys(elements).length + ']';
					let origin = current[0] + part + current[1];
					let str;
					try {
						let s = JSON.parse(origin);
						str = s;
					}
					catch {
						str = part;
					}
					elements[tag] = {
						origin,
						value: str,
					}
					result.push(tag);
					i += current[1].length - 1;
				}
			}
		}
		else {
			for (let quotation of quotations) {
				if (content.substr(i, quotation[0].length) === quotation[0]) {
					let pre = content.substring(0, i);
					let slashes = pre.match(/\\*$/)[0].length;
					if (slashes >> 1 << 1 === slashes) {
						current = quotation;
						inside = true;
						if (i > last) {
							let part = content.substring(last, i);
							result.push(part);
						}
						i += quotation[0].length - 1;
						start = i;
					}
					break;
				}
			}
		}
	}

	if (inside) {
		let part = content.substring(start + 1);
		let tag = "[str:" + Object.keys(elements).length + ']';
		let origin = current[0] + part + current[1];
		let str;
		try {
			let s = JSON.parse(origin);
			str = s;
		}
		catch {
			str = part;
		}
		elements[tag] = {
			origin,
			value: str,
		}
		result.push(tag);
	}
	else if (last < content.length) {
		let part = content.substring(last);
		result.push(part);
	}

	return result.join('');
};
const extractSubsequences = (content, brackets, arrayMarks, elements, tagName="sub") => {
	let stack = [], result = [];
	let start = -1, last = 0;

	for (let i = 0; i < content.length; i ++) {
		let match = false;
		for (let [bra, ket] of brackets) {
			if (content.substr(i, bra.length) === bra) {
				if (bra.match(/^\w/)) {
					let pre = content.substr(0, i);
					if (!!pre && !!pre.match(/\w$/)) {
						i += bra.length - 1;
						break;
					}
				}
				if (bra.match(/\w$/)) {
					let post = content.substr(i + bra.length);
					if (!!post && !!post.match(/^\w/)) {
						i += bra.length - 1;
						break;
					}
				}
				if (bra === '[') {
					let sub = content.substring(i);
					if (sub.match(RegStartPlaceHolder)) {
						i += sub.length - 1;
						break;
					}
				}
				match = true;
				stack.push([bra, ket]);
				if (stack.length === 1) {
					start = i;
					let pre = content.substring(0, start).match(/\w+(\.\w+)*$/);
					if (!!pre) {
						pre = pre[0];
						if (pre.match(/^\d+$/)) pre = null;
					}
					if (!!pre) {
						start -= pre.length;
					}

					if (start > last) {
						let part = content.substring(last, start);
						result.push(part);
					}
				}
				i += bra.length - 1;
				break;
			}
		}
		if (match) continue;
		if (stack.length === 0) continue;
		let [startMark, endMark] = stack[stack.length - 1];
		if (content.substr(i, endMark.length) === endMark) {
			if (endMark.match(/^\w/)) {
				let pre = content.substr(0, i);
				if (!!pre && !!pre.match(/\w$/)) {
					continue;
				}
			}
			if (endMark.match(/\w$/)) {
				let post = content.substr(i + endMark.length);
				if (!!post && !!post.match(/^\w/)) {
					continue;
				}
			}
			stack.pop();
			if (stack.length === 0) {
				last = i + endMark.length;
				let part = content.substring(start, i);
				let pre;
				if (part.indexOf(startMark) === 0) {
					part = part.substring(startMark.length);
				}
				else {
					pre = part.match(/^\w+(\.\w+)*/)[0];
					part = part.substring(pre.length + startMark.length);
				}
				let tag;
				if (!!pre) {
					tag = "[fun:" + Object.keys(elements).length + ']';
					elements[tag] = {
						action: pre,
						params: part
					};
				}
				else if (arrayMarks.includes(startMark)) {
					tag = "[array:" + Object.keys(elements).length + ']';
					elements[tag] = {
						content: part,
					};
				}
				else {
					tag = "[" + tagName + ":" + Object.keys(elements).length + ']';
					elements[tag] = {
						bracket: [startMark, endMark],
						content: part,
					};
				}
				result.push(tag);
				i += endMark.length - 1;
			}
		}
	}
	if (stack.length > 0) {
		let [startMark, endMark] = stack[0];
		let part = content.substring(start);
		let pre;
		if (part.indexOf(startMark) === 0) {
			part = part.substring(startMark.length);
		}
		else {
			pre = part.match(/^\w+/)[0];
			part = part.substring(pre.length + startMark.length);
		}
		let tag;
		if (!!pre) {
			tag = "[fun:" + Object.keys(elements).length + ']';
			elements[tag] = {
				action: pre,
				params: part
			};
		}
		else {
			tag = "[" + tagName + ":" + Object.keys(elements).length + ']';
			elements[tag] = {
				bracket: [startMark, endMark],
				content: part,
			};
		}
		result.push(tag);
	}
	else if (last < content.length) {
		let part = content.substring(last);
		result.push(part);
	}
	
	return result.join('');
};
const splitContentByDelimiter = (content, delimiters) => {
	const reg = new RegExp('(' + delimiters.join('|') + ')', 'g');
	const result = [];
	let last = 0;
	content.replace(reg, (m, d, p) => {
		let part = content.substring(last, p).trim();
		result.push(part);
		last = p + 1;
	});
	if (result.length > 0) {
		let part = content.substring(last).trim();
		result.push(part);
		return result;
	}
	else {
		return [content];
	}
};
const callDefaultAction = (action, params, values, environment) => {
	let value;

	if (action === 'add' || action === 'plus') {
		value = params[0] + params[1];
	}
	else if (action === 'minus') {
		value = params[0] - params[1];
	}
	else if (action === 'times') {
		value = params[0] * params[1];
	}
	else if (action === 'divide') {
		value = params[0] / params[1];
	}
	else if (action === 'divideToInteger') {
		value = Math.floor(params[0] / params[1]);
	}
	else if (action === 'remainder') {
		let v = Math.floor(params[0] / params[1]);
		value = params[0] - v * params[1];
	}
	else if (action === 'power') {
		value = params[0] ** params[1];
	}
	else if (action === 'not') {
		if (params.length === 0) {
			value = true;
		}
		else if (params.length === 1) {
			value = !params[0];
		}
		else {
			value = params.map(v => !v);
		}
	}
	else if (action === 'or') {
		value = params[0] || params[1];
	}
	else if (action === 'and') {
		value = params[0] && params[1];
	}
	else if (action === 'equal') {
		value = params[0] === params[1];
	}
	else if (action === 'notEqual') {
		value = params[0] !== params[1];
	}
	else if (action === 'larger') {
		value = params[0] > params[1];
	}
	else if (action === 'largerEqual') {
		value = params[0] >= params[1];
	}
	else if (action === 'less') {
		value = params[0] < params[1];
	}
	else if (action === 'lessEqual') {
		value = params[0] !== params[1];
	}
	else if (action === 'inside') {
		if (isArray(params[1])) {
			value = params[1].includes(params[0]);
		}
		else {
			value = false;
		}
	}
	else if (action === 'outside') {
		if (isArray(params[1])) {
			value = !params[1].includes(params[0]);
		}
		else {
			value = false;
		}
	}
	else if (action === 'set') {
		let target = values[0].value;
		if (!isString(target)) {
			target = params[0] + '';
		}
		value = params[1];
		writeData(environment, target, value);
	}
	else if (action === 'plusAndSet') {
		let target = values[0].value;
		if (!isString(target)) {
			target = params[0] + '';
		}
		let old = readData(environment, target) || target;
		value = old + params[1];
		writeData(environment, target, value);
	}
	else if (action === 'minusAndSet') {
		let target = values[0].value;
		if (!isString(target)) {
			target = params[0] + '';
		}
		let old = readData(environment, target) || target;
		value = old - params[1];
		writeData(environment, target, value);
	}
	else if (action === 'timesAndSet') {
		let target = values[0].value;
		if (!isString(target)) {
			target = params[0] + '';
		}
		let old = readData(environment, target) || target;
		value = old * params[1];
		writeData(environment, target, value);
	}
	else if (action === 'divideAndSet') {
		let target = values[0].value;
		if (!isString(target)) {
			target = params[0] + '';
		}
		let old = readData(environment, target) || target;
		value = old / params[1];
		writeData(environment, target, value);
	}

	return value;
};

// const SyntaxTreeCache = new Map();

globalThis.Syntax = {};
Syntax.defaultConfig = {
	quotations: [
		["'", "'"],
		['"', '"'],
	],
	brackets: [
		['(', ')'],
		['[', ']'],
	],
	arrayMark: ['['],
	delimiters: [',', ';'],
	decorators: [
		{
			op: "!",
			isPostfix: false,
			action: 'not'
		}
	],
	operators: [
		{
			op: "+",
			priority: 3,
			action: "add",
		},
		{
			op: "-",
			priority: 3,
			action: "minus",
		},
		{
			op: "*",
			priority: 4,
			action: "times",
		},
		{
			op: "/",
			priority: 4,
			action: "divide",
		},
		{
			op: "\\",
			priority: 4,
			action: "divideToInteger",
		},
		{
			op: "mod",
			priority: 4,
			action: "remainder",
		},
		{
			op: "^",
			priority: 5,
			action: "power",
		},
		{
			op: "**",
			priority: 5,
			action: "power",
		},
		{
			op: "|",
			priority: 2,
			action: "or",
		},
		{
			op: "&",
			priority: 2,
			action: "and",
		},
		{
			op: "or",
			priority: 2,
			action: "or",
		},
		{
			op: "and",
			priority: 2,
			action: "and",
		},
		{
			op: "==",
			priority: 1,
			action: "equal",
		},
		{
			op: "!=",
			priority: 1,
			action: "notEqual",
		},
		{
			op: ">",
			priority: 1,
			action: "larger",
		},
		{
			op: ">=",
			priority: 1,
			action: "largerEqual",
		},
		{
			op: "<",
			priority: 1,
			action: "less",
		},
		{
			op: "<=",
			priority: 1,
			action: "lessEqual",
		},
		{
			op: "in",
			priority: 0,
			action: "inside",
		},
		{
			op: "out",
			priority: 0,
			action: "outside",
		},
		{
			op: "+=",
			priority: -1,
			action: "plusAndSet",
			rtl: true,
		},
		{
			op: "-=",
			priority: -1,
			action: "minusAndSet",
			rtl: true,
		},
		{
			op: "*=",
			priority: -1,
			action: "timesAndSet",
			rtl: true,
		},
		{
			op: "/=",
			priority: -1,
			action: "divideAndSet",
			rtl: true,
		},
		{
			op: "=",
			priority: -1,
			action: "set",
			rtl: true,
		},
	],
};
Syntax.parse = (content, config, elements) => {
	if (!content) return content;

	config = setDefaultSyntaxConfig(config);
	const operators = convertOperators(config.operators);
	const regOperator = convertOp2Reg(config.operators);

	elements = elements || {};

	// Replace all the special placeholder strings
	content = content.replace(RegGlobalPlaceHolder, (m) => {
		if (!!elements[m]) return m;

		let tag = "[str:" + Object.keys(elements).length + ']';
		elements[tag] = m;

		return tag;
	});
	// Find out all the strings
	content = extractStrings(content, config.quotations, elements);

	const parseParts = (content) => {
		// Find out all the outmost brackets
		content = extractSubsequences(content, config.brackets, config.arrayMark, elements);
		// Split String by Delimiters
		content = splitContentByDelimiter(content, config.delimiters);

		content = content.map(ctx => {
			if (!ctx) return null;

			// Split string by operator
			let parts = [], last = 0, usingOperators = [];
			ctx.replace(regOperator, (m, op, pos) => {
				op = op.toLowerCase();
				let part = ctx.substring(last, pos).trim();
				parts.push(part);
				parts.push(op);
				last = pos + op.length;
				if (!usingOperators.includes(op)) {
					usingOperators.push(op);
				}
			});
			parts.push(ctx.substring(last).trim());

			// Convert all atomic items
			for (let i = 0, l = parts.length; i <= l; i += 2) {
				let part = parts[i];

				// Parsing decorator
				let decorator;
				config.decorators.some(dec => {
					if (dec.isPostfix) {
						let pos = part.lastIndexOf(dec.op);
						if (pos >= 0 && pos + dec.op.length === part.length) {
							decorator = dec;
							part = part.substring(0, pos).trim();
						}
					}
					else {
						let pos = part.indexOf(dec.op);
						if (pos === 0) {
							decorator = dec;
							part = part.substring(dec.op.length).trim();
						}
					}
				});

				// Parsing item
				if (part.match(RegWholePlaceHolder)) {
					let value = elements[part];
					if (part.match(/^\[str/)) {
						if (isString(value)) {
							part = {
								type: "string",
								value: value,
							};
						}
						else {
							part = {
								type: "string",
								value: value.value,
							};

						}
					}
					else if (part.match(/^\[sub/)) {
						part = parseParts(value.content);
						if (part.length <= 1) {
							part = part[0] || null;
						}
						if (isArray(part)) {
							part = {
								type: "subsequence",
								value: part,
							};
						}
					}
					else if (part.match(/^\[fun/)) {
						part = parseParts(value.params);
						part = {
							type: "callfunction",
							function: value.action,
							value: part,
						};
					}
					else if (part.match(/^\[array/)) {
						part = parseParts(value.content);
						part = {
							type: "array",
							value: part,
						};
					}
				}
				else {
					let value = part * 1;
					if (!isNaN(value)) {
						part = {
							type: "number",
							value
						};
					}
					else if (part.toLowerCase() === 'true') {
						part = {
							type: "boolean",
							value: true
						};
					}
					else if (part.toLowerCase() === 'false') {
						part = {
							type: "boolean",
							value: false
						};
					}
					else {
						part = {
							type: "variable",
							value: part
						};
					}
				}

				if (!!decorator) {
					part.decorator = decorator.action;
				}

				parts[i] = part;
			}

			// Process according to operator precedence, item by item
			operators.forEach(list => {
				list = list.filter(op => usingOperators.includes(op.op));
				if (list.length === 0) return;

				let rtl = list.some(op => op.rtl), ops = list.map(op => op.op);
				let start = 1, end = parts.length - 1, step = 2;
				if (rtl) {
					start = parts.length - 2;
					end = 0;
					step = -2;
				}

				for (let i = start; rtl ? i > end : i < end; i += step) {
					let op = parts[i];
					op = list.filter(item => item.op === op);
					if (op.length === 0) continue;
					op = op[0];
					let item = {
						type: 'callfunction',
						function: op.action,
						value: [parts[i - 1] || null, parts[i + 1] || null],
					};
					parts.splice(i - 1, 3, item);
					i -= step;
				}
			});

			if (parts.length === 0) return null;
			if (parts.length === 1) return parts[0];
			return parts;
		});

		return content;
	};

	content = parseParts(content);
	if (content.length <= 1) content = content[0] || null;

	return content;
};
Syntax.execute = (content, environment, config, elements) => {
	config = setDefaultSyntaxConfig(config);
	elements = elements || {};
	if (isString(content)) content = Syntax.parse(content, config, elements);

	const execute = (content) => {
		if (content === null) return;
		let value = undefined;
		if (content.type === 'callfunction') {
			let params = content.value.map(v => execute(v));
			if (params.length === 1 && params[0] === null) params = [];
			let hostPath = content.function.split('.');
			hostPath.pop();
			hostPath = hostPath.join('.');
			let fun = readData(config.functions, content.function), host;
			if (!fun) fun = readData(environment, content.function);
			if (!!fun) {
				if (hostPath) host = readData(environment, hostPath);
			}
			else {
				fun = readData(globalThis, content.function);
				if (!!fun) {
					if (hostPath) host = readData(globalThis, hostPath);
				}
			}
			if (isFunction(fun)) {
				try {
					if (content.function.match(/^Sparks\./)) {
						value = fun(params[0], params[1], environment);
					}
					else if (!!host) {
						value = fun.apply(host, params);
					}
					else {
						value = fun(...params);
					}
				}
				catch (err) {
					logger.error('SyntaxExecute', err);
					value = null;
				}
			}
			else if (isObject(fun) && params.length === 1) {
				value = readData(fun, params[0]);
			}
			else if (DefaultFunctions.includes(content.function)) {
				value = callDefaultAction(content.function, params, content.value, environment);
			}
		}
		else if (content.type === 'variable') {
			let v = elements[content.value] || readData(environment, content.value);
			if (v === undefined) {
				if (content.value.match(/^\w+(\.\w+)*$/)) {
					value = undefined;
				}
				else {
					value = content.value;
				}
			}
			else {
				value = v;
			}
			if (!!value && !!value.match && value.match(/^\s*\{[\w\W]*\}\s*$/)) {
				try {
					let json = JSON.parse(value);
					value = json;
				} catch {}
			}
		}
		else if (content.type === 'subsequence') {
			value = content.value;
			if (isArray(value)) {
				value = value.map(item => {
					item = execute(item);
					if (isString(item)) {
						item = item.replace(RegGlobalPlaceHolder, m => {
							let v = elements[m];
							if (!v) return m;
							if (isString(v)) {
								return JSON.stringify(v);
							}
							else {
								return v.origin;
							}
						});
					}
					return item;
				});
			}
			else if (!!(value || {}).type) {
				value = execute(value);
				if (isString(value)) {
					value = value.replace(RegGlobalPlaceHolder, m => {
						let v = elements[m];
						if (!v) return m;
						if (isString(v)) {
							return JSON.stringify(v);
						}
						else {
							return v.origin;
						}
					});
				}
			}
		}
		else if (content.type === 'array') {
			value = content.value.map(item => {
				item = execute(item);
				if (isString(item)) {
					item = item.replace(RegGlobalPlaceHolder, m => {
						let v = elements[m];
						if (!v) return m;
						if (isString(v)) {
							return JSON.stringify(v);
						}
						else {
							return v.origin;
						}
					});
				}
				return item;
			});
		}
		else {
			value = content.value;
		}

		if (!!content.decorator) {
			let fun = config.functions[content.decorator];
			if (!!fun) {
				try {
					value = fun(value);
				}
				catch (err) {
					logger.error('SyntaxExecute', err);
					value = null;
				}
			}
			else {
				value = callDefaultAction(content.decorator, [value], [value], environment);
			}
		}
		if (isString(value)) {
			value = value.replace(RegGlobalPlaceHolder, m => {
				let v = elements[m];
				if (!v) return m;
				return JSON.stringify(v);
			});
		}
		return value;
	};

	if (isArray(content)) {
		content = content.map(ctx => {
			ctx = execute(ctx);
			if (isString(ctx)) {
				ctx = ctx.replace(RegGlobalPlaceHolder, m => {
					let v = elements[m];
					if (!v) return m;
					if (isString(v)) {
						return JSON.stringify(v);
					}
					else {
						return v.origin;
					}
				});
			}
			return ctx;
		});
	}
	else {
		content = execute(content);
		if (isString(content)) {
			content = content.replace(RegGlobalPlaceHolder, m => {
				let v = elements[m];
				if (!v) return m;
				if (isString(v)) {
					return JSON.stringify(v);
				}
				else {
					return v.origin;
				}
			});
		}
	}

	return content;
};
Syntax.executeAndWait = async (content, environment, config, elements) => {
	config = setDefaultSyntaxConfig(config);
	elements = elements || {};
	if (isString(content)) content = Syntax.parse(content, config, elements);

	const execute = async (content) => {
		if (content === null) return;
		let value = undefined;
		if (content.type === 'callfunction') {
			let hasPromise = false;
			let params = content.value.map(v => {
				if (v === undefined) return undefined;
				if (v === null) return null;
				let reply = execute(v);
				if (reply instanceof Promise) hasPromise = true;
				return reply;
			});
			if (hasPromise) {
				params = await Promise.all(params);
			}
			if (params.length === 1 && params[0] === null) params = [];
			let hostPath = content.function.split('.');
			hostPath.pop();
			hostPath = hostPath.join('.');
			let fun = readData(config.functions, content.function), host;
			if (!fun) fun = readData(environment, content.function);
			if (!!fun) {
				if (hostPath) host = readData(environment, hostPath);
			}
			else {
				fun = readData(globalThis, content.function);
				if (!!fun) {
					if (hostPath) host = readData(globalThis, hostPath);
				}
			}
			if (isFunction(fun)) {
				try {
					if (content.function.match(/^Sparks\./)) {
						value = fun(params[0], params[1], environment);
					}
					else if (!!host) {
						value = fun.apply(host, params);
					}
					else {
						value = fun(...params);
					}
					if (value instanceof Promise) value = await value;
				}
				catch (err) {
					logger.error('SyntaxExecute', err);
					value = null;
				}
			}
			else if (isObject(fun) && params.length === 1) {
				value = readData(fun, params[0]);
			}
			else if (DefaultFunctions.includes(content.function)) {
				value = callDefaultAction(content.function, params, content.value, environment);
			}
		}
		else if (content.type === 'variable') {
			let v = elements[content.value] || readData(environment, content.value);
			if (v === undefined) {
				if (content.value.match(/^\w+(\.\w+)*$/)) {
					value = undefined;
				}
				else {
					value = content.value;
				}
			}
			else {
				value = v;
			}
			if (!!value && !!value.match && value.match(/^\s*\{[\w\W]*\}\s*$/)) {
				try {
					let json = JSON.parse(value);
					value = json;
				} catch {}
			}
		}
		else if (content.type === 'subsequence') {
			value = content.value;
			if (isArray(value)) {
				value = await Promise.all(value.map(async item => {
					item = await execute(item);
					if (isString(item)) {
						item = item.replace(RegGlobalPlaceHolder, m => {
							let v = elements[m];
							if (!v) return m;
							if (isString(v)) {
								return JSON.stringify(v);
							}
							else {
								return v.origin;
							}
						});
					}
					return item;
				}));
			}
			else if (!!(value || {}).type) {
				value = await execute(value);
				value = value.replace(RegGlobalPlaceHolder, m => {
					let v = memory[m];
					if (!v) return m;
					if (isString(v)) {
						return JSON.stringify(v);
					}
					else {
						return v.origin;
					}
				});
			}
		}
		else if (content.type === 'array') {
			value = await Promise.all(content.value.map(async item => {
				item = await execute(item);
				if (isString(item)) {
					item = item.replace(RegGlobalPlaceHolder, m => {
						let v = elements[m];
						if (!v) return m;
						if (isString(v)) {
							return JSON.stringify(v);
						}
						else {
							return v.origin;
						}
					});
				}
				return item;
			}));
		}
		else {
			value = content.value;
		}

		if (!!content.decorator) {
			let fun = config.functions[content.decorator];
			if (!!fun) {
				try {
					value = fun(value);
					if (value instanceof Promise) value = await value;
				}
				catch (err) {
					logger.error('SyntaxExecute', err);
					value = null;
				}
			}
			else {
				value = callDefaultAction(content.decorator, [value], [value], environment);
			}
		}
		if (isString(value)) {
			value = value.replace(RegGlobalPlaceHolder, m => {
				let v = elements[m];
				if (!v) return m;
				return JSON.stringify(v);
			});
		}
		return value;
	};

	if (isArray(content)) {
		content = await Promise.all(content.map(async ctx => {
			ctx = await execute(ctx);
			if (isString(ctx)) {
				ctx = ctx.replace(RegGlobalPlaceHolder, m => {
					let v = elements[m];
					if (!v) return m;
					if (isString(v)) {
						return JSON.stringify(v);
					}
					else {
						return v.origin;
					}
				});
			}
			return ctx;
		}));
	}
	else {
		content = await execute(content);
		if (isString(content)) {
			content = content.replace(RegGlobalPlaceHolder, m => {
				let v = elements[m];
				if (!v) return m;
				if (isString(v)) {
					return JSON.stringify(v);
				}
				else {
					return v.origin;
				}
			});
		}
	}

	return content;
};

const setDefaultPragmaticsConfig = config => {
	config = config || {};

	if (!isArray(config.blockQuotations)) config.blockQuotations = [];
	if (config.blockQuotations.length === 0) config.blockQuotations.push(...Pragmatics.defaultConfig.blockQuotations);
	if (!isArray(config.blockSetting)) config.blockSetting = {};
	if (!isArray(config.blockSetting.condition)) config.blockSetting.condition = [];
	if (config.blockSetting.condition.length === 0) config.blockSetting.condition.push(...Pragmatics.defaultConfig.blockSetting.condition);
	if (!isArray(config.blockSetting.recurrence)) config.blockSetting.recurrence = [];
	if (config.blockSetting.recurrence.length === 0) config.blockSetting.recurrence.push(...Pragmatics.defaultConfig.blockSetting.recurrence);
	if (!isArray(config.blockSetting.function)) config.blockSetting.function = [];
	if (config.blockSetting.function.length === 0) config.blockSetting.function.push(...Pragmatics.defaultConfig.blockSetting.function);
	if (!isArray(config.blockSetting.disclaimer)) config.blockSetting.disclaimer = [];
	if (config.blockSetting.disclaimer.length === 0) config.blockSetting.disclaimer.push(...Pragmatics.defaultConfig.blockSetting.disclaimer);

	return config;
};
const cutStringByWords = (str, ...cuts) => {
	let low = str.toLowerCase(), last = 0;
	let tag = "head";
	let result = {};
	for (let cut of cuts) {
		cut = ' ' + cut.toLowerCase().trim() + ' ';
		let pos = low.indexOf(cut, last);
		if (pos < 0) continue;
		let part = str.substring(last, pos);
		result[tag] = part.trim();
		tag = cut.trim();
		last = pos + cut.length;
	}
	result[tag] = str.substr(last).trim();
	return result;
};
const findBlock = (line, blockSetting) => {
	let lowcase = line.toLowerCase();
	let current;
	blockSetting.condition.some(cond => {
		if (lowcase.indexOf(cond.start) === 0) {
			current = {
				type: "condition",
				block: cond,
				condition: line.substr(cond.start.length + 1).trim(),
				sequence: [],
				branch: [],
			};
			return true;
		}
	});
	if (!!current) return current;

	blockSetting.recurrence.some(cond => {
		if (lowcase.indexOf(cond.start) === 0) {
			let inner = line.substr(cond.start.length + 1).trim();
			lowcase = inner.toLowerCase();
			let inPos = lowcase.indexOf(' in ');
			if (inPos >= 0) {
				let params = cutStringByWords(inner, 'in');
				current = {
					type: "range",
					loop: cond.start,
					block: cond,
					item: (params.head || '').trim(),
					range: (params.in || '').trim(),
					sequence: [],
				};
			}
			else {
				let params = cutStringByWords(inner, 'from', 'to', 'step');
				current = {
					type: "loop",
					loop: cond.start,
					block: cond,
					item: params.head,
					from: params.from,
					to: params.to,
					step: params.step || "1",
					sequence: [],
				};
			}
			return true;
		}
	});
	if (!!current) return current;

	blockSetting.function.some(cond => {
		if (lowcase.indexOf(cond.start) === 0) {
			let inner = line.substr(cond.start.length + 1).trim();
			let params = inner.split('(');
			let name = params[0].trim();
			if (!params[1]) {
				params = null;
			}
			else {
				inner = params[1].replace(/\)$/, '').trim();
				params = inner.split(',').map(item => item.trim());
			}
			current = {
				type: "function",
				block: cond,
				name, params,
				sequence: [],
				list: null,
				tail: null,
			};
			return true;
		}
	});
	if (!!current) return current;

	blockSetting.disclaimer.some(cond => {
		if (lowcase.indexOf(cond) === 0) {
			let inner = line.substr(cond.length + 1).trim();
			let params = [], sequence = [];
			inner = inner.split(',').forEach(item => {
				item = item.trim();
				let line = item;
				item = item.split('=');
				params.push(item[0].trim());
				item = (item[1] || '').trim();
				if (!!item) sequence.push(line);
			});
			current = {
				type: "disclaimer",
				params,
				sequence,
			};
			return true;
		}
	});
	if (!!current) return current;
};

globalThis.Pragmatics = {};
Pragmatics.defaultConfig = {
	blockQuotations: [
		['\`\`\`', '\`\`\`'],
		['\`', '\`'],
	],
	blockSetting: {
		condition: [{
			start: 'if',
			other: "else if",
			default: "else",
			finish: "end if",
		}],
		recurrence: [{
			start: 'for',
			finish: "end for",
		}, {
			start: 'all',
			finish: "end all",
		}, {
			start: 'any',
			finish: "end any",
		}],
		function: [{
			start: 'sub',
			finish: "end sub",
			tail: "defer",
		}],
		disclaimer: ['dim'],
	},
};
Pragmatics.parse = (content, config, elements) => {
	if (!content) return content;
	content = content.replace(/\\\*[\w\W]*?\*\\/g, '');
	content = content.replace(/\/\/[^\n\r]*?\n/g, '\n');

	config = setDefaultPragmaticsConfig(config);
	elements = elements || {};

	const memory = {};
	memory.this = memory;

	// Replace all the special placeholder strings
	content = content.replace(RegGlobalPlaceHolder, (m) => {
		if (!!elements[m]) return m;

		let tag = "[str:" + Object.keys(elements).length + ']';
		elements[tag] = m;

		return tag;
	});
	// Find out all the strings
	content = extractStrings(content, config.blockQuotations, elements);
	// Split into lines
	content = content.replace(/\r*\n\r*|\r+/g, '\n').split('\n');

	const result = [];
	let stack = [];
	content.forEach(line => {
		line = line.trim();
		line = line.replace(/Fire /g, 'Sparks.');
		let lowcase = line.toLowerCase();

		let current = findBlock(line, config.blockSetting);
		if (!!current) {
			if (!current.block) {
				let cur = stack[0];
				if (!cur) {
					cur = {sequence: result};
				}
				cur.sequence.push(current);
				if (current.sequence.length > 0) {
					cur.sequence.push(...current.sequence);
				}
				delete current.sequence;
			}
			else {
				stack.unshift(current);
			}
		}
		else {
			current = stack[0];
			if (!current) {
				if (!!line) result.push(line);
			}
			else if (lowcase.indexOf(current.block.finish) === 0) {
				delete current.block;
				if (current.type === 'condition') {
					current.branch.push({
						condition: current.condition,
						sequence: current.sequence,
					});
					delete current.condition;
					delete current.sequence;
				}
				else if (current.type === 'function') {
					if (current.list !== null) {
						current.tail = [...current.sequence];
						current.sequence = [...current.list];
					}
					delete current.list;
				}
				stack.shift();
				let next = stack[0];
				if (!next) {
					result.push(current);
				}
				else {
					next.sequence.push(current);
				}
			}
			else if (current.type === 'condition') {
				if (lowcase.indexOf(current.block.other) === 0) {
					current.branch.push({
						condition: current.condition,
						sequence: current.sequence,
					});
					let cond = line.substring(current.block.other.length).trim();
					current.condition = cond;
					current.sequence = [];
				}
				else if (lowcase.indexOf(current.block.default) === 0) {
					current.branch.push({
						condition: current.condition,
						sequence: current.sequence,
					});
					current.condition = null;
					current.sequence = [];
				}
				else {
					current.sequence.push(line);
				}
			}
			else if (current.type === 'function') {
				if (lowcase.indexOf(current.block.tail) === 0) {
					current.list = [...current.sequence];
					current.sequence = [];
				}
				else {
					current.sequence.push(line);
				}
			}
			else {
				current.sequence.push(line);
			}
		}
	});

	return result;
};
Pragmatics.execute = async (content, environment, config, elements) => {
	config = setDefaultPragmaticsConfig(config);
	elements = elements || {};
	if (isString(content)) content = Pragmatics.parse(content, config, elements);
	const memory = constructMemory({}, environment, "Pragmatics.execute");

	const execute = async (sequence, memory) => {
		let pipeline = {};
		let result = {
			result: undefined,
			action: null,
		};
		for (let line of sequence) {
			if (line.type === 'disclaimer') {
				line.params.forEach(name => {
					let target = memory.__blueprint__;
					if (!!target) {
						target[name] = null;
					}
					else {
						memory[name] = null;
					}
				});
			}
			else if (line.type === 'condition') {
				let shouldOut = false;
				for (let branch of line.branch) {
					let available = false;
					if (!!branch.condition) {
						available = Syntax.execute(branch.condition, memory, config, elements);
					}
					else {
						available = true;
					}
					if (!!available) {
						let localMemory = constructMemory({}, memory, 'Pragmatics.execute->execute->condition');
						result = await execute(branch.sequence, localMemory);
						if (['return', 'break', 'continue'].includes(result.action)) {
							shouldOut = true;
						}
						break;
					}
				}
				if (shouldOut) break;
			}
			else if (line.type === 'range') {
				let range = Syntax.execute(line.range, memory, config, elements);
				if (line.loop === 'for') {
					let localMemory = constructMemory({}, memory, 'Pragmatics.execute->execute->range->for');
					let shouldOut = false;
					if (isArray(range)) {
						for (let item of range) {
							localMemory.__blueprint__[line.item] = item;
							result = await execute(line.sequence, localMemory);
							if (result.action === 'return') {
								shouldOut = true;
								break;
							}
							else if (result.action === 'break') {
								result.action = null;
								break;
							}
							else if (result.action === 'continue') {
								result.action = null;
								continue;
							}
						}
					}
					else if (isObject(range)) {
						for (let key in range) {
							let item = range[key];
							localMemory.__blueprint__[line.item] = item;
							result = await execute(line.sequence, localMemory);
							if (result.action === 'return') {
								shouldOut = true;
								break;
							}
							else if (result.action === 'break') {
								result.action = null;
								break;
							}
							else if (result.action === 'continue') {
								result.action = null;
								continue;
							}
						}
					}
					if (shouldOut) {
						break;
					}
				}
				else {
					if (line.loop === 'all') {
						await Promise.all(range.map(async item => {
							let localMemory = constructMemory({}, memory, 'Pragmatics.execute->execute->range->all');
							localMemory.__blueprint__[line.item] = item;
							await execute(line.sequence, localMemory);
						}));
					}
					else if (line.loop === 'any') {
						await Promise.any(range.map(async item => {
							let localMemory = constructMemory({}, memory, 'Pragmatics.execute->execute->range->any');
							localMemory.__blueprint__[line.item] = item;
							await execute(line.sequence, localMemory);
						}));
					}
				}
			}
			else if (line.type === 'loop') {
				let from = Syntax.execute(line.from, memory, config, elements) * 1, to = Syntax.execute(line.to, memory, config, elements) * 1, step = Syntax.execute(line.step, memory, config, elements) * 1;
				if (!isNaN(from) && !isNaN(to) && from !== to) {
					if (isNaN(step)) step = 1;
					if (from < to === step < 0) {
						step *= -1;
					}
					if (line.loop === 'for') {
						let localMemory = constructMemory({}, memory, 'Pragmatics.execute->execute->loop->for');
						let shouldOut = false;
						for (let i = from; from < to ? i <= to : i >= to; i += step) {
							localMemory.__blueprint__[line.item] = i;
							result = await execute(line.sequence, localMemory);
							if (result.action === 'return') {
								shouldOut = true;
								break;
							}
							else if (result.action === 'break') {
								result.action = null;
								break;
							}
							else if (result.action === 'continue') {
								result.action = null;
								continue;
							}
						}
						if (shouldOut) {
							break;
						}
					}
					else {
						let range = [];
						for (let i = from; from < to ? i <= to : i >= to; i += step) {
							range.push(i);
						}
						if (line.loop === 'all') {
							await Promise.all(range.map(async i => {
								let localMemory = constructMemory({}, memory, 'Pragmatics.execute->execute->loop->all');
								localMemory.__blueprint__[line.item] = i;
								await execute(line.sequence, localMemory);
							}));
						}
						else if (line.loop === 'any') {
							await Promise.any(range.map(async i => {
								let localMemory = constructMemory({}, memory, 'Pragmatics.execute->execute->loop->any');
								localMemory.__blueprint__[line.item] = i;
								await execute(line.sequence, localMemory);
							}));
						}
					}
				}
			}
			else if (line.type === 'function') {
				memory[line.name] = async (...args) => {
					let localMemory = constructMemory({}, memory, 'Pragmatics.execute->execute->function:' + line.name);
					if (!!line.params) {
						line.params.forEach((varName, i) => {
							localMemory[varName] = args[i];
						});
					}
					let result = await execute(line.sequence, localMemory);
					if (isArray(line.tail)) {
						await execute(line.tail, localMemory);
					}
					return result.result;
				};
			}
			else if (line.match(/^\s*(rem\s+|\/\/)/i)) {
				continue;
			}
			else if (line.match(/^\s*return\s+|^\s*return\s*$/i)) {
				let part = line.replace(/^\s*return\s+/i, '').trim();
				result.result = await Syntax.executeAndWait(part, memory, config, elements);
				result.action = 'return';
				break;
			}
			else if (line.match(/^\s*break\s+|^\s*break\s*$/i)) {
				result.action = 'break';
				break;
			}
			else if (line.match(/^\s*continue\s+|^\s*continue\s*$/i)) {
				result.action = 'continue';
				break;
			}
			else if (line.match(/^\s*dependent\s+/i)) {
				let inner = line.replace(/^\s*dependent\s+/i, '');
				let params = cutStringByWords(inner, 'on');
				let afters = params.head.split(',').map(item => item.trim());
				let dependence = params.on.split(',').map(item => item.trim());
				afters.forEach(item => {
					let part = pipeline[item];
					if (!part) {
						part = {
							dependence: [],
							done: false,
							offspring: [],
						};
						pipeline[item] = part;
					}
					dependence.forEach(dep => {
						if (part.dependence.includes(dep)) return;
						part.dependence.push(dep);
						let dp = pipeline[dep];
						if (!dp) {
							dp = {
								dependence: [],
								done: false,
								offspring: [],
							};
							pipeline[dep] = dp;
						}
						if (dp.offspring.includes(item)) return;
						dp.offspring.push(item);
					});
				});
				dependence.forEach(dep => {
					let dp = pipeline[dep];
					if (!!dp) return;
					dp = {
						dependence: [],
						done: false,
						offspring: [],
					};
					pipeline[dep] = dp;
				});
			}
			else if (line.match(/^\s*start\s*$/i)) {
				let starts = [];
				for (let itemName in pipeline) {
					let item = pipeline[itemName];
					item.done = false;
					if (item.dependence.length === 0) starts.push(itemName);
				}

				const invokeProcess = async (task) => {
					let fun = memory[task];
					if (isFunction(fun)) {
						try {
							let r = await fun();
							if (r !== undefined) result.result = r;
						} catch {}
					}
					let pl = pipeline[task];
					pl.done = true;
					let allDone = true;
					pl.offspring.forEach(off => {
						let ql = pipeline[off];
						if (ql.done) return;
						allDone = false;
						let available = true;
						ql.dependence.some(dep => {
							if (pipeline[dep].done) return;
							available = false;
							return true;
						});
						if (!available) return;
						invokeProcess(off);
					});
					if (!allDone) return;
					for (let taskName in pipeline) {
						let task = pipeline[taskName];
						if (task.done) continue;
						allDone = false;
					}
					if (!allDone) return;
					lock();
				};

				let lock;
				const waitHere = () => new Promise(res => lock = res);

				if (starts.length > 0) {
					wait().then(() => {
						starts.forEach(task => invokeProcess(task));
					});
					await waitHere();
				}
			}
			else {
				result.result = await Syntax.executeAndWait(line, memory, config, elements);
			}
		}
		return result;
	};
	let result = await execute(content, memory);
	return result.result;
};