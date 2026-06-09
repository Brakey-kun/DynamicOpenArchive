import { HistoryEntry, ProjectSave } from '../types';

const DB_NAME = 'schema-drawer-db';
const DB_VERSION = 1;
const STORE_NAME = 'history';

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = (e.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('savedAt', 'savedAt', { unique: false });
            }
        };
        req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
        req.onerror = (e) => reject((e.target as IDBOpenDBRequest).error);
    });
}

export async function saveHistoryEntry(entry: HistoryEntry): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(entry);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function getAllHistoryEntries(): Promise<HistoryEntry[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).index('savedAt').getAll();
        req.onsuccess = () => resolve((req.result as HistoryEntry[]).reverse());
        req.onerror = () => reject(req.error);
    });
}

export async function deleteHistoryEntry(id: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function renameHistoryEntry(id: string, name: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const getReq = store.get(id);
        getReq.onsuccess = () => {
            const entry: HistoryEntry = getReq.result;
            if (entry) {
                entry.name = name;
                store.put(entry);
            }
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function updateHistoryThumbnail(id: string, thumbnail: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const getReq = store.get(id);
        getReq.onsuccess = () => {
            const entry: HistoryEntry = getReq.result;
            if (entry) {
                entry.thumbnail = thumbnail;
                store.put(entry);
            }
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export function generateHistoryEntry(
    projectData: ProjectSave,
    name?: string,
    thumbnail?: string
): HistoryEntry {
    return {
        id: Math.random().toString(36).substring(2, 11),
        name: name || `Snapshot – ${new Date().toLocaleString()}`,
        savedAt: Date.now(),
        projectData,
        thumbnail,
    };
}
