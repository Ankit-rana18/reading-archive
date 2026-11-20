import { useEffect, useState } from 'react';
import { BookmarkCheck, NotebookPen } from 'lucide-react';
import type { Book } from '../types/book';
import { useLibrary } from '../hooks/useBooks';
import { useUI } from '../hooks/useUI';
import { todayISO } from '../lib/util';

/** Slider + page input + session logging + quick notes for a book being read. */
export function ReadingProgress({ book, compact }: { book: Book; compact?: boolean }) {
  const lib = useLibrary();
  const ui = useUI();
  const cur = book.currentPage ?? 0;
  const [page, setPage] = useState(cur);
  const [total, setTotal] = useState<string>(book.pages ? String(book.pages) : '');
  const [minutes, setMinutes] = useState('');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [quick, setQuick] = useState('');
  useEffect(() => setPage(book.currentPage ?? 0), [book.currentPage]);
  useEffect(() => setTotal(book.pages ? String(book.pages) : ''), [book.pages]);

  const pages = book.pages ?? 0;
  const pct = pages ? Math.min(100, (page / pages) * 100) : 0;
  const changed = page !== cur || !!minutes;

  const save = async () => {
    const p = Math.max(0, Math.round(page));
    const m = Number(minutes) || undefined;
    if (p === cur && !m) return;
    await lib.addSession(book.id, { date, fromPage: cur, toPage: p, minutes: m, note });
    setMinutes('');
    setNote('');
    ui.toast(p > cur ? `Logged ${p - cur} pages · now on page ${p}` : p < cur ? `Moved back to page ${p}` : 'Session logged');
  };

  const saveTotal = () => {
    const t = Math.round(Number(total));
    if (t > 0 && t !== book.pages) lib.updateBook(book.id, { pages: t });
  };

  const addQuick = () => {
    if (!quick.trim()) return;
    const stamp = `[${todayISO()}${page ? ` · p.${page}` : ''}] `;
    lib.updateBook(book.id, { notes: (book.notes ? book.notes + '\n\n' : '') + stamp + quick.trim() });
    setQuick('');
    ui.toast('Note added');
  };

  return (
    <div className={`rp ${compact ? 'rp--compact' : ''}`}>
      <div className="rp__row">
        <div className="rp__pct tnum" aria-live="polite">
          {pages ? (
            <>
              {pct.toFixed(pct % 1 && pct < 100 ? 1 : 0)}
              <small>%</small>
            </>
          ) : (
            <small className="rp__nopages">Add the page count to track progress</small>
          )}
        </div>
        <div className="rp__controls">
          <input
            type="range"
            className="range"
            min={0}
            max={pages || Math.max(page, 100)}
            value={page}
            disabled={!pages}
            aria-label="Current page"
            style={{ '--p': `${pct}%` } as React.CSSProperties}
            onChange={(e) => setPage(Number(e.target.value))}
          />
          <div className="rp__pages">
            <label className="field rp__field">
              <span>Current page</span>
              <input
                type="number"
                className="input"
                min={0}
                max={pages || undefined}
                value={page}
                onChange={(e) => setPage(Math.max(0, Math.min(pages || Infinity, Number(e.target.value) || 0)))}
              />
            </label>
            <label className="field rp__field">
              <span>Total pages</span>
              <input type="number" className="input" min={1} value={total} placeholder="—" onChange={(e) => setTotal(e.target.value)} onBlur={saveTotal} />
            </label>
            <label className="field rp__field">
              <span>Minutes (optional)</span>
              <input type="number" className="input" min={0} value={minutes} placeholder="—" onChange={(e) => setMinutes(e.target.value)} />
            </label>
            <label className="field rp__field">
              <span>Session date</span>
              <input type="date" className="input" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value || todayISO())} />
            </label>
          </div>
          {!compact && (
            <label className="field">
              <span>Session note (optional)</span>
              <input className="input" value={note} placeholder="Where you read, what struck you…" onChange={(e) => setNote(e.target.value)} />
            </label>
          )}
          <div className="rp__actions">
            <button type="button" className="btn btn--accent" disabled={!changed} onClick={save}>
              Save progress
            </button>
            <button type="button" className="btn btn--solid" onClick={() => ui.openComplete(book.id)}>
              <BookmarkCheck size={12} /> Mark as completed
            </button>
          </div>
          {pages > 0 && page >= pages && (
            <p className="rp__hint">You’ve reached the last page. Mark the book as completed when you’re ready.</p>
          )}
        </div>
      </div>
      {!compact && (
        <form
          className="rp__quick"
          onSubmit={(e) => {
            e.preventDefault();
            addQuick();
          }}
        >
          <NotebookPen size={14} className="muted" aria-hidden="true" />
          <input className="input" value={quick} placeholder="Jot a note while reading…" onChange={(e) => setQuick(e.target.value)} aria-label="Quick note" />
          <button type="submit" className="btn btn--sm" disabled={!quick.trim()}>
            Add note
          </button>
        </form>
      )}
    </div>
  );
}
