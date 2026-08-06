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
    if (payload instanceof File && window.kingNas?.blobPutFile) {
      try {
        const saved = await window.kingNas.blobPutFile(payload, {
          key,
          kind: "blob",
          name: metadata.name || payload.name || "",
          type: metadata.type || payload.type || "application/octet-stream",
          size: payload.size || 0,
        });
        if (saved !== true) throw new Error("NAS_FILE_COPY_UNAVAILABLE");
        release(key);
        return;
      } catch (error) {
        console.warn("Direct NAS file copy failed; falling back to renderer read", error);
      }
    }
    if (window.kingNas?.blobPut) {
      try {
        const sharedRecord = payload instanceof Blob
          ? { key, kind: "blob", bytes: new Uint8Array(await payload.arrayBuffer()), name: metadata.name || payload.name || "", type: metadata.type || payload.type, size: payload.size }
          : { key, kind: "imageData", data: String(payload || ""), name: metadata.name || "", type: metadata.type || "text/plain", size: String(payload || "").length };
        const saved = await window.kingNas.blobPut(sharedRecord);
        if (saved !== true) throw new Error("NAS_BLOB_WRITE_UNAVAILABLE");
        release(key);
        return;
      } catch (error) {
        console.error("NAS blob write failed", error);
        throw error;
      }
    }
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
    if (window.kingNas?.blobGet) {
      try {
        const shared = await window.kingNas.blobGet(key);
        if (shared?.kind === "blob" && shared.bytes) {
          return { ...shared, blob: new Blob([shared.bytes], { type: shared.type || "application/octet-stream" }) };
        }
        if (shared?.kind === "imageData") return { ...shared, imageData: shared.data || "" };
      } catch (error) {
        console.warn("NAS blob read failed; using local storage", error);
      }
    }
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
    if (window.kingNas?.blobRemove) await window.kingNas.blobRemove(key).catch(() => {});
    await transaction("readwrite", (store) => store.delete(key));
  }

  async function clear() {
    releaseAll();
    if (window.kingNas?.blobClear) await window.kingNas.blobClear().catch(() => {});
    await transaction("readwrite", (store) => store.clear());
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
    clear,
    release,
    releaseAll,
    requestPersistence,
  };
})();
