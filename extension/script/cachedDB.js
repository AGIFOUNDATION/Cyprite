(() => {
	class CachedDB {
		constructor (name, version) {
			this._name = name;
			this._version = version;
			this.conn = null;
			this.db = null;
			this.cbUpdates = [];
			this.cbConnects = [];
			this.ready = false;
			this.available = false;
		}
		connect () {
			return new Promise((res, rej) => {
				this.conn = indexedDB.open(this.name, this.version);
				this.conn.onupgradeneeded = evt => {
					this.db = this.conn.result;
					this.cbUpdates.forEach(cb => cb(this));
				};
				this.conn.onsuccess = evt => {
					this.ready = true;
					this.available = true;
					this.db = this.conn.result;
					this.cbConnects.forEach(cb => cb(this));
					res(this);
				};
				this.conn.onerror = err => {
					this.ready = true;
					this.available = false;
					rej(err);
				};
			});
		}
		onConnect (cb) {
			this.cbConnects.push(cb);
		}
		onUpdate (cb) {
			this.cbUpdates.push(cb);
		}
		open (name, keyPath='id', indexes) {
			if (!this.db.objectStoreNames.contains(name)) {
				let store = this.db.createObjectStore(name, { keyPath });
				store.createIndex(keyPath, keyPath, { unique: true });
				if (!!indexes && indexes.length > 0) {
					indexes.forEach(idx => {
						store.createIndex(idx, idx, { unique: false });
					});
				}
			}
		}
		set (store, key, value) {
			return new Promise((res, rej) => {
				var tx = this.db.transaction([store], "readwrite");
				if (!tx) rej(new Error('Open IndexedDB Transaction Failed: ' + store));
				var cache = tx.objectStore(store);
				if (!store) rej(new Error('Open IndexedDB ObjectStore Failed: ' + store));

				var item = {};
				[...cache.indexNames].forEach(id => {
					item[id] = value[id];
				});
				item[cache.keyPath] = key;
				item.data = value;
				var result = cache.put(item);
				result.onsuccess = evt => {
					res(evt.result);
				};
				result.onerror = err => {
					rej(err);
				};
			});
		}
		get (store, key) {
			return new Promise((res, rej) => {
				var tx = this.db.transaction([store], "readonly");
				// var tx = this.db.transaction([store], "readwrite");
				if (!tx) rej(new Error('Open IndexedDB Transaction Failed: ' + store));
				var cache = tx.objectStore(store);
				if (!store) rej(new Error('Open IndexedDB ObjectStore Failed: ' + store));
				var index = cache.index(cache.keyPath);

				var result = index.get(key);
				result.onsuccess = evt => {
					if (!evt.target.result) res(undefined);
					else res(evt.target.result.data);
				};
				result.onerror = err => {
					rej(err);
				};
			});
		}
		all (store, idx) {
			return new Promise((res, rej) => {
				var tx = this.db.transaction([store], "readonly");
				// var tx = this.db.transaction([store], "readwrite");
				if (!tx) rej(new Error('Open IndexedDB Transaction Failed: ' + store));
				var cache = tx.objectStore(store);
				if (!store) rej(new Error('Open IndexedDB ObjectStore Failed: ' + store));
				var index;
				try {
					index = cache.index(idx || cache.keyPath);
				}
				catch (err) {
					rej(err);
					return;
				}

				var result = index.getAll();
				result.onsuccess = evt => {
					var list = evt.target.result;
					if (!list) return res(list);
					var isPrime = !idx || (idx === cache.keyPath);
					var result = isPrime ? {} : [];
					list.forEach(item => {
						if (isPrime) result[item[cache.keyPath]] = item.data;
						else result.push(item.data);
					});
					res(result);
				};
				result.onerror = err => {
					rej(err);
				};
			});
		}
		del (store, key) {
			return new Promise((res, rej) => {
				var tx = this.db.transaction([store], "readwrite");
				if (!tx) rej(new Error('Open IndexedDB Transaction Failed: ' + store));
				var cache = tx.objectStore(store);
				if (!store) rej(new Error('Open IndexedDB ObjectStore Failed: ' + store));

				var result = cache.delete(key);
				result.onsuccess = evt => {
					res(evt.result);
				};
				result.onerror = err => {
					rej(err);
				};
			});
		}
		clear (store) {
			return new Promise((res, rej) => {
				var tx = this.db.transaction([store], "readwrite");
				if (!tx) rej(new Error('Open IndexedDB Transaction Failed: ' + store));
				var cache = tx.objectStore(store);
				if (!store) rej(new Error('Open IndexedDB ObjectStore Failed: ' + store));

				var result = cache.clear();
				result.onsuccess = evt => {
					res(evt.result);
				};
				result.onerror = err => {
					rej(err);
				};
			});
		}

		get name () {
			return this._name;
		}
		get version () {
			return this._version;
		}
	}

	globalThis.CachedDB = CachedDB;
}) ();