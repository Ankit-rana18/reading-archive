/**
 * Storage layer. Everything goes through the StorageAdapter interface so a cloud
 * backend (e.g. Supabase) can be dropped in later without touching the UI.
 * The default adapter is IndexedDB: database "reading-archive" with stores
 * books, sessions and covers (cover images are kept as Blobs).
 */
import type { Book, Prefs, ReadingSession } from '../types/book';

export interface StorageAdapter {
  loadBooks(): Promise<Book[]>;
  saveBook(book: Book): Promise<void>;
  saveBooks(books: Book[]): Promise<void>;
  deleteBook(id: string): Promise<void>;
  loadSessions(): Promise<ReadingSession[]>;
  saveSession(s: ReadingSession): Promise<void>;
  saveSessions(s: ReadingSession[]): Promise<void>;
  deleteSession(id: string): Promise<void>;
  saveCover(id: string, blob: Blob): Promise<void>;
  getCover(id: string): Promise<Blob | undefined>;
  deleteCover(id: string): Promise<void>;
  listCoverIds(): Promise<string[]>;
  clearAll(): Promise<void>;
}

const DB_NAME = 'reading-archive';
const DB_VERSION = 1;
type StoreName = 'books' | 'sessions' | 'covers';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is not available in this browser.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('books')) db.createObjectStore('books', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('sessions')) {
        const s = db.createObjectStore('sessions', { keyPath: 'id' });
        s.createIndex('bookId', 'bookId');
      }
      if (!db.objectStoreNames.contains('covers')) db.createObjectStore('covers', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('The archive database is blocked by another tab.'));
  });
  dbPromise.catch(() => (dbPromise = null));
  return dbPromise;
}

function tx<T>(store: StoreName | StoreName[], mode: IDBTransactionMode, fn: (t: IDBTransaction) => T | Promise<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        let result: T;
        Promise.resolve(fn(t)).then((r) => (result = r), reject);
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error ?? new Error('Transaction aborted'));
      }),
  );
}

const reqP = <T>(r: IDBRequest<T>) =>
  new Promise<T>((res, rej) => {
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });

export const idbAdapter: StorageAdapter = {
  loadBooks: () => tx('books', 'readonly', (t) => reqP(t.objectStore('books').getAll() as IDBRequest<Book[]>)),
  saveBook: (b) => tx('books', 'readwrite', (t) => void t.objectStore('books').put(b)),
  saveBooks: (bs) => tx('books', 'readwrite', (t) => bs.forEach((b) => t.objectStore('books').put(b))),
  deleteBook: (id) =>
    tx(['books', 'sessions'], 'readwrite', async (t) => {
      t.objectStore('books').delete(id);
      const idx = t.objectStore('sessions').index('bookId');
      const keys = await reqP(idx.getAllKeys(id));
      keys.forEach((k) => t.objectStore('sessions').delete(k));
    }),
  loadSessions: () =>
    tx('sessions', 'readonly', (t) => reqP(t.objectStore('sessions').getAll() as IDBRequest<ReadingSession[]>)),
  saveSession: (s) => tx('sessions', 'readwrite', (t) => void t.objectStore('sessions').put(s)),
  saveSessions: (ss) => tx('sessions', 'readwrite', (t) => ss.forEach((s) => t.objectStore('sessions').put(s))),
  deleteSession: (id) => tx('sessions', 'readwrite', (t) => void t.objectStore('sessions').delete(id)),
  saveCover: (id, blob) => tx('covers', 'readwrite', (t) => void t.objectStore('covers').put({ id, blob })),
  getCover: (id) =>
    tx('covers', 'readonly', async (t) => {
      const r = (await reqP(t.objectStore('covers').get(id))) as { blob: Blob } | undefined;
      return r?.blob;
    }),
  deleteCover: (id) => tx('covers', 'readwrite', (t) => void t.objectStore('covers').delete(id)),
  listCoverIds: () =>
    tx('covers', 'readonly', async (t) => (await reqP(t.objectStore('covers').getAllKeys())).map(String)),
  clearAll: () =>
    tx(['books', 'sessions', 'covers'], 'readwrite', (t) => {
      t.objectStore('books').clear();
      t.objectStore('sessions').clear();
      t.objectStore('covers').clear();
    }),
};

/** The active adapter. Swap this for a cloud adapter later. */
export const storage: StorageAdapter = idbAdapter;

/** Ask the browser not to evict the archive under storage pressure. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

export async function storageInfo() {
  try {
    const [persisted, est] = await Promise.all([
      navigator.storage?.persisted?.() ?? Promise.resolve(false),
      navigator.storage?.estimate?.() ?? Promise.resolve(undefined),
    ]);
    return { persisted, usage: est?.usage ?? null, quota: est?.quota ?? null };
  } catch {
    return { persisted: false, usage: null, quota: null };
  }
}

/* ---------------- Preferences (lightweight, localStorage) ---------------- */

const PREFS_KEY = 'ra.prefs';
export const DEFAULT_PREFS: Prefs = {
  theme: 'paper',
  motion: 'system',
  yearGoals: {},
  dailyPageGoal: 25,
  defaultView: 'shelf',
};

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable: preferences fall back to defaults next time */
  }
}
