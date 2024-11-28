/* Common Web Utils */

const clearHTML = (html, full=true, markList=false) => {
	var container = document.createElement('container');
	container.innerHTML = html;

	[...container.querySelectorAll('.cyprite, .extension_component')].forEach(item => {
		item.parentNode.removeChild(item);
	});
	if (full) {
		[...container.querySelectorAll('form, select, button, textarea, input, object, script, style, nostyle, noscript, link, video, audio')].forEach(item => {
			item.parentNode.removeChild(item);
		});
	}
	[...container.querySelectorAll('*')].forEach(item => {
		[...item.attributes].forEach(attr => {
			attr = attr.name;
			if (markList) {
				if (attr === 'href') return;
				if (attr === 'src') return;
			}
			item.removeAttribute(attr);
		});
	});

	if (markList) {
		[...container.querySelectorAll('ul > li')].forEach(li => {
			li.setAttribute('mark', '-');
		});
		[...container.querySelectorAll('ol > li')].forEach((li, i) => {
			li.setAttribute('mark', (i + 1) + '.');
		});
	}

	html = container.innerHTML;
	html = html.replace(/<!\-\-[\w\W]*?\-\->/gi, '');
	html = html.split(/\s*\n\s*/);
	html = html.map(line => line.trim()).filter(line => !!line);
	html = html.join('');

	var temp;
	while (html !== temp) {
		temp = html;
		html = html.replace(/([\w\d\-])>\s+<(\/?[\w\d\-])/gi, (m, a, b) => a + '><' + b);
	}

	return html.trim();
};
const parseMarkdownWithOutwardHyperlinks = (container, content, defaults) => {
	const FONTAWESOMEROOT = "https://site-assets.fontawesome.com/releases/v6.7.1/svgs/";
	// const FONTAWESOMEROOT = "https://site-assets.fontawesome.com/releases/v6.6.0/svgs/";
	// const FONTAWESOMEROOT = "https://site-assets.fontawesome.com/releases/v5.15.4/svgs/";

	// MathJax
	var mathList = [];
	if (!!globalThis.MathJax) {
		content = ('\n' + content + '\n').replace(/\n\r*\s*\$\$\s*\r*\n?\r*([\w\W]*?)\r*\n?\r*\s*\$\$\s*\r*\n/g, (m, inner) => {
			inner = inner.replace(/\r+/g, '\n').split('\n').filter(line => !!line).join('\n');
			var idx = mathList.length;
			mathList.push(inner);
			return '\n\n[MathBlock:' + idx + ']\n\n';
		}).trim();
		content = ('\n' + content + '\n').replace(/\n\r*\s*\\\[\s*\r*\n\r*([\w\W]*?)\r*\n\r*\s*\\\]\s*\r*\n/g, (m, inner) => {
			inner = inner.replace(/\r+/g, '\n').split('\n').filter(line => !!line).join('\n');
			var idx = mathList.length;
			mathList.push(inner);
			return '\n[MathBlock:' + idx + ']\n';
		}).trim();
		content = content.replace(/\$([^\n\r\$]+?)\$/g, (m, inner) => {
			var idx = mathList.length;
			mathList.push(inner);
			return '[InlineMath:' + idx + ']';
		}).trim();
	}

	// Parse FontAwesome
	content = content.replace(/:fa([rsb])\.([\w\-]+):/gi, (m, type, icon) => {
		type = (type || '').toLowerCase();
		if (type === 'r') {
			type = 'regular';
		}
		else if (type === 's') {
			type = 'solid';
		}
		else {
			type = 'brands';
		}
		const url = FONTAWESOMEROOT + type + '/' + icon + '.svg';
		return '<img class="fontawesome" src="' + url + '">'
	});
	content = content.replace(/\bfa([rsb])::([\w\-]+)\b/gi, (m, type, icon) => {
		type = (type || '').toLowerCase();
		if (type === 'r') {
			type = 'regular';
		}
		else if (type === 's') {
			type = 'solid';
		}
		else {
			type = 'brands';
		}
		const url = FONTAWESOMEROOT + type + '/' + icon + '.svg';
		return '<img class="fontawesome" src="' + url + '">'
	});
	content = content.replace(/<i class=('|")fa([rsb])( fa\-([\w\-]+))+\1\s*(><\/i>|\/>)/gi, (m, _, type) => {
		var icon = '';
		var icons = m.match(/fa-([\w\-]+)/gi);
		icons.forEach(item => {
			item = item.replace(/^fa\-/i, '');
			if (!item) return;
			if (['solid', 'regular', 'brands'].includes(item.toLowerCase())) return;
			if (item.length > icon.length) icon = item;
		});
		if (!icon) return m;

		type = (type || '').toLowerCase();
		if (type === 'r') {
			type = 'regular';
		}
		else if (type === 's') {
			type = 'solid';
		}
		else {
			type = 'brands';
		}
		const url = FONTAWESOMEROOT + type + '/' + icon + '.svg';
		return '<img class="fontawesome" src="' + url + '">'
	});
	content = content.replace(/<i class=('|")fa-(solid|regular|brands)( fa-([\w\-]+))+\1\s*(><\/i>|\/>)/gi, (m, _, type, icons) => {
		var icon = '';
		var icons = m.match(/fa-([\w\-]+)/gi);
		icons.forEach(item => {
			item = item.replace(/^fa\-/i, '');
			if (!item) return;
			if (['solid', 'regular', 'brands'].includes(item.toLowerCase())) return;
			if (item.length > icon.length) icon = item;
		});
		if (!icon) return m;

		type = (type || '').toLowerCase();
		const url = FONTAWESOMEROOT + type + '/' + icon + '.svg';
		return '<img class="fontawesome" src="' + url + '">'
	});

	// Parse Markdown
	content = marked.parse(content, {breaks: true}) || defaults || '';

	if (!!globalThis.MathJax && mathList.length > 0) {
		content = content.replace(/\[(MathBlock|InlineMath):(\d+)\]/g, (m, type, idx) => {
			idx = idx * 1;
			if (!isNumber(idx)) return m;
			var math = mathList[idx];
			if (!math) return m;
			if (type === 'MathBlock') {
				return '$$<br>' + math.replace(/\n/g, '<br>') + '<br>$$';
			}
			else {
				return '$' + math + '$'
			}
		});
	}

	container.innerHTML = content;

	// Make hyperlink open page in new frame
	[...container.querySelectorAll('a')].forEach(link => {
		link.target = '_blank';
	});

	// Parse LaTeX by MathJax
	if (!!globalThis.MathJax && mathList.length > 0) {
		MathJax.Hub.Queue(["Typeset", MathJax.Hub, container]);
	}

	// Colorize code block
	[...container.querySelectorAll('pre > code')].forEach(block => {
		const content = block.innerText;
		const lang = (block.className.match(/language-([\w\-\+_\.]+)/) || [])[1] || '';
		var isSVG = lang.trim().match(/^svg/i);
		if (!isSVG) {
			if (!!('\n' + content).match(/\n\s*(<\?xml[^\n\r]*>\s*\n\s*)?<svg/i)) {
				isSVG = true;
			}
		}


		block = block.parentNode;

		const titleBar = newEle('div', 'code_title_bar');
		const caption = newEle('span', 'code_caption');
		caption.innerText = lang;
		titleBar.appendChild(caption);
		const copyBtn = newEle('img');
		copyBtn.src = "../images/copy.svg";
		titleBar.appendChild(copyBtn);

		if (isSVG) {
			const SVG = newEle('div', 'svg');
			SVG.innerHTML = content;
			const bar = newEle('div', 'svg_bar');
			let convertBtn = newEle('img');
			convertBtn.src = "../images/retweet.svg";
			bar.appendChild(convertBtn);
			SVG.insertBefore(bar, SVG.children[0]);

			convertBtn = newEle('img');
			convertBtn.src = "../images/retweet.svg";
			convertBtn.isRetweet = true;
			titleBar.appendChild(convertBtn);
			block.parentNode.insertBefore(SVG, block);
			block.style.display = 'none';

			bar.addEventListener('click', () => {
				SVG.style.display = 'none';
				block.style.display = 'block';
			});
			titleBar.addEventListener('click', async ({target}) => {
				if (target.isRetweet) {
					SVG.style.display = 'block';
					block.style.display = 'none';
				}
				else {
					const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
					await navigator.clipboard.writeText(content);
					Notification.show('', messages.mentions.contentCopied, 'middleTop', 'success');
				}
			});
		}
		else {
			titleBar.addEventListener('click', async ({target}) => {
				const messages = I18NMessages[myInfo.lang] || I18NMessages[DefaultLang];
				await navigator.clipboard.writeText(content);
				Notification.show('', messages.mentions.contentCopied, 'middleTop', 'success');
			});
		}
		block.insertBefore(titleBar, block.children[0]);
	});

	return content;
};

