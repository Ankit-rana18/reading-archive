import { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import type { Book, BookInput, Priority, ReadingStatus } from '../types/book';
import { STATUS_LABEL } from '../types/book';
import { CLOTHS, cleanIsbn, todayISO } from '../lib/util';
import { useCover } from '../hooks/useCover';
import { BookCover } from './BookCover';
import { Stars, Tabs } from './ui';

export interface FormValues {
  title: string;
  author: string;
  status: ReadingStatus;
  genre: string;
  isbn: string;
  publisher: string;
  year: string;
  pages: string;
  currentPage: string;
  dateStarted: string;
  dateCompleted: string;
  rating?: number;
  description: string;
  notes: string;
  review: string;
  priority: Priority;
  reason: string;
  coverUrl: string;
  spineColor: string;
  source: Book['source'];
  sourceId: string;
}

export const emptyValues = (status: ReadingStatus = 'want'): FormValues => ({
  title: '',
  author: '',
  status,
  genre: '',
  isbn: '',
  publisher: '',
  year: '',
  pages: '',
  currentPage: '',
  dateStarted: status === 'reading' ? todayISO() : '',
  dateCompleted: status === 'read' ? todayISO() : '',
  description: '',
  notes: '',
  review: '',
  priority: 'medium',
  reason: '',
  coverUrl: '',
  spineColor: '',
  source: 'manual',
  sourceId: '',
});

export const valuesFromBook = (b: Book): FormValues => ({
  title: b.title,
  author: b.author,
  status: b.status,
  genre: b.genre ?? '',
  isbn: b.isbn ?? '',
  publisher: b.publisher ?? '',
  year: b.year ? String(b.year) : '',
  pages: b.pages ? String(b.pages) : '',
  currentPage: b.currentPage !== undefined ? String(b.currentPage) : '',
  dateStarted: b.dateStarted ?? '',
  dateCompleted: b.dateCompleted ?? '',
  rating: b.rating,
  description: b.description ?? '',
  notes: b.notes ?? '',
  review: b.review ?? '',
  priority: b.priority ?? 'medium',
  reason: b.reason ?? '',
  coverUrl: b.coverUrl ?? '',
  spineColor: b.spineColor ?? '',
  source: b.source ?? 'manual',
  sourceId: b.sourceId ?? '',
});

const int = (s: string) => {
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};
const str = (s: string) => (s.trim() ? s.trim() : undefined);

export function toInput(v: FormValues): BookInput {
  const pages = int(v.pages);
  let currentPage = v.currentPage === '' ? undefined : Math.max(0, parseInt(v.currentPage, 10) || 0);
  if (pages && currentPage !== undefined) currentPage = Math.min(currentPage, pages);
  if (v.status === 'read' && pages) currentPage = pages;
  return {
    title: v.title.trim(),
    author: v.author.trim(),
    status: v.status,
    genre: str(v.genre),
    isbn: str(v.isbn) ? cleanIsbn(v.isbn) : undefined,
    publisher: str(v.publisher),
    year: int(v.year),
    pages,
    currentPage,
    dateStarted: v.status === 'want' ? undefined : str(v.dateStarted),
    dateCompleted: v.status === 'read' ? str(v.dateCompleted) ?? todayISO() : undefined,
    rating: v.rating,
    description: str(v.description),
    notes: str(v.notes),
    review: str(v.review),
    priority: v.status === 'want' ? v.priority : undefined,
    reason: str(v.reason),
    coverUrl: str(v.coverUrl),
    spineColor: str(v.spineColor),
    source: v.source,
    sourceId: str(v.sourceId),
  };
}

export const GENRE_SUGGESTIONS = [
  'Fiction', 'Classics', 'Literary Fiction', 'Science Fiction', 'Fantasy', 'Mystery', 'Thriller', 'Horror', 'Romance',
  'Poetry', 'Drama', 'Essays', 'Biography', 'Memoir', 'History', 'Philosophy', 'Psychology', 'Self-help', 'Business',
  'Science', 'Politics', 'Religion', 'Art & Design', 'Travel', 'Food',
];

export function BookForm({
  initial,
  existing,
  onSubmit,
  submitLabel,
  error,
  extraActions,
}: {
  initial: FormValues;
  existing?: Book;
  onSubmit: (v: FormValues, cover: Blob | null | undefined) => void;
  submitLabel: string;
  error?: React.ReactNode;
  extraActions?: React.ReactNode;
}) {
  const [v, setV] = useState<FormValues>(initial);
  const [file, setFile] = useState<Blob | null | undefined>(undefined); // undefined: unchanged, null: removed
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const existingCover = useCover(existing && file === undefined ? existing : null);

  useEffect(() => setV(initial), [initial]);
  useEffect(() => {
    if (!file) {
      setFileUrl(null);
      return;
    }
    const u = URL.createObjectURL(file);
    setFileUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const set = <K extends keyof FormValues>(k: K, val: FormValues[K]) => setV((p) => ({ ...p, [k]: val }));
  const setStatus = (s: ReadingStatus) =>
    setV((p) => ({
      ...p,
      status: s,
      dateStarted: s !== 'want' && !p.dateStarted ? todayISO() : p.dateStarted,
      dateCompleted: s === 'read' && !p.dateCompleted ? todayISO() : p.dateCompleted,
    }));

  const previewBook = useMemo(
    () => ({
      title: v.title || 'Untitled',
      author: v.author || 'Author',
      year: int(v.year),
      coverUrl:
        fileUrl ??
        (file === null && !v.coverUrl
          ? undefined
          : existing && v.coverUrl === (existing.coverUrl ?? '') && file !== null
            ? existingCover ?? undefined
            : str(v.coverUrl)),
      spineColor: str(v.spineColor),
    }),
    [v.title, v.author, v.year, v.coverUrl, v.spineColor, fileUrl, file, existingCover, existing],
  );

  const errors = {
    title: !v.title.trim() ? 'A title is required.' : '',
    author: !v.author.trim() ? 'An author is required.' : '',
    pages: v.pages && !int(v.pages) ? 'Pages must be a positive number.' : '',
    year: v.year && (!int(v.year) || Number(v.year) > new Date().getFullYear() + 2) ? 'Enter a valid year.' : '',
    dates: v.status === 'read' && v.dateStarted && v.dateCompleted && v.dateCompleted < v.dateStarted ? 'Completion date is before the start date.' : '',
  };
  const invalid = Object.values(errors).some(Boolean);

  const pick = (f?: File) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) return;
    if (f.size > 12 * 1024 * 1024) {
      alert('That image is larger than 12 MB. Please choose a smaller one.');
      return;
    }
    setFile(f);
  };

  return (
    <form
      className="bform"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (!invalid) onSubmit(v, file);
      }}
    >
      <div className="bform__cover">
        <BookCover book={previewBook} />
        <div className="bform__cover-actions">
          <button type="button" className="btn btn--sm" onClick={() => fileInput.current?.click()}>
            <ImagePlus size={12} /> Upload cover
          </button>
          {(fileUrl || v.coverUrl || existing?.coverBlobId) && file !== null && (
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={() => {
                setFile(null);
                set('coverUrl', '');
              }}
            >
              <Trash2 size={12} /> Remove
            </button>
          )}
          <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
        </div>
        <label className="field">
          <span>Or cover image URL</span>
          <input className="input input--sm" value={v.coverUrl} placeholder="https://…" onChange={(e) => (set('coverUrl', e.target.value), file === null && setFile(undefined))} />
        </label>
        <div className="field">
          <span>Spine cloth</span>
          <div className="swatches">
            <button type="button" className={`swatch swatch--auto ${!v.spineColor ? 'is-on' : ''}`} onClick={() => set('spineColor', '')} aria-label="Automatic colour" title="Automatic">
              A
            </button>
            {CLOTHS.map((c) => (
              <button
                key={c.bg}
                type="button"
                className={`swatch ${v.spineColor === c.bg ? 'is-on' : ''}`}
                style={{ background: c.bg }}
                onClick={() => set('spineColor', c.bg)}
                aria-label={`Spine colour ${c.bg}`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="bform__fields">
        <div className="field">
          <span>Reading status</span>
          <Tabs
            label="Reading status"
            value={v.status}
            onChange={setStatus}
            items={(['read', 'reading', 'want'] as ReadingStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
          />
        </div>

        <div className="bform__grid">
          <label className="field bform__wide">
            <span>Title *</span>
            <input className="input input--lg" value={v.title} onChange={(e) => set('title', e.target.value)} autoFocus={!v.title} aria-invalid={touched && !!errors.title} />
            {touched && errors.title && <em className="ferr">{errors.title}</em>}
          </label>
          <label className="field bform__wide">
            <span>Author *</span>
            <input className="input" value={v.author} onChange={(e) => set('author', e.target.value)} aria-invalid={touched && !!errors.author} />
            {touched && errors.author && <em className="ferr">{errors.author}</em>}
          </label>
          <label className="field">
            <span>Genre</span>
            <input className="input" list="genre-list" value={v.genre} onChange={(e) => set('genre', e.target.value)} />
            <datalist id="genre-list">
              {GENRE_SUGGESTIONS.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </label>
          <label className="field">
            <span>Publication year</span>
            <input className="input" inputMode="numeric" value={v.year} onChange={(e) => set('year', e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} />
            {touched && errors.year && <em className="ferr">{errors.year}</em>}
          </label>
          <label className="field">
            <span>Publisher</span>
            <input className="input" value={v.publisher} onChange={(e) => set('publisher', e.target.value)} />
          </label>
          <label className="field">
            <span>ISBN</span>
            <input className="input" value={v.isbn} onChange={(e) => set('isbn', e.target.value)} />
          </label>
          <label className="field">
            <span>Total pages</span>
            <input className="input" inputMode="numeric" value={v.pages} onChange={(e) => set('pages', e.target.value.replace(/[^0-9]/g, ''))} />
            {touched && errors.pages && <em className="ferr">{errors.pages}</em>}
          </label>
          {v.status === 'reading' && (
            <label className="field">
              <span>Current page</span>
              <input className="input" inputMode="numeric" value={v.currentPage} onChange={(e) => set('currentPage', e.target.value.replace(/[^0-9]/g, ''))} />
            </label>
          )}
          {v.status !== 'want' && (
            <label className="field">
              <span>Date started</span>
              <input type="date" className="input" value={v.dateStarted} max={todayISO()} onChange={(e) => set('dateStarted', e.target.value)} />
            </label>
          )}
          {v.status === 'read' && (
            <label className="field">
              <span>Date completed</span>
              <input type="date" className="input" value={v.dateCompleted} max={todayISO()} onChange={(e) => set('dateCompleted', e.target.value)} />
              {touched && errors.dates && <em className="ferr">{errors.dates}</em>}
            </label>
          )}
          {v.status === 'want' && (
            <label className="field">
              <span>Priority</span>
              <select className="select" value={v.priority} onChange={(e) => set('priority', e.target.value as Priority)}>
                <option value="high">High priority</option>
                <option value="medium">Medium priority</option>
                <option value="low">Low priority</option>
              </select>
            </label>
          )}
          {v.status !== 'want' && (
            <div className="field">
              <span>Rating</span>
              <Stars value={v.rating} onChange={(r) => set('rating', r)} />
            </div>
          )}
          {v.status === 'want' && (
            <label className="field bform__wide">
              <span>Why you want to read it</span>
              <input className="input" value={v.reason} placeholder="Recommended by…, because…" onChange={(e) => set('reason', e.target.value)} />
            </label>
          )}
          <label className="field bform__wide">
            <span>Description</span>
            <textarea className="textarea" rows={4} value={v.description} onChange={(e) => set('description', e.target.value)} />
          </label>
          {v.status === 'read' && (
            <label className="field bform__wide">
              <span>Review</span>
              <textarea className="textarea" rows={4} value={v.review} onChange={(e) => set('review', e.target.value)} />
            </label>
          )}
          <label className="field bform__wide">
            <span>Personal notes</span>
            <textarea className="textarea" rows={3} value={v.notes} onChange={(e) => set('notes', e.target.value)} />
          </label>
        </div>

        {error && <div className="bform__error">{error}</div>}

        <div className="bform__actions">
          {extraActions}
          <button type="submit" className="btn btn--solid">
            {submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
