import type { Book, Prefs, ReadingSession } from '../types/book';
import { storage, type StorageAdapter } from './storage';
import { todayISO } from '../lib/util';

export const BACKUP_FORMAT = 'the-reading-archive';
export const BACKUP_VERSION = 1;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  books: Book[];
  sessions: ReadingSession[];
  covers: { id: string; type: string; data: string }[]; // base64
  prefs?: Partial<Prefs>;
}

const blobToBase64 = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1] ?? '');
    r.onerror = () => rej(r.error);
    r.readAsDataURL(b);
  });

const base64ToBlob = (data: string, type: string) => {
  const bin = atob(data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
};

export function download(name: string, content: Blob) {
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function buildBackup(books: Book[], sessions: ReadingSession[], prefs: Prefs, source: StorageAdapter = storage): Promise<BackupFile> {
  const covers: BackupFile['covers'] = [];
  for (const b of books) {
    if (!b.coverBlobId) continue;
    const blob = await source.getCover(b.coverBlobId);
    if (blob) covers.push({ id: b.coverBlobId, type: blob.type || 'image/jpeg', data: await blobToBase64(blob) });
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    books,
    sessions,
    covers,
    prefs,
  };
}

export async function exportJSON(books: Book[], sessions: ReadingSession[], prefs: Prefs, source: StorageAdapter = storage) {
  const data = await buildBackup(books, sessions, prefs, source);
  download(`reading-archive-backup-${todayISO()}.json`, new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
}

const CSV_FIELDS: (keyof Book)[] = [
  'title', 'author', 'status', 'genre', 'isbn', 'publisher', 'year', 'pages', 'currentPage',
  'dateStarted', 'dateCompleted', 'rating', 'priority', 'reason', 'description', 'review', 'notes', 'quotes', 'lessons', 'addedAt',
];

const csvCell = (v: unknown) => {
  if (v === undefined || v === null) return '';
  const s = Array.isArray(v) ? v.join(' | ') : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function exportCSV(books: Book[]) {
  const rows = [CSV_FIELDS.join(','), ...books.map((b) => CSV_FIELDS.map((f) => csvCell(b[f])).join(','))];
  // BOM so spreadsheet apps read UTF-8 correctly.
  download(`reading-archive-${todayISO()}.csv`, new Blob(['﻿' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
}

/* ---------------- Import ---------------- */

const isStr = (v: unknown): v is string => typeof v === 'string';
const STATUSES = ['read', 'reading', 'want'];

function sanitizeBook(raw: unknown): Book | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!isStr(r.id) || !isStr(r.title) || !r.title.trim()) return null;
  const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : undefined);
  const str = (v: unknown) => (isStr(v) && v.trim() ? v : undefined);
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter(isStr) : []);
  const now = new Date().toISOString();
  return {
    id: r.id,
    title: r.title.trim(),
    author: str(r.author) ?? 'Unknown author',
    coverUrl: str(r.coverUrl),
    coverBlobId: str(r.coverBlobId),
    genre: str(r.genre),
    isbn: str(r.isbn),
    publisher: str(r.publisher),
    year: num(r.year),
    pages: num(r.pages),
    status: (STATUSES.includes(r.status as string) ? r.status : 'want') as Book['status'],
    dateStarted: str(r.dateStarted),
    dateCompleted: str(r.dateCompleted),
    rating: num(r.rating),
    description: str(r.description),
    notes: str(r.notes),
    review: str(r.review),
    quotes: arr(r.quotes),
    lessons: arr(r.lessons),
    currentPage: num(r.currentPage),
    priority: (['high', 'medium', 'low'].includes(r.priority as string) ? r.priority : undefined) as Book['priority'],
    reason: str(r.reason),
    spineColor: str(r.spineColor),
    source: (['openlibrary', 'google', 'manual'].includes(r.source as string) ? r.source : 'manual') as Book['source'],
    sourceId: str(r.sourceId),
    addedAt: str(r.addedAt) ?? now,
    updatedAt: str(r.updatedAt) ?? now,
  };
}

function sanitizeSession(raw: unknown): ReadingSession | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!isStr(r.id) || !isStr(r.bookId) || !isStr(r.date)) return null;
  const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : undefined);
  return {
    id: r.id,
    bookId: r.bookId,
    date: r.date,
    fromPage: num(r.fromPage),
    toPage: num(r.toPage),
    pages: num(r.pages) ?? 0,
    minutes: num(r.minutes),
    note: isStr(r.note) ? r.note : undefined,
    createdAt: isStr(r.createdAt) ? r.createdAt : new Date().toISOString(),
  };
}

export interface ParsedBackup {
  books: Book[];
  sessions: ReadingSession[];
  covers: { id: string; blob: Blob }[];
  prefs?: Partial<Prefs>;
  exportedAt?: string;
  skipped: number;
}

export async function parseBackup(file: File): Promise<ParsedBackup> {
  if (file.size > 300 * 1024 * 1024) throw new Error('This file is too large to be a Reading Archive backup.');
  let json: unknown;
  try {
    json = JSON.parse(await file.text());
  } catch {
    throw new Error('This file is not valid JSON.');
  }
  const j = json as Partial<BackupFile>;
  if (!j || j.format !== BACKUP_FORMAT || !Array.isArray(j.books)) {
    throw new Error('This file is not a Reading Archive backup.');
  }
  if ((j.version ?? 0) > BACKUP_VERSION) throw new Error('This backup was made by a newer version of the archive.');
  const books = j.books.map(sanitizeBook);
  const sessions = (Array.isArray(j.sessions) ? j.sessions : []).map(sanitizeSession);
  const covers: ParsedBackup['covers'] = [];
  for (const c of Array.isArray(j.covers) ? j.covers : []) {
    if (c && isStr(c.id) && isStr(c.data)) {
      try {
        covers.push({ id: c.id, blob: base64ToBlob(c.data, isStr(c.type) ? c.type : 'image/jpeg') });
      } catch {
        /* skip a corrupt cover */
      }
    }
  }
  const okBooks = books.filter((b): b is Book => !!b);
  const ids = new Set(okBooks.map((b) => b.id));
  const okSessions = sessions.filter((s): s is ReadingSession => !!s && ids.has(s.bookId));
  return {
    books: okBooks,
    sessions: okSessions,
    covers,
    prefs: j.prefs,
    exportedAt: j.exportedAt,
    skipped: books.length - okBooks.length,
  };
}
