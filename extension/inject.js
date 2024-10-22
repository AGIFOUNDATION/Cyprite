const CypriteEventHandler = {};

const sendMessageToCyprite = (event, data, target, tid) => {
	window.postMessage({
		extension: "CypriteTheCyberButler",
		type: "P2F",
		data: {event, data, target, tid, sender: "PageEnd"}
	});
};
window.addEventListener('message', ({data}) => {
	var extension = data.extension, type = data.type;
	if (extension !== 'CypriteTheCyberButler') return;
	if (type !== 'F2P') return;

	var msg = data.data;
	var handler = CypriteEventHandler[msg.event];
	if (!handler) return;
	handler(msg.data, msg.sender || 'FrontEnd', msg.sid);
});

CypriteEventHandler.insertJS = (data) => {
	data.forEach(url => {
		var ele = document.createElement('script');
		ele.src = url;
		ele.onload = () => {
			console.log('Load JS: ' + url);
		};
		ele.onerror = (err) => {
			console.log('Load JS (' + url + ') Failed: ' + (err.message || err.msg || err.data || err));
		};
		document.head.appendChild(ele);
	});
};
CypriteEventHandler.insertCSS = (data) => {
	data.forEach(url => {
		var ele = document.createElement('link');
		ele.crossOrigin = "anonymous";
		ele.rel = 'stylesheet';
		ele.href = url;
		ele.onload = () => {
			console.log('Load CSS: ' + url);
		};
		document.head.appendChild(ele);
	});
};