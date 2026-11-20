import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Book, BookInput, ReadingSession, ReadingStatus } from '../types/book';
import { requestPersistence, storage } from '../services/storage';
import { fetchCoverBlob } from '../services/bookAPI';
import type { ParsedBackup } from '../services/backup';
import { cleanIsbn, norm, todayISO, uid } from '../lib/util';

export interface SessionInput {
  date: string;
  fromPage?: number;
  toPage?: number;
  minutes?: number;
  note?: string;
}

interface LibraryCtx {
  books: Book[];
  sessions: ReadingSession[];
  loaded: boolean;
  loadError: string | null;
  coverVersion: number;
  getBook(id: string): Book | undefined;
  findDuplicate(input: Pick<Book, 'title' | 'author' | 'isbn'>, excludeId?: string): Book | undefined;
  addBook(input: BookInput, coverFile?: Blob | null): Promise<Book>;
  updateBook(id: string, patch: Partial<Book>, coverFile?: Blob | null): Promise<void>;
  deleteBook(id: string): Promise<void>;
  setStatus(id: string, status: ReadingStatus): Promise<void>;
  completeBook(id: string, data: { rating?: number; review?: string; date: string }): Promise<void>;
  addSession(bookId: string, s: SessionInput): Promise<ReadingSession>;
  deleteSession(id: string): Promise<void>;
  importBackup(p: ParsedBackup, mode: 'merge' | 'replace'): Promise<{ added: number; updated: number }>;
  clearLibrary(): Promise<void>;
}

const Ctx = createContext<LibraryCtx | null>(null);

