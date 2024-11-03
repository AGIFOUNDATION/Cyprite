const AnimationDuration = 500;
const AvailableTypes = ['message', 'success', 'fail', 'warn', 'error', 'fetal'];
const AvailablePositions = ['leftBottom', 'leftCenter', 'leftTop', 'middleBottom', 'middleCenter', 'middleTop', 'rightBottom', 'rightCenter', 'rightTop'];
const DefaultDurations = {
	"error": 10 * 1000,
	"fail": 10 * 1000,
	"warn": 7.5 * 1000,
	"message": 5 * 1000,
	"success": 3 * 1000,
	'fetal': 15 * 1000,
};

const newNotification = (title, message, duration=3000, type, position) => {
	if (!title && !message) return;

	if (!AvailableTypes.includes(type)) type = AvailableTypes[0];
	if (!AvailablePositions.includes(position)) position = AvailablePositions[0];

	var timer;
	var timeStart, timeLeft = duration;
	var pauseTimer = () => {
		if (notify._closed) return;
		if (!timer) return;
		clearTimeout(timer);
		var now = Date.now();
		var used = now - timeStart;
		timeLeft -= used;
	};
	var resumeTimer = () => {
		if (notify._closed) return;
		if (!!timer) {
			clearTimeout(timer);
		}
		// if (timeLeft <= 0) return;
		if (timeLeft <= 0) timeLeft = 0;
		timeStart = Date.now();
		timer = setTimeout(notify._hide, timeLeft);
	};

	var notify = newEle('div', 'extension_component', 'notification', type, position);
	notify._type = type;
	notify._position = position;
	notify._closed = false;
	notify.onready = null;
	notify.onshow = null;
	notify.onhide = null;
	notify.onclose = null;
	notify._onready = null;
	notify._onshow = null;
	notify._onhide = null;
	notify._onclose = null;
	notify._show = async () => {
		await wait(50);
		if (!!notify._onready) notify._onready();
		if (!!notify.onready) notify.onready();
		notify.classList.add('show');
		await wait(AnimationDuration);
		if (!!notify._onshow) notify._onshow();
		if (!!notify.onshow) notify.onshow();

		resumeTimer();
	};
	notify._hide = async () => {
		if (notify._closed) return;
		notify._closed = true;

		if (!!timer) {
			clearTimeout(timer);
			timer = null;
		}

		notify.classList.remove('show');
		if (!!notify._onhide) notify._onhide();
		if (!!notify.onhide) notify.onhide();
		await wait(AnimationDuration);

		notify.removeEventListener('mouseenter', pauseTimer);
		notify.removeEventListener('mousemove', pauseTimer);
		notify.removeEventListener('mouseout', resumeTimer);
		closer.removeEventListener('click', notify._hide);

		if (!!notify._onclose) notify._onclose();
		if (!!notify.onclose) notify.onclose();
	};
	notify.addEventListener('mouseenter', pauseTimer);
	notify.addEventListener('mousemove', pauseTimer);
	notify.addEventListener('mouseout', resumeTimer);

	var frame = newEle('div', 'notification_frame');
	notify.appendChild(frame);
	notify._frame = frame;

	var inner = newEle('div', 'notification_inner');
	frame.appendChild(inner);
	notify._inner = inner;

	if (!!title) {
		let titleBar = newEle('div', 'notification_title');
		titleBar.innerText = title;
		inner.appendChild(titleBar);
	}
	else {
		inner.classList.add('no_title');
	}
	if (!!message) {
		let messageBar = newEle('div', 'notification_message');
		if (message.match(/<\/[\w\-]+>/)) {
			messageBar.innerHTML = message;
		}
		else {
			messageBar.innerText = message;
		}
		inner.appendChild(messageBar);
	}

	var closer = newEle('div', 'notification_close');
	try {
		closer.innerHTML = '<img src="' + chrome.runtime.getURL('/images/xmark.svg') + '">';
	}
	catch (err) {
		logger.error('Notification', err);
		closer.innerHTML = "X";
	}
	closer.addEventListener('click', notify._hide);
	inner.appendChild(closer);

	notify._getTimeLeft = () => timeLeft;
	window.currentNotify = notify;

	return notify;
};

const MessageList = {};
AvailablePositions.forEach(pos => MessageList[pos] = []);

const topPositionUpdater = async list => {
	var totalHeight = 0;
	list.forEach(item => {
		totalHeight += item.height + 5;
	});
	list.forEach(item => {
		totalHeight -= item.height + 5;
		item.ele._inner.style.top = totalHeight + 'px';
	});
};
const bottomPositionUpdater = async list => {
	var totalHeight = 0;
	list.forEach(item => {
		totalHeight += item.height + 5;
	});
	list.forEach(item => {
		totalHeight -= item.height + 5;
		item.ele._inner.style.bottom = totalHeight + 'px';
	});
};
const centerPositionUpdater = async list => {
	var totalHeight = 0;
	list.forEach(item => {
		totalHeight += item.height + 5;
	});
	totalHeight /= 2;
	list.forEach(item => {
		totalHeight -= item.height + 5;
		item.ele._inner.style.top = totalHeight + 'px';
	});
};

globalThis.Notification = {};

Notification.init = (outside=true) => {
	var cssUrl = "/components/notification.css";
	if (outside) {
		cssUrl = chrome.runtime.getURL(cssUrl);
	}

	// Load CSS
	var tag = newEle('link');
	tag.rel = 'stylesheet';
	tag.href = cssUrl;
	document.head.appendChild(tag);
};
Notification.show = (title, message, position, type, duration) => {
	if (!document.body) return;

	if (!(duration > 0)) {
		let def = DefaultDurations[type];
		if (!!def) duration = def;
	}

	const notify = newNotification(title, message, duration, type, position);
	notify._onready = () => {
		var box = notify.getBoundingClientRect();
		var list = MessageList[notify._position];
		list.push({
			ele: notify,
			width: box.width,
			height: box.height,
		});
		if (notify._position.indexOf('Top') > 0) {
			topPositionUpdater(list);
		}
		else if (notify._position.indexOf('Bottom') > 0) {
			bottomPositionUpdater(list);
		}
		else if (notify._position.indexOf('Center') > 0) {
			centerPositionUpdater(list);
		}
	};
	notify._onhide = () => {
		var list = MessageList[notify._position];
		var idx = -1;
		list.some((item, i) => {
			if (item.ele === notify) {
				idx = i;
				return true;
			}
		});
		if (idx < 0) return;
		list.splice(idx, 1);
		if (notify._position.indexOf('Top') > 0) {
			topPositionUpdater(list);
		}
		else if (notify._position.indexOf('Bottom') > 0) {
			bottomPositionUpdater(list);
		}
		else if (notify._position.indexOf('Center') > 0) {
			centerPositionUpdater(list);
		}
	};
	notify._onclose = () => {
		document.body.removeChild(notify);
	};
	document.body.appendChild(notify);

	notify._show();
	return notify;
};