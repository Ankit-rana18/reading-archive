import { useMemo, useState } from 'react';
import { Flame, Plus, Target } from 'lucide-react';
import { useLibrary } from '../hooks/useBooks';
import { useUI } from '../hooks/useUI';
import { usePrefs } from '../hooks/usePrefs';
import { PageHead, ProgressBar } from '../components/ui';
import { BookCover } from '../components/BookCover';
import { ReadingProgress } from '../components/ReadingProgress';
import { useOpenFromEl } from '../components/BookCard';
import { daysBetween, fmtDate, numWord, plural, streaks, todayISO } from '../lib/util';

export function ReadingNow() {
  const { books, sessions } = useLibrary();
  const ui = useUI();
  const { prefs, setPrefs } = usePrefs();
  const open = useOpenFromEl();
  const reading = useMemo(() => books.filter((b) => b.status === 'reading').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [books]);
  const today = todayISO();
  const pagesToday = sessions.filter((s) => s.date === today).reduce((n, s) => n + s.pages, 0);
  const st = streaks(sessions);
  const [goalDraft, setGoalDraft] = useState<string | null>(null);
  const goal = prefs.dailyPageGoal;

  return (
    <main className="page">
      <PageHead
        kicker="02 — Reading Now"
        title={
          <>
            On the <em>desk</em>
          </>
        }
        dek={reading.length ? `${numWord(reading.length)} ${reading.length === 1 ? 'book' : 'books'} open. Log where you are and the archive keeps the rest.` : 'No book is open right now.'}
        aside={
          <button type="button" className="btn btn--solid" onClick={() => ui.openAdd('reading')}>
            <Plus size={13} /> Start a book
          </button>
        }
      />

      <section className="today" aria-label="Today">
        <div className="today__cell">
          <span className="lbl muted">
            <Target size={12} /> Today’s pages
          </span>
          <span className="today__num tnum">
            {pagesToday}
            <small> / {goal || '—'}</small>
          </span>
          <ProgressBar value={goal ? Math.min(1, pagesToday / goal) : 0} />
        </div>
        <div className="today__cell">
          <span className="lbl muted">Daily goal</span>
          {goalDraft === null ? (
            <button type="button" className="today__goal" onClick={() => setGoalDraft(String(goal || ''))}>
              {goal ? `${goal} pages a day` : 'Set a goal'} <span className="lbl accent">Edit</span>
            </button>
          ) : (
            <form
              className="today__goalform"
              onSubmit={(e) => {
                e.preventDefault();
                setPrefs({ dailyPageGoal: Math.max(0, Math.round(Number(goalDraft) || 0)) });
                setGoalDraft(null);
              }}
            >
              <input className="input" type="number" min={0} autoFocus value={goalDraft} onChange={(e) => setGoalDraft(e.target.value)} aria-label="Pages per day" />
              <button className="btn btn--sm btn--solid" type="submit">
                Save
              </button>
            </form>
          )}
        </div>
        <div className="today__cell">
          <span className="lbl muted">
            <Flame size={12} /> Current streak
          </span>
          <span className="today__num tnum">
            {st.current}
            <small> {st.current === 1 ? 'day' : 'days'}</small>
          </span>
          <span className="lbl muted">Longest: {plural(st.longest, 'day')}</span>
        </div>
      </section>

      {reading.length === 0 ? (
        <div className="empty">
          <p className="empty__title">The desk is clear.</p>
          <p className="empty__body">Start a book from your wishlist, or add a new one you have just opened.</p>
          <div className="confirm__actions">
            <a className="btn" href="#/wishlist">
              Open the wishlist
            </a>
            <button type="button" className="btn btn--solid" onClick={() => ui.openAdd('reading')}>
              <Plus size={13} /> Add a book
            </button>
          </div>
        </div>
      ) : (
        <ol className="desk">
          {reading.map((b) => {
            const bs = sessions.filter((s) => s.bookId === b.id);
            const bst = streaks(bs);
            const days = daysBetween(b.dateStarted, today);
            const left = b.pages ? Math.max(0, b.pages - (b.currentPage ?? 0)) : null;
            return (
              <li key={b.id} className="desk__item">
                <button type="button" className="desk__cover is-liftable" onClick={(e) => open(b.id, e.currentTarget)} data-cursor="view" aria-label={`Open ${b.title}`}>
                  <BookCover book={b} />
                </button>
                <div className="desk__body">
                  <header className="desk__head">
                    <div>
                      <h2 className="desk__title">{b.title}</h2>
                      <p className="desk__author">by {b.author}</p>
                    </div>
                    <dl className="desk__facts">
                      <div>
                        <dt className="lbl muted">Started</dt>
                        <dd>{fmtDate(b.dateStarted)}</dd>
                      </div>
                      <div>
                        <dt className="lbl muted">Reading for</dt>
                        <dd>{days !== null ? plural(Math.max(1, days + 1), 'day') : '—'}</dd>
                      </div>
                      <div>
                        <dt className="lbl muted">Streak</dt>
                        <dd>{bs.length ? plural(bst.current, 'day') : 'No sessions yet'}</dd>
                      </div>
                      <div>
                        <dt className="lbl muted">Pages left</dt>
                        <dd>{left !== null ? left : '—'}</dd>
                      </div>
                      {left !== null && goal > 0 && left > 0 && (
                        <div>
                          <dt className="lbl muted">At your goal</dt>
                          <dd>{plural(Math.ceil(left / goal), 'more day')}</dd>
                        </div>
                      )}
                    </dl>
                  </header>
                  <ReadingProgress book={b} />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}
