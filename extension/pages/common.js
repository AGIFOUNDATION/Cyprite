const PageName = 'HomeScreen';
let currentTabId = 0;

/* I18N */

const DefaultLang = 'en';
globalThis.getMessages = (lang) => {
	lang = lang || myInfo.lang;
	const defmsg = Messages[DefaultLang];
	const tgtmsg = Messages[lang || DefaultLang] || defmsg;
	return combine(tgtmsg, defmsg);
};

/* DB */

const DBs = {};
const initDBAgents = async () => {
	const dbAgents = new CachedDB("Agents", 1);
	dbAgents.onUpdate((evt) => {
		if (evt.oldVersion === 0) {
			dbAgents.open('agents', 'id');
		}
		logger.info('DB[Agents]', 'Updated');
	});
	dbAgents.onConnect(() => {
		logger.info('DB[Agents]', 'Connected');
	});
	await dbAgents.connect();
	DBs.Agents = dbAgents;
};

/* Tools */

const combine = (sourceA, sourceB) => {
	const value = {};
	const props = [];
	Object.keys(sourceA).forEach(key => {
		if (props.includes(key)) return;
		props.push(key);
	});
	Object.keys(sourceB).forEach(key => {
		if (props.includes(key)) return;
		props.push(key);
	});
	props.forEach(prop => {
		let vA = sourceA[prop], vB = sourceB[prop];
		if (vA === undefined) {
			value[prop] = vB;
		}
		else if (isObject(vA) & isObject(vB)) {
			value[prop] = combine(vA, vB);
		}
		else {
			value[prop] = vA;
		}
	});
	return value;
};
const showPanel = (panel) => {
	let shown = document.querySelector('.panel[active="true"]');
	if (!!shown) shown.setAttribute('active', 'false');
	document.querySelector('.panel[panel="' + panel +'"]').setAttribute('active', 'true');
};

/* Init */

const initTasks = {load: false};
const checkInit = (task) => {
	initTasks[task] = true;
	let notDone = Object.values(initTasks).some(v => !v);
	if (notDone) return;
	onLoad();
};

window.addEventListener('load', () => checkInit('load'));