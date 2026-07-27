(() => {
  const DB_NAME = "studio_site_design_images";
  const DB_VERSION = 2;
  const STORE_NAME = "images";
  const objectUrls = new Map();
  let databasePromise = null;

  function open() {
    if (databasePromise) return databasePromise;
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: "key" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        databasePromise = null;
        reject(request.error);
      };
      request.onblocked = () => {
        databasePromise = null;
        reject(new Error("文件存储正在被其他页面占用，请关闭其他标签页后重试。"));
      };
    });
    return databasePromise;
  }

  async function transaction(mode, callback) {
    const database = await open();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
      let result;
      try {
        result = callback(store);
      } catch (error) {
        reject(error);
        return;
      }
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("文件存储操作被取消。"));
    });
  }

  async function put(key, payload, metadata = {}) {
    if (!key || payload == null) return;
    const record = payload instanceof Blob
      ? {
          key,
          blob: payload,
          name: metadata.name || payload.name || "",
          type: metadata.type || payload.type || "application/octet-stream",
          size: payload.size || 0,
          updatedAt: Date.now(),
        }
      : { key, imageData: payload, updatedAt: Date.now() };
    await transaction("readwrite", (store) => store.put(record));
    release(key);
  }

  async function getRecord(key) {
    if (!key) return null;
    const database = await open();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async function getUrl(key) {
    if (!key) return "";
    if (objectUrls.has(key)) return objectUrls.get(key);
    const record = await getRecord(key);
    if (!record) return "";
    if (record.blob instanceof Blob) {
      const url = URL.createObjectURL(record.blob);
      objectUrls.set(key, url);
      return url;
    }
    return record.imageData || "";
  }

  function release(key) {
    const url = objectUrls.get(key);
    if (url) URL.revokeObjectURL(url);
    objectUrls.delete(key);
  }

  function releaseAll() {
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
    objectUrls.clear();
  }

  async function remove(key) {
    if (!key) return;
    release(key);
    await transaction("readwrite", (store) => store.delete(key));
  }

  async function requestPersistence() {
    if (!navigator.storage?.persist) return false;
    try {
      return await navigator.storage.persist();
    } catch {
      return false;
    }
  }

  window.KingBlobStore = {
    open,
    put,
    getRecord,
    getUrl,
    remove,
    release,
    releaseAll,
    requestPersistence,
  };
})();
