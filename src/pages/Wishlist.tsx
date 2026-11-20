import { useMemo, useState } from 'react';
import { BookOpen, Plus } from 'lucide-react';
import type { Book, Priority } from '../types/book';
import { PRIORITY_LABEL } from '../types/book';
import { useLibrary } from '../hooks/useBooks';
import { useUI } from '../hooks/useUI';
import { usePrefs } from '../hooks/usePrefs';
import { PageHead } from '../components/ui';
import { BookCover } from '../components/BookCover';
import { SearchBar } from '../components/FilterPanel';
import { useOpenFromEl } from '../components/BookCard';
import { fmtDuration, minutesToRead, numWord } from '../lib/util';
import { matchField } from '../lib/filter';

type WSort = 'priority' | 'added' | 'alpha' | 'author' | 'short' | 'long';
const PR: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

export function Wishlist() {
  const { books, setStatus, updateBook } = useLibrary();
  const ui = useUI();
  const { prefs } = usePrefs();
  const open = useOpenFromEl();
  const [q, setQ] = useState('');
  const [genre, setGenre] = useState('');
  const [prio, setPrio] = useState<Priority | ''>('');
  const [sort, setSort] = useState<WSort>('priority');

  const want = useMemo(() => books.filter((b) => b.status === 'want'), [books]);
  const genres = useMemo(() => Array.from(new Set(want.map((b) => b.genre).filter(Boolean) as string[])).sort(), [want]);
  const shown = useMemo(() => {
    const list = want.filter((b) => (!q.trim() || matchField(b, q)) && (!genre || b.genre === genre) && (!prio || (b.priority ?? 'medium') === prio));
    const by: Record<WSort, (a: Book, b: Book) => number> = {
      priority: (a, b) => PR[a.priority ?? 'medium'] - PR[b.priority ?? 'medium'] || b.addedAt.localeCompare(a.addedAt),
      added: (a, b) => b.addedAt.localeCompare(a.addedAt),
      alpha: (a, b) => a.title.localeCompare(b.title),
      author: (a, b) => a.author.localeCompare(b.author),
      short: (a, b) => (a.pages ?? 1e9) - (b.pages ?? 1e9),
      long: (a, b) => (b.pages ?? -1) - (a.pages ?? -1),
    };
    return list.sort(by[sort]);
  }, [want, q, genre, prio, sort]);

  const totalMins = want.reduce((n, b) => n + (minutesToRead(b.pages) ?? 0), 0);
  const start = async (b: Book) => {
    await setStatus(b.id, 'reading');
    ui.toast(`“${b.title}” is now on your desk`);
  };

  return (
    <main className="page">
      <PageHead
        kicker="03 — Want to Read"
        title={
          <>
            Future <em>journeys</em>
          </>
        }
        dek={
          want.length
            ? `${numWord(want.length)} ${want.length === 1 ? 'book' : 'books'} waiting${totalMins ? ` — roughly ${fmtDuration(totalMins)} of reading, where page counts are known` : ''}.`
            : 'A wishlist of books you mean to read. It starts with one title.'
        }
        aside={
          <button type="button" className="btn btn--solid" onClick={() => ui.openAdd('want')}>
            <Plus size={13} /> Add to wishlist
          </button>
        }
      />

      {want.length > 0 && (
        <>
          <div className="toolbar">
            <div className="spanel__chips" role="group" aria-label="Priority">
              <button type="button" className="chip" aria-pressed={prio === ''} onClick={() => setPrio('')}>
                All
              </button>
              {(['high', 'medium', 'low'] as Priority[]).map((p) => (
                <button key={p} type="button" className="chip" aria-pressed={prio === p} onClick={() => setPrio(prio === p ? '' : p)}>
                  {PRIORITY_LABEL[p]}
                </button>
              ))}
            </div>
            <SearchBar value={q} onChange={setQ} placeholder="Search the wishlist…" />
            <div className="toolbar__spacer" />
            <label className="sortsel lbl muted">
              Sort
              <select className="select select--sm" value={sort} onChange={(e) => setSort(e.target.value as WSort)}>
                <option value="priority">Priority</option>
                <option value="added">Recently added</option>
                <option value="alpha">Alphabetical</option>
                <option value="author">Author</option>
                <option value="short">Shortest first</option>
                <option value="long">Longest first</option>
              </select>
            </label>
          </div>
          {genres.length > 0 && (
            <div className="toolbar toolbar--filters">
              <div className="spanel__chips" role="group" aria-label="Genre">
                <button type="button" className="chip" aria-pressed={!genre} onClick={() => setGenre('')}>
                  Every genre
                </button>
                {genres.map((g) => (
                  <button key={g} type="button" className="chip" aria-pressed={genre === g} onClick={() => setGenre(genre === g ? '' : g)}>
                    {g}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {want.length === 0 ? (
        <div className="empty">
          <p className="empty__title">Every book on the wishlist is a future journey.</p>
          <button type="button" className="btn btn--solid" onClick={() => ui.openAdd('want')}>
            <Plus size={13} /> Add a book you want to read
          </button>
        </div>
      ) : shown.length === 0 ? (
        <div className="empty">
          <p className="empty__title">Nothing matches.</p>
        </div>
      ) : (
        <ol className="wish">
          {shown.map((b, i) => {
            const mins = minutesToRead(b.pages);
            const p = b.priority ?? 'medium';
            return (
              <li key={b.id} className="wish__item">
                <span className="wish__no lbl muted tnum">{String(i + 1).padStart(2, '0')}</span>
                <button type="button" className="wish__cover is-liftable" onClick={(e) => open(b.id, e.currentTarget)} data-cursor="view" aria-label={`Open ${b.title}`}>
                  <BookCover book={b} />
                </button>
                <div className="wish__body">
                  <div className="wish__top">
                    <label className={`prio prio--${p} lbl`}>
                      <span className="sr-only">Priority</span>
                      <select value={p} onChange={(e) => updateBook(b.id, { priority: e.target.value as Priority })}>
                        <option value="high">High priority</option>
                        <option value="medium">Medium priority</option>
                        <option value="low">Low priority</option>
                      </select>
                    </label>
                    {b.genre && <span className="lbl muted">{b.genre}</span>}
                  </div>
                  <h2 className="wish__title">{b.title}</h2>
                  <p className="wish__author">by {b.author}</p>
                  {b.reason ? (
                    <blockquote className="wish__reason">{b.reason}</blockquote>
                  ) : (
                    <button type="button" className="wish__addreason lbl muted" onClick={() => ui.openEdit(b.id)}>
                      + Note why you want to read it
                    </button>
                  )}
                  <div className="wish__foot">
                    <span className="lbl muted">
                      {[b.year, b.pages && `${b.pages} pages`, mins && `≈ ${fmtDuration(mins)}`, mins && prefs.dailyPageGoal > 0 && b.pages && `${Math.ceil(b.pages / prefs.dailyPageGoal)} days at your pace`]
                        .filter(Boolean)
                        .join(' · ') || 'Add a page count for a reading-time estimate'}
                    </span>
                    <button type="button" className="btn btn--cobalt btn--sm" onClick={() => start(b)}>
                      <BookOpen size={12} /> Start reading
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}
