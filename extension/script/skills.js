import "./skills/search.js";

const CacheExpire = 1000 * 3600;

/* Cache Control */

globalThis.AI.getCachedInformation = async (type, name) => {
	AI.expireCachedInformation();

	var key = 'Cache:' + type + ':' + name;
	var info = await chrome.storage.session.get(key);
	if (!info) return null;
	info = info[key];
	if (!info) return null;
	if (!info.data || !info.timestamp) {
		await chrome.storage.session.remove(key);
		return null;
	}
	return info.data;
};
globalThis.AI.setCachedInformation = async (type, name, info) => {
	AI.expireCachedInformation();

	// Check if the newly entered information will cause the storage space to exceed the capacity limit.
	// If it exceeds, delete the oldest data until the new data can be stored.
	var key = 'Cache:' + type + ':' + name;
	var size = await chrome.storage.session.getBytesInUse();
	var delta = calculateByteSize(info) + calculateByteSize(key);
	delta = Math.ceil(delta * 1.2); // There is a certain difference between the actual volume and the volume calculated based on ByteSize.
	if (size + delta >= chrome.storage.session.QUOTA_BYTES) {
		let changed = await AI.clearAllExpiredCache();
		if (changed) size = await chrome.storage.session.getBytesInUse();
		if (size + delta >= chrome.storage.session.QUOTA_BYTES) {
			let cached = await chrome.storage.session.get();
			let list = [];
			for (let key in cached) {
				if (!key.match(/^Cache:/)) continue;
				let cache = cached[key];
				list.push([key, calculateByteSize(cache), cache.time]);
			}
			list.sort((a, b) => a[2] - b[2]);
			let total = size, targets = [];
			list.some(item => {
				let s = total - item[1];
				if (s < chrome.storage.session.QUOTA_BYTES) {
					return true;
				}
				total = s;
				targets.push(item[0]);
			});
			if (targets.length > 0) {
				await chrome.storage.session.remove(targets);
			}
		}
	}

	var cache = {};
	cache[key] = {
		data: info,
		timestamp: Date.now(),
	};
	await chrome.storage.session.set(cache);
};
globalThis.AI.clearAllExpiredCache = async () => {
	if (!!AI.expireCachedInformation.timer) {
		clearTimeout(AI.expireCachedInformation.timer);
	}
	delete AI.expireCachedInformation.timer;

	var info = await chrome.storage.session.get();
	var targets = [];
	for (let key in info) {
		if (!key.match(/^Cache:/)) continue;
		let cache = info[key];
		let time = cache.timestamp || 0;
		if (!cache.data || (Date.now() - time > CacheExpire)) {
			targets.push(key);
		}
	}
	if (targets.length > 0) {
		await chrome.storage.session.remove(targets);
		return true;
	}
	return false;
};
globalThis.AI.expireCachedInformation = () => {
	if (!!AI.expireCachedInformation.timer) {
		clearTimeout(AI.expireCachedInformation.timer);
	}
	AI.expireCachedInformation.timer = setTimeout(AI.clearAllExpiredCache, 1000 * 60);
};