export function LibraryProvider({ children, onError, readOnly = false }: { children: ReactNode; onError: (msg: string) => void; readOnly?: boolean }) {
  const [books, setBooks] = useState<Book[]>([]);
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [coverVersion, setCoverVersion] = useState(0);
  const booksRef = useRef(books);
  booksRef.current = books;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    Promise.all([storage.loadBooks(), storage.loadSessions()])
      .then(([b, s]) => {
        setBooks(b);
        setSessions(s);
        setLoaded(true);
        if (b.length) requestPersistence();
      })
      .catch((e: Error) => {
        setLoadError(e.message || 'Your archive could not be opened.');
        setLoaded(true);
      });
  }, []);

  const persist = useCallback((p: Promise<unknown>) => {
    p.catch((e: Error) => onErrorRef.current(`Could not save: ${e?.message ?? 'unknown storage error'}`));
    return p;
  }, []);

  const getBook = useCallback((id: string) => booksRef.current.find((b) => b.id === id), []);

  const findDuplicate = useCallback((input: Pick<Book, 'title' | 'author' | 'isbn'>, excludeId?: string) => {
    const isbn = cleanIsbn(input.isbn);
    const key = norm(input.title) + '|' + norm(input.author);
    return booksRef.current.find(
      (b) => b.id !== excludeId && ((isbn.length >= 10 && cleanIsbn(b.isbn) === isbn) || norm(b.title) + '|' + norm(b.author) === key),
    );
  }, []);

  const writeBook = useCallback(
    (b: Book) => {
      setBooks((prev) => {
        const i = prev.findIndex((x) => x.id === b.id);
        if (i === -1) return [...prev, b];
        const next = prev.slice();
        next[i] = b;
        return next;
      });
      return persist(storage.saveBook(b)) as Promise<void>;
    },
    [persist],
  );

  /** Best-effort: keep a local copy of a remote cover so the archive works offline. */
  const cacheRemoteCover = useCallback(
    async (book: Book) => {
      if (!book.coverUrl || book.coverBlobId) return;
      const blob = await fetchCoverBlob(book.coverUrl);
      if (!blob) return;
      const coverBlobId = `cover-${book.id}`;
      await storage.saveCover(coverBlobId, blob);
      const cur = booksRef.current.find((b) => b.id === book.id);
      if (cur && cur.coverUrl === book.coverUrl && !cur.coverBlobId) {
        await writeBook({ ...cur, coverBlobId });
        setCoverVersion((v) => v + 1);
      }
    },
    [writeBook],
  );

  const addBook = useCallback(
    async (input: BookInput, coverFile?: Blob | null) => {
      const now = new Date().toISOString();
      const id = uid();
      const book: Book = {
        quotes: [],
        lessons: [],
        ...input,
        title: input.title.trim(),
        author: input.author.trim(),
        id,
        addedAt: now,
        updatedAt: now,
      };
      if (book.status === 'reading' && !book.dateStarted) book.dateStarted = todayISO();
      if (book.status === 'read' && book.pages && book.currentPage === undefined) book.currentPage = book.pages;
      if (coverFile) {
        book.coverBlobId = `cover-${id}`;
        await storage.saveCover(book.coverBlobId, coverFile);
      }
      await writeBook(book);
      requestPersistence();
      if (!coverFile && book.coverUrl) cacheRemoteCover(book);
      return book;
    },
    [writeBook, cacheRemoteCover],
  );

  const updateBook = useCallback(
    async (id: string, patch: Partial<Book>, coverFile?: Blob | null) => {
      const cur = booksRef.current.find((b) => b.id === id);
      if (!cur) return;
      const next: Book = { ...cur, ...patch, id, updatedAt: new Date().toISOString() };
      if (coverFile) {
        next.coverBlobId = `cover-${id}-${Date.now().toString(36)}`;
        await storage.saveCover(next.coverBlobId, coverFile);
        if (cur.coverBlobId) storage.deleteCover(cur.coverBlobId).catch(() => {});
        setCoverVersion((v) => v + 1);
      } else if (coverFile === null && cur.coverBlobId) {
        storage.deleteCover(cur.coverBlobId).catch(() => {});
        next.coverBlobId = undefined;
        setCoverVersion((v) => v + 1);
      } else if (patch.coverUrl !== undefined && patch.coverUrl !== cur.coverUrl && cur.coverBlobId?.startsWith(`cover-${id}`)) {
        // remote URL changed: drop the stale cached copy
        storage.deleteCover(cur.coverBlobId).catch(() => {});
        next.coverBlobId = undefined;
        setCoverVersion((v) => v + 1);
      }
      await writeBook(next);
      if (!next.coverBlobId && next.coverUrl) cacheRemoteCover(next);
    },
    [writeBook, cacheRemoteCover],
  );

  const deleteBook = useCallback(
    async (id: string) => {
      const cur = booksRef.current.find((b) => b.id === id);
      setBooks((prev) => prev.filter((b) => b.id !== id));
      setSessions((prev) => prev.filter((s) => s.bookId !== id));
      await persist(storage.deleteBook(id));
      if (cur?.coverBlobId) storage.deleteCover(cur.coverBlobId).catch(() => {});
    },
    [persist],
  );

  const setStatus = useCallback(
    async (id: string, status: ReadingStatus) => {
      const cur = booksRef.current.find((b) => b.id === id);
      if (!cur || cur.status === status) return;
      const patch: Partial<Book> = { status };
      if (status === 'reading') {
        if (!cur.dateStarted || cur.status === 'read') patch.dateStarted = todayISO();
        if (cur.status === 'read') {
          patch.currentPage = 0;
          patch.dateCompleted = undefined;
        }
      }
      if (status === 'read') {
        patch.dateCompleted = cur.dateCompleted ?? todayISO();
        if (cur.pages) patch.currentPage = cur.pages;
      }
      if (status === 'want') {
        patch.priority = cur.priority ?? 'medium';
      }
      await updateBook(id, patch);
    },
    [updateBook],
  );

  const completeBook = useCallback(
    async (id: string, data: { rating?: number; review?: string; date: string }) => {
      const cur = booksRef.current.find((b) => b.id === id);
      if (!cur) return;
      await updateBook(id, {
        status: 'read',
        dateCompleted: data.date,
        dateStarted: cur.dateStarted,
        rating: data.rating ?? cur.rating,
        review: data.review?.trim() ? data.review.trim() : cur.review,
        currentPage: cur.pages ?? cur.currentPage,
      });
    },
    [updateBook],
  );

  const addSession = useCallback(
    async (bookId: string, s: SessionInput) => {
      const cur = booksRef.current.find((b) => b.id === bookId);
      const from = s.fromPage ?? cur?.currentPage ?? 0;
      const to = s.toPage ?? from;
      const session: ReadingSession = {
        id: uid(),
        bookId,
        date: s.date,
        fromPage: from,
        toPage: to,
        pages: Math.max(0, to - from),
        minutes: s.minutes && s.minutes > 0 ? s.minutes : undefined,
        note: s.note?.trim() || undefined,
        createdAt: new Date().toISOString(),
      };
      setSessions((prev) => [...prev, session]);
      await persist(storage.saveSession(session));
      if (cur && to !== cur.currentPage && s.toPage !== undefined) {
        await updateBook(bookId, { currentPage: cur.pages ? Math.min(cur.pages, to) : to });
      }
      return session;
    },
    [persist, updateBook],
  );

  const deleteSession = useCallback(
    async (id: string) => {
      setSessions((prev) => prev.filter((s) => s.id !== id));
      await persist(storage.deleteSession(id));
    },
    [persist],
  );

  const importBackup = useCallback(async (p: ParsedBackup, mode: 'merge' | 'replace') => {
    let added = 0;
    let updated = 0;
    if (mode === 'replace') {
      await storage.clearAll();
      await storage.saveBooks(p.books);
      await storage.saveSessions(p.sessions);
      for (const c of p.covers) await storage.saveCover(c.id, c.blob);
      setBooks(p.books);
      setSessions(p.sessions);
      added = p.books.length;
    } else {
      const byId = new Map(booksRef.current.map((b) => [b.id, b]));
      const toSave: Book[] = [];
      for (const b of p.books) {
        const existing = byId.get(b.id);
        if (!existing) {
          toSave.push(b);
          added++;
        } else if (b.updatedAt > existing.updatedAt) {
          toSave.push(b);
          updated++;
        }
      }
      await storage.saveBooks(toSave);
      const existingSessions = new Set((await storage.loadSessions()).map((s) => s.id));
      const newSessions = p.sessions.filter((s) => !existingSessions.has(s.id));
      await storage.saveSessions(newSessions);
      for (const c of p.covers) await storage.saveCover(c.id, c.blob);
      const [b, s] = await Promise.all([storage.loadBooks(), storage.loadSessions()]);
      setBooks(b);
      setSessions(s);
    }
    setCoverVersion((v) => v + 1);
    requestPersistence();
    return { added, updated };
  }, []);

  const clearLibrary = useCallback(async () => {
    await storage.clearAll();
    setBooks([]);
    setSessions([]);
    setCoverVersion((v) => v + 1);
  }, []);

  const value = useMemo<LibraryCtx>(() => {
    // Viewers get the same data with every write refused (the database enforces this too).
    const deny = () => Promise.reject(new Error('This archive is view-only.'));
    const w = <F,>(f: F): F => (readOnly ? (deny as unknown as F) : f);
    return {
      books,
      sessions,
      loaded,
      loadError,
      coverVersion,
      getBook,
      findDuplicate,
      addBook: w(addBook),
      updateBook: w(updateBook),
      deleteBook: w(deleteBook),
      setStatus: w(setStatus),
      completeBook: w(completeBook),
      addSession: w(addSession),
      deleteSession: w(deleteSession),
      importBackup: w(importBackup),
      clearLibrary: w(clearLibrary),
    };
  }, [readOnly, books, sessions, loaded, loadError, coverVersion, getBook, findDuplicate, addBook, updateBook, deleteBook, setStatus, completeBook, addSession, deleteSession, importBackup, clearLibrary]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLibrary() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useLibrary must be used inside LibraryProvider');
  return c;
}