const showTokenUsage = (usage, isLeft=false) => {
	if (!globalThis.myInfo) return;
	if (!myInfo.showTokenUsage) return;
	var html = '', count = 0;
	for (let key in usage) {
		count ++;
		if (!globalThis.Model2AI[key]) continue;
		let value = usage[key];
		let line = `<div class="cyprite_extension usage_item"><span class="cyprite_extension item_name">${key}</span><span class="cyprite_extension item_value">Input: ${value.input}</span><span class="cyprite_extension item_value">Output: ${value.output}</span></div>`;
		html += line;
	}
	if (count === 0) return;
	var position = isLeft ? 'leftBottom' : 'rightBottom';
	Notification.show('Token Usage', html, position, 'message');
};

const initMathJax = () => {
	if (initMathJax.initialized) return;
	initMathJax.initialized = true;
	MathJax.Hub.Config({
		extensions: ["tex2jax.js"],
		TeX: {
			extensions: ["AMSmath.js", "AMSsymbols.js", "noErrors.js", "noUndefined.js"],
			noErrors: {
				inlineDelimiters: ["$","$"],
				multiLine: true,
				style: {
					"font-size": "normal",
					"border": "1px solid black"
				}
			},
		},
		jax: ["input/TeX", "output/HTML-CSS"],
		tex2jax: {
			displayMath: [ ['$$', '$$'] ],
			inlineMath: [ ['$', '$'] ],
			skipTags: ["script", "noscript", "style", "textarea", "pre", "code"],
			processEscapes: true
		},
		"HTML-CSS": {
			availableFonts: ["STIX","TeX"],
			showMathMenu: false
		}
	});
	MathJax.Hub.Configured();
};
if (!!globalThis.MathJax) {
	initMathJax();
}