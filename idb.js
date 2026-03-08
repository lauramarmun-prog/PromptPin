const DB_NAME = "promptpin_db";
const DB_VERSION = 2;

const PINS_STORE = "pins";
const PRESETS_STORE = "presets";
const LS_PREFIX = "promptpin_fallback_";

let storageModePromise = null;

function hasIndexedDB() {
  return typeof indexedDB !== "undefined";
}

function hasLocalStorage() {
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
}

function fallbackKey(storeName) {
  return `${LS_PREFIX}${storeName}`;
}

async function blobToDataURL(blob) {
  if (!blob) return "";

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Could not read blob"));
    reader.readAsDataURL(blob);
  });
}

function dataURLToBlob(dataURL) {
  if (!dataURL) return null;

  const parts = String(dataURL).split(",");
  if (parts.length < 2) return null;

  const mimeMatch = parts[0].match(/data:(.*?);base64/);
  const mime = mimeMatch?.[1] || "application/octet-stream";
  const binary = atob(parts[1]);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new Blob([bytes], { type: mime });
}

async function serializeRecord(item) {
  if (!item) return item;

  const out = { ...item };
  if (item.imageBlob) {
    out.imageBlobDataUrl = await blobToDataURL(item.imageBlob);
    delete out.imageBlob;
  }
  return out;
}

function deserializeRecord(item) {
  if (!item) return item;

  const out = { ...item };
  if (item.imageBlobDataUrl) {
    out.imageBlob = dataURLToBlob(item.imageBlobDataUrl);
    delete out.imageBlobDataUrl;
  }
  return out;
}

function readFallbackStore(storeName) {
  if (!hasLocalStorage()) return [];

  try {
    const raw = localStorage.getItem(fallbackKey(storeName));
    const items = raw ? JSON.parse(raw) : [];
    return Array.isArray(items) ? items.map(deserializeRecord) : [];
  } catch {
    return [];
  }
}

async function writeFallbackStore(storeName, items) {
  if (!hasLocalStorage()) {
    throw new Error("Local storage is unavailable in this environment.");
  }

  const serialized = [];
  for (const item of items) {
    serialized.push(await serializeRecord(item));
  }
  localStorage.setItem(fallbackKey(storeName), JSON.stringify(serialized));
}

async function ensureStorageMode() {
  if (!storageModePromise) {
    storageModePromise = (async () => {
      if (!hasIndexedDB()) return "fallback";

      try {
        const db = await openDB();
        db.close();
        return "indexeddb";
      } catch {
        return "fallback";
      }
    })();
  }

  return storageModePromise;
}

export async function openDB() {
  if (!hasIndexedDB()) {
    throw new Error("IndexedDB is unavailable in this environment.");
  }

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;

      if (!db.objectStoreNames.contains(PINS_STORE)) {
        const store = db.createObjectStore(PINS_STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      }

      if (!db.objectStoreNames.contains(PRESETS_STORE)) {
        const store = db.createObjectStore(PRESETS_STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Could not open IndexedDB."));
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("IndexedDB transaction failed."));
    tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted."));
  });
}

async function listRecords(storeName) {
  const mode = await ensureStorageMode();
  if (mode === "fallback") {
    const data = readFallbackStore(storeName);
    data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return data;
  }

  const db = await openDB();
  const tx = db.transaction(storeName, "readonly");
  const store = tx.objectStore(storeName);

  const req = store.getAll();
  const data = await new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });

  await txDone(tx);
  db.close();

  data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return data;
}

async function getRecord(storeName, id) {
  const mode = await ensureStorageMode();
  if (mode === "fallback") {
    return readFallbackStore(storeName).find((item) => item.id === id) || null;
  }

  const db = await openDB();
  const tx = db.transaction(storeName, "readonly");
  const store = tx.objectStore(storeName);

  const req = store.get(id);
  const item = await new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });

  await txDone(tx);
  db.close();
  return item;
}

async function upsertRecord(storeName, item) {
  const mode = await ensureStorageMode();
  if (mode === "fallback") {
    const items = readFallbackStore(storeName);
    const index = items.findIndex((entry) => entry.id === item.id);
    if (index >= 0) items[index] = item;
    else items.push(item);
    await writeFallbackStore(storeName, items);
    return item;
  }

  const db = await openDB();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  store.put(item);
  await txDone(tx);
  db.close();
  return item;
}

async function deleteRecord(storeName, id) {
  const mode = await ensureStorageMode();
  if (mode === "fallback") {
    const items = readFallbackStore(storeName).filter((item) => item.id !== id);
    await writeFallbackStore(storeName, items);
    return;
  }

  const db = await openDB();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  store.delete(id);
  await txDone(tx);
  db.close();
}

export async function listPins() {
  return listRecords(PINS_STORE);
}

export async function getPin(id) {
  return getRecord(PINS_STORE, id);
}

export async function upsertPin(pin) {
  return upsertRecord(PINS_STORE, pin);
}

export async function deletePin(id) {
  return deleteRecord(PINS_STORE, id);
}

export async function listPresets() {
  return listRecords(PRESETS_STORE);
}

export async function getPreset(id) {
  return getRecord(PRESETS_STORE, id);
}

export async function upsertPreset(preset) {
  return upsertRecord(PRESETS_STORE, preset);
}

export async function deletePreset(id) {
  return deleteRecord(PRESETS_STORE, id);
}
