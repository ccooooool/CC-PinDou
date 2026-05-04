import type { GridCell, ColorInfo, PerlerLayer } from '../types/perler';

const DB_NAME = 'cc-pindou-backup';
const DB_VERSION = 2;
const STORE_NAME = 'snapshots';

interface Snapshot {
  id: string;
  name: string;
  timestamp: number;
  mode: string;
  version?: string;
  gridData: GridCell[][];
  colorList: ColorInfo[];
  brand: string;
  layers?: PerlerLayer[];
  activeLayerId?: string | null;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
  return dbPromise;
}

export async function saveAutoBackup(
  mode: string,
  gridData: GridCell[][] | null,
  colorList: ColorInfo[],
  brand: string,
  layers?: PerlerLayer[],
  activeLayerId?: string | null,
): Promise<void> {
  if (!gridData) return;
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const snapshot: Snapshot = {
    id: '__auto__',
    name: '自动备份',
    timestamp: Date.now(),
    mode,
    version: '3.0',
    gridData,
    colorList,
    brand,
    layers,
    activeLayerId,
  };
  return new Promise((resolve, reject) => {
    const req = store.put(snapshot);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
}

export async function loadAutoBackup(): Promise<Snapshot | null> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  return new Promise((resolve, reject) => {
    const req = store.get('__auto__');
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result || null);
  });
}

export async function saveSnapshot(
  name: string,
  mode: string,
  gridData: GridCell[][],
  colorList: ColorInfo[],
  brand: string,
  layers?: PerlerLayer[],
  activeLayerId?: string | null,
): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const snapshot: Snapshot = {
    id: `snap_${Date.now()}`,
    name,
    timestamp: Date.now(),
    mode,
    version: '3.0',
    gridData,
    colorList,
    brand,
    layers,
    activeLayerId,
  };
  return new Promise((resolve, reject) => {
    const req = store.put(snapshot);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
}

export async function listSnapshots(): Promise<Array<{ id: string; name: string; timestamp: number }>> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const results = (req.result as Snapshot[])
        .filter((s) => s.id !== '__auto__')
        .map((s) => ({ id: s.id, name: s.name, timestamp: s.timestamp }))
        .sort((a, b) => b.timestamp - a.timestamp);
      resolve(results);
    };
  });
}

export async function loadSnapshot(id: string): Promise<Snapshot | null> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  return new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result || null);
  });
}

export async function deleteSnapshot(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
}
