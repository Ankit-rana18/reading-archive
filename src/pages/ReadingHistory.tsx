import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useLibrary } from '../hooks/useBooks';
import { useUI } from '../hooks/useUI';
import { PageHead, Stars } from '../components/ui';
import { BookCover } from '../components/BookCover';
import { useOpenFromEl } from '../components/BookCard';
import { FilterPanel, SearchBar } from '../components/FilterPanel';
import { applyFilters, NO_FILTERS, type Filters } from '../lib/filter';
import { daysBetween, MONTHS_SHORT, numWord, parseISO, plural } from '../lib/util';

export function ReadingHistory() {
  const { books } = useLibrary();
  const ui = useUI();
  const open = useOpenFromEl();
  const [f, setF] = useState<Filters>({ ...NO_FILTERS, status: 'read' });
  const [order, setOrder] = useState<'desc' | 'asc'>('desc');

  const read = useMemo(() => books.filter((b) => b.status === 'read'), [books]);
  const shown = useMemo(() => {
    const list = applyFilters(read, f);
    return list.sort((a, b) => {
      const x = a.dateCompleted ?? '';
      const y = b.dateCompleted ?? '';
      return order === 'desc' ? y.localeCompare(x) : x.localeCompare(y);
    });
  }, [read, f, order]);

  const groups = useMemo(() => {
    const m = new Map<string, typeof shown>();
    for (const b of shown) {
      const y = b.dateCompleted?.slice(0, 4) ?? 'Undated';
      if (!m.has(y)) m.set(y, []);
      m.get(y)!.push(b);
    }
    return Array.from(m.entries());
  }, [shown]);

  return (
    <main className="page">
      <PageHead
        kicker="04 — Reading History"
        title={
          <>
            Every book, <em>remembered</em>
          </>
        }
        dek={read.length ? `${numWord(read.length)} ${read.length === 1 ? 'book' : 'books'} finished, kept in the order you closed them.` : 'Finished books are archived here, with your rating and review.'}
      />

      {read.length > 0 && (
        <div className="toolbar">
          <SearchBar value={f.q} onChange={(q) => setF({ ...f, q })} placeholder="Search history…" />
          <FilterPanel books={read} filters={f} onChange={setF} hide={['pubYear']} />
          <div className="toolbar__spacer" />
          <label className="sortsel lbl muted">
            Order
            <select className="select select--sm" value={order} onChange={(e) => setOrder(e.target.value as 'desc' | 'asc')}>
              <option value="desc">Most recent first</option>
              <option value="asc">Oldest first</option>
            </select>
          </label>
        </div>
      )}

      {read.length === 0 ? (
        <div className="empty">
          <p className="empty__title">Every completed book will feel like a memory.</p>
          <p className="empty__body">Mark a book as completed from Reading Now, or add one you have already read.</p>
          <button type="button" className="btn btn--solid" onClick={() => ui.openAdd('read')}>
            <Plus size={13} /> Add a book you’ve read
          </button>
        </div>
      ) : shown.length === 0 ? (
        <div className="empty">
          <p className="empty__title">No finished books match.</p>
        </div>
      ) : (
        <div className="timeline">
          {groups.map(([year, list]) => (
            <section key={year} className="tl__year">
              <header className="tl__yhead">
                <h2 className="tl__ynum">{year}</h2>
                <span className="lbl muted">{plural(list.length, 'book')}</span>
              </header>
              <ol className="tl__list">
                {list.map((b) => {
                  const d = parseISO(b.dateCompleted);
                  const dur = daysBetween(b.dateStarted, b.dateCompleted);
                  return (
                    <li key={b.id} className="tl__item">
                      <div className="tl__date">
                        {d ? (
                          <>
                            <span className="tl__day tnum">{String(d.getDate()).padStart(2, '0')}</span>
                            <span className="lbl muted">{MONTHS_SHORT[d.getMonth()]}</span>
                          </>
                        ) : (
                          <span className="lbl muted">—</span>
                        )}
                      </div>
                      <span className="tl__node" aria-hidden="true" />
                      <button type="button" className="tl__cover is-liftable" onClick={(e) => open(b.id, e.currentTarget)} data-cursor="view" aria-label={`Open ${b.title}`}>
                        <BookCover book={b} />
                      </button>
                      <div className="tl__body">
                        <h3 className="tl__title">{b.title}</h3>
                        <p className="tl__author">by {b.author}</p>
                        <div className="tl__meta">
                          {b.rating ? <Stars value={b.rating} size="sm" /> : <span className="lbl muted">Unrated</span>}
                          {b.genre && <span className="lbl muted">{b.genre}</span>}
                          {dur !== null && dur >= 0 && <span className="lbl muted">Read in {plural(dur + 1, 'day')}</span>}
                          {b.pages && <span className="lbl muted">{b.pages} pages</span>}
                        </div>
                        {b.review ? (
                          <blockquote className="tl__review">{b.review.length > 360 ? b.review.slice(0, 360).trimEnd() + '…' : b.review}</blockquote>
                        ) : (
                          <button type="button" className="wish__addreason lbl muted" onClick={(e) => open(b.id, (e.currentTarget.closest('.tl__item') as HTMLElement)?.querySelector('.tl__cover'))}>
                            + Write a review
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
