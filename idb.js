const DB_NAME = "promptpin_db";
const DB_VERSION = 2; // <-- IMPORTANTE: subimos versión para crear el store nuevo

const PINS_STORE = "pins";
const PRESETS_STORE = "presets";

export async function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;

      // Pins store (existing)
      if (!db.objectStoreNames.contains(PINS_STORE)) {
        const store = db.createObjectStore(PINS_STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      }

      // Presets store (new)
      if (!db.objectStoreNames.contains(PRESETS_STORE)) {
        const store = db.createObjectStore(PRESETS_STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// -------------------- PINS --------------------

export async function listPins() {
  const db = await openDB();
  const tx = db.transaction(PINS_STORE, "readonly");
  const store = tx.objectStore(PINS_STORE);

  const req = store.getAll();
  const data = await new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });

  await txDone(tx);
  db.close();

  // newest first
  data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return data;
}

export async function getPin(id) {
  const db = await openDB();
  const tx = db.transaction(PINS_STORE, "readonly");
  const store = tx.objectStore(PINS_STORE);

  const req = store.get(id);
  const item = await new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });

  await txDone(tx);
  db.close();
  return item;
}

export async function upsertPin(pin) {
  const db = await openDB();
  const tx = db.transaction(PINS_STORE, "readwrite");
  const store = tx.objectStore(PINS_STORE);

  store.put(pin);

  await txDone(tx);
  db.close();
  return pin;
}

export async function deletePin(id) {
  const db = await openDB();
  const tx = db.transaction(PINS_STORE, "readwrite");
  const store = tx.objectStore(PINS_STORE);

  store.delete(id);

  await txDone(tx);
  db.close();
}

// -------------------- PRESETS --------------------

export async function listPresets() {
  const db = await openDB();
  const tx = db.transaction(PRESETS_STORE, "readonly");
  const store = tx.objectStore(PRESETS_STORE);

  const req = store.getAll();
  const data = await new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });

  await txDone(tx);
  db.close();

  // newest first
  data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return data;
}

export async function getPreset(id) {
  const db = await openDB();
  const tx = db.transaction(PRESETS_STORE, "readonly");
  const store = tx.objectStore(PRESETS_STORE);

  const req = store.get(id);
  const item = await new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });

  await txDone(tx);
  db.close();
  return item;
}

export async function upsertPreset(preset) {
  const db = await openDB();
  const tx = db.transaction(PRESETS_STORE, "readwrite");
  const store = tx.objectStore(PRESETS_STORE);

  store.put(preset);

  await txDone(tx);
  db.close();
  return preset;
}

export async function deletePreset(id) {
  const db = await openDB();
  const tx = db.transaction(PRESETS_STORE, "readwrite");
  const store = tx.objectStore(PRESETS_STORE);

  store.delete(id);

  await txDone(tx);
  db.close();
}

