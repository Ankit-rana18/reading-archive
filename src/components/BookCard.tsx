import type { Book, ReadingStatus } from '../types/book';
import { PRIORITY_LABEL, STATUS_LABEL } from '../types/book';
import { useUI } from '../hooks/useUI';
import { useLibrary } from '../hooks/useBooks';
import { fmtDate, progressOf } from '../lib/util';
import { BookCover } from './BookCover';
import { ProgressBar, Stars } from './ui';
import { Pencil, Trash2 } from 'lucide-react';

/** Open the detail sheet from a card's cover element. */
export function useOpenFromEl() {
  const ui = useUI();
  return (id: string, el: HTMLElement | null, focus?: string) =>
    ui.openDetail(
      id,
      {
        getRect: () => {
          const inner = el?.isConnected ? el.querySelector('.bookcover__inner') ?? el : null;
          return inner ? inner.getBoundingClientRect() : null;
        },
        tilt: 0,
      },
      focus,
    );
}

export function BookCard({ book, showStatus = true }: { book: Book; showStatus?: boolean }) {
  const open = useOpenFromEl();
  return (
    <article className="bcard">
      <button
        type="button"
        className="bcard__btn is-liftable"
        onClick={(e) => open(book.id, e.currentTarget)}
        data-cursor="view"
        aria-label={`${book.title} by ${book.author}`}
      >
        <BookCover book={book} className="bcard__cover" />
        <span className="bcard__text">
          <span className="bcard__title">{book.title}</span>
          <span className="bcard__author">{book.author}</span>
          <span className="bcard__meta">
            {showStatus && (
              <span className="lbl">
                <i className={`status-dot status-dot--${book.status}`} />
                {book.status === 'reading' && book.pages ? `${Math.round(progressOf(book) * 100)}%` : STATUS_LABEL[book.status]}
              </span>
            )}
            {book.status === 'read' && book.rating ? <Stars value={book.rating} size="sm" /> : null}
            {book.status === 'want' && book.priority && <span className={`lbl prio-text prio-text--${book.priority}`}>{PRIORITY_LABEL[book.priority].split(' ')[0]}</span>}
          </span>
          {book.status === 'reading' && book.pages ? <ProgressBar value={progressOf(book)} className="bcard__bar" /> : null}
        </span>
      </button>
    </article>
  );
}

export function BookRow({ book }: { book: Book }) {
  const open = useOpenFromEl();
  const ui = useUI();
  const lib = useLibrary();
  const move = (s: ReadingStatus) => {
    if (s === book.status) return;
    if (s === 'read') ui.openComplete(book.id);
    else lib.setStatus(book.id, s).then(() => ui.toast(`Moved to ${STATUS_LABEL[s]}`));
  };
  const remove = async () => {
    if (await ui.confirm({ title: `Delete “${book.title}”?`, body: 'This removes the book and all its notes and sessions. It cannot be undone.', confirmLabel: 'Delete book', danger: true })) {
      await lib.deleteBook(book.id);
      ui.toast('Book deleted');
    }
  };
  return (
    <li className="brow">
      <button type="button" className="brow__main" onClick={(e) => open(book.id, e.currentTarget)} data-cursor="view">
        <BookCover book={book} className="brow__cover" />
        <span className="brow__title">{book.title}</span>
        <span className="brow__author">{book.author}</span>
      </button>
      <span className="brow__year lbl muted tnum">{book.year ?? '—'}</span>
      <span className="brow__genre lbl muted">{book.genre ?? '—'}</span>
      <span className="brow__rating">{book.rating ? <Stars value={book.rating} size="sm" /> : <span className="lbl muted">—</span>}</span>
      <span className="brow__date lbl muted tnum">
        {book.status === 'read' ? fmtDate(book.dateCompleted) : book.status === 'reading' && book.pages ? `${Math.round(progressOf(book) * 100)}%` : ''}
      </span>
      <label className="brow__status">
        <span className="sr-only">Status</span>
        <select className="select select--sm" value={book.status} onChange={(e) => move(e.target.value as ReadingStatus)}>
          <option value="read">Read</option>
          <option value="reading">Reading</option>
          <option value="want">Want to read</option>
        </select>
      </label>
      <span className="brow__actions">
        <button type="button" className="icon-btn" aria-label={`Edit ${book.title}`} onClick={() => ui.openEdit(book.id)}>
          <Pencil size={14} strokeWidth={1.4} />
        </button>
        <button type="button" className="icon-btn" aria-label={`Delete ${book.title}`} onClick={remove}>
          <Trash2 size={14} strokeWidth={1.4} />
        </button>
      </span>
    </li>
  );
}
