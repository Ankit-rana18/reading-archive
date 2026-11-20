import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { ReadingStatus } from '../types/book';
import { STATUS_LABEL } from '../types/book';
import { useLibrary } from '../hooks/useBooks';
import { useUI } from '../hooks/useUI';
import { applyFilters, matchField, NO_FILTERS, sortBooks, type Filters, type SortKey } from '../lib/filter';
import { Modal } from './ui';
import { BookCover } from './BookCover';
import { FilterPanel, SortSelect } from './FilterPanel';
import { useOpenFromEl } from './BookCard';

/** Instant search across the whole archive: titles, authors, genres, notes, ISBN… */
export function GlobalSearch() {
  const ui = useUI();
  const { books } = useLibrary();
  const [f, setF] = useState<Filters>(NO_FILTERS);
  const [sort, setSort] = useState<SortKey>('added');
  const open = useOpenFromEl();

  useEffect(() => {
    if (ui.searchOpen) setF((p) => ({ ...p, q: '' }));
  }, [ui.searchOpen]);

  const results = useMemo(() => sortBooks(applyFilters(books, f), sort), [books, f, sort]);
  const hasQuery = f.q.trim().length > 0 || f.status !== 'all' || f.genre || f.author || f.pubYear || f.readYear || f.minRating;

  return (
    <Modal open={ui.searchOpen} onClose={() => ui.setSearchOpen(false)} title="Search the archive" kicker={`${books.length} books`} width={980} className="gsearch">
      <div className="spanel__bar">
        <Search size={18} strokeWidth={1.4} aria-hidden="true" />
        <input
          className="spanel__input"
          value={f.q}
          onChange={(e) => setF({ ...f, q: e.target.value })}
          placeholder="Titles, authors, genres, notes, ISBN…"
          aria-label="Search the archive"
          autoFocus
        />
      </div>
      <div className="spanel__opts">
        <div className="spanel__chips" role="group" aria-label="Status">
          {(['all', 'reading', 'read', 'want'] as (ReadingStatus | 'all')[]).map((s) => (
            <button key={s} type="button" className="chip" aria-pressed={f.status === s} onClick={() => setF({ ...f, status: s })}>
              {s === 'all' ? 'Everything' : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        <SortSelect value={sort} onChange={setSort} />
      </div>
      <FilterPanel books={books} filters={f} onChange={setF} />

      {books.length === 0 ? (
        <p className="spanel__hint muted">Your archive is empty. Add a book and it will be searchable here instantly.</p>
      ) : !hasQuery ? (
        <p className="spanel__hint muted">Start typing — results appear as you type. Press / anywhere to open search.</p>
      ) : results.length === 0 ? (
        <p className="spanel__hint muted">No books match. Try fewer words or clear a filter.</p>
      ) : (
        <ul className="gresults">
          {results.map((b) => {
            const m = matchField(b, f.q);
            return (
              <li key={b.id}>
                <button
                  type="button"
                  className="gresult"
                  onClick={(e) => {
                    ui.setSearchOpen(false);
                    open(b.id, e.currentTarget);
                  }}
                >
                  <BookCover book={b} className="gresult__cover" />
                  <span className="gresult__text">
                    <span className="gresult__title">{b.title}</span>
                    <span className="gresult__author">{b.author}</span>
                  </span>
                  <span className="lbl muted gresult__meta">
                    <i className={`status-dot status-dot--${b.status}`} />
                    {STATUS_LABEL[b.status]}
                    {m && m !== 'title' && m !== 'author' ? ` · in ${m}` : ''}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
