const DB_NAME = 'english-anki';
const DB_VERSION = 1;
const KV_STORE = 'kv';
const BACKUP_STORE = 'backups';

let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(KV_STORE)) db.createObjectStore(KV_STORE);
        if (!db.objectStoreNames.contains(BACKUP_STORE)) db.createObjectStore(BACKUP_STORE, { keyPath: 'name' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('indexeddb-open-failed'));
      request.onblocked = () => reject(new Error('indexeddb-blocked'));
    }).catch(error => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

function requestDone(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('indexeddb-request-failed'));
  });
}

async function withStore(storeName, mode, work) {
  const db = await openDb();
  const store = db.transaction(storeName, mode).objectStore(storeName);
  return work(store);
}

export async function getKv(key) {
  try {
    return await withStore(KV_STORE, 'readonly', store => requestDone(store.get(key)));
  } catch {
    return undefined;
  }
}

export async function setKv(key, value) {
  await withStore(KV_STORE, 'readwrite', store => requestDone(store.put(value, key)));
}

export async function deleteKv(key) {
  await withStore(KV_STORE, 'readwrite', store => requestDone(store.delete(key)));
}

export async function putBackup(record) {
  await withStore(BACKUP_STORE, 'readwrite', store => requestDone(store.put(record)));
}

export async function getBackup(name) {
  try {
    return await withStore(BACKUP_STORE, 'readonly', store => requestDone(store.get(name)));
  } catch {
    return undefined;
  }
}

export async function listBackupRecords() {
  try {
    return (await withStore(BACKUP_STORE, 'readonly', store => requestDone(store.getAll()))) || [];
  } catch {
    return [];
  }
}

export async function deleteBackup(name) {
  await withStore(BACKUP_STORE, 'readwrite', store => requestDone(store.delete(name)));
}