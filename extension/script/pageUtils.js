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
const getPageContent = (container, keepLink=false) => {
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
	content = clearHTML(content, true, true);
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
	content = content.trim();

	var parser = new DOMParser();
	var dom = parser.parseFromString(content, "text/html");
	content = dom.body.textContent;

	return content;
};
const parseMarkdownWithOutwardHyperlinks = (container, content, defaults) => {

	// Parse Markdown
	var parsed = marked.parse(content, {breaks: true}) || defaults || '';

	container.innerHTML = parsed;

	// Make hyperlink open page in new frame
	[...container.querySelectorAll('a')].forEach(link => {
		link.target = '_blank';
	});


	return parsed;
};
const showTokenUsage = (usage, isLeft=false) => {
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
	Notification.show('Token Usage', html, position, 'message', 5000);
};