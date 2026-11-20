import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpRight, BookmarkCheck, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { Book, ReadingStatus } from '../types/book';
import { PRIORITY_LABEL, STATUS_LABEL } from '../types/book';
import { useLibrary } from '../hooks/useBooks';
import { useUI } from '../hooks/useUI';
import { useCover } from '../hooks/useCover';
import { daysBetween, fmtDate, fmtDuration, minutesToRead, plural, prefersReducedMotion, progressOf, todayISO } from '../lib/util';
import { GeneratedCover } from './BookCover';
import { Line, Rise } from './MaskText';
import { ProgressBar, Stars } from './ui';
import { ReadingProgress } from './ReadingProgress';

const SHEET = 'cubic-bezier(.76,0,.18,1)';

const BLOBS = [
  [150, 330, 0],
  [340, 600, 120],
  [250, 120, 220],
  [90, 760, 300],
  [400, 250, 360],
  [260, 860, 420],
  [230, 470, 180],
].map(([x, y, d]) => [x * (600 / 474), y, d]);

/** The cover printed onto the sheet with spreading ink blots. */
function InkPoster({ book, run }: { book: Book; run: number }) {
  const url = useCover(book);
  const [broken, setBroken] = useState(false);
  const raw = useId().replace(/[^a-zA-Z0-9]/g, '');
  const ids = { mask: `ink-m-${raw}`, filter: `ink-f-${raw}`, clip: `ink-c-${raw}` };
  const circles = useRef<(SVGCircleElement | null)[]>([]);

  useEffect(() => {
    setBroken(false);
  }, [url]);

  useEffect(() => {
    circles.current.forEach((c) => c?.setAttribute('r', '0'));
    const reduce = prefersReducedMotion();
    const t0 = performance.now() + (reduce ? -5000 : 520);
    let raf = 0;
    const tick = (now: number) => {
      let done = true;
      BLOBS.forEach(([, , delay], i) => {
        const p = Math.max(0, Math.min(1, (now - t0 - delay) / 1250));
        if (p < 1) done = false;
        const e = 1 - Math.pow(1 - p, 3);
        circles.current[i]?.setAttribute('r', String(e * 760));
      });
      if (!done && now - t0 < 2600) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run]);

  return (
    <svg className="poster__svg" viewBox="0 0 600 900" aria-hidden="true">
      <defs>
        <filter id={ids.filter} filterUnits="userSpaceOnUse" x="-200" y="-200" width="1000" height="1300">
          <feTurbulence type="fractalNoise" baseFrequency="0.011" numOctaves="3" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="120" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <mask id={ids.mask} maskUnits="userSpaceOnUse" x="-200" y="-200" width="1000" height="1300">
          <g filter={`url(#${ids.filter})`}>
            {BLOBS.map(([cx, cy], i) => (
              <circle key={i} ref={(el) => (circles.current[i] = el)} cx={cx} cy={cy} r="0" fill="#fff" />
            ))}
          </g>
        </mask>
        <clipPath id={ids.clip}>
          <rect width="600" height="900" rx="4" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${ids.clip})`}>
        <g mask={`url(#${ids.mask})`}>
          {url && !broken ? (
            <image href={url} width="600" height="900" preserveAspectRatio="xMidYMid slice" onError={() => setBroken(true)} />
          ) : (
            <foreignObject width="600" height="900">
              <div className="poster__gen">
                <GeneratedCover book={book} />
              </div>
            </foreignObject>
          )}
        </g>
      </g>
    </svg>
  );
}

/** Click-to-edit long text. */
function EditableText({
  value,
  placeholder,
  onSave,
  startEditing,
  rows = 5,
}: {
  value?: string;
  placeholder: string;
  onSave: (v: string) => void;
  startEditing?: boolean;
  rows?: number;
}) {
  const [editing, setEditing] = useState(!!startEditing);
  const [draft, setDraft] = useState(value ?? '');
  const ta = useRef<HTMLTextAreaElement>(null);
  useEffect(() => setDraft(value ?? ''), [value]);
  useEffect(() => {
    if (startEditing) setEditing(true);
  }, [startEditing]);
  useEffect(() => {
    if (editing) ta.current?.focus({ preventScroll: false });
  }, [editing]);
  if (!editing) {
    return (
      <div className="editable">
        {value ? <p className="editable__text">{value}</p> : <p className="editable__empty">{placeholder}</p>}
        <button type="button" className="btn btn--sm btn--ghost editable__edit" onClick={() => setEditing(true)}>
          <Pencil size={11} /> {value ? 'Edit' : 'Write'}
        </button>
      </div>
    );
  }
  const save = () => {
    onSave(draft.trim());
    setEditing(false);
  };
  return (
    <div className="editable is-editing">
      <textarea
        ref={ta}
        className="textarea"
        rows={rows}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save();
          if (e.key === 'Escape') {
            e.stopPropagation();
            setDraft(value ?? '');
            setEditing(false);
          }
        }}
      />
      <div className="editable__actions">
        <button type="button" className="btn btn--sm" onClick={() => (setDraft(value ?? ''), setEditing(false))}>
          Cancel
        </button>
        <button type="button" className="btn btn--sm btn--solid" onClick={save}>
          Save
        </button>
      </div>
    </div>
  );
}

/** A list of short entries (quotes, lessons). */
function ListEditor({ items, onChange, placeholder, quote }: { items: string[]; onChange: (v: string[]) => void; placeholder: string; quote?: boolean }) {
  const [draft, setDraft] = useState('');
  return (
    <div className="listed">
      {items.length > 0 && (
        <ol className={`listed__items ${quote ? 'listed__items--quote' : ''}`}>
          {items.map((it, i) => (
            <li key={i}>
              <span>{it}</span>
              <button type="button" className="listed__rm" aria-label="Remove" onClick={() => onChange(items.filter((_, j) => j !== i))}>
                <X size={12} />
              </button>
            </li>
          ))}
        </ol>
      )}
      <form
        className="listed__add"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          onChange([...items, draft.trim()]);
          setDraft('');
        }}
      >
        <input className="input" value={draft} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)} />
        <button type="submit" className="btn btn--sm" disabled={!draft.trim()}>
          <Plus size={11} /> Add
        </button>
      </form>
    </div>
  );
}

function Block({ title, children, id, wide }: { title: string; children: ReactNode; id?: string; wide?: boolean }) {
  return (
    <section className={`xp__block ${wide ? 'xp__block--wide' : ''}`} id={id}>
      <h3 className="xp__title lbl">{title}</h3>
      {children}
    </section>
  );
}

export function BookDetail() {
  const ui = useUI();
  const lib = useLibrary();
  const d = ui.detail;
  const book = d ? lib.books.find((b) => b.id === d.id) : undefined;
  const layer = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [run, setRun] = useState(0);
  const [statusMenu, setStatusMenu] = useState(false);
  const [notesFocus, setNotesFocus] = useState(0);
  const closing = useRef(false);
  const lastId = useRef<string | null>(null);

  // Open: the sheet grows out of the cover.
  useLayoutEffect(() => {
    if (!d || !layer.current) return;
    const el = layer.current;
    const reduce = prefersReducedMotion();
    const W = window.innerWidth;
    const Hh = window.innerHeight;
    const r = d.origin.getRect?.() ?? null;
    const tilt = d.origin.tilt ?? -4.5;
    closing.current = false;
    setStatusMenu(false);
    setNotesFocus(0);
    scroller.current?.scrollTo(0, 0);
    if (lastId.current !== null && lastId.current !== d.id) {
      // switched book inside the detail: re-run reveals only
      setRun((n) => n + 1);
      lastId.current = d.id;
      return;
    }
    lastId.current = d.id;
    setRun((n) => n + 1);
    const from = r
      ? `inset(${r.top}px ${W - r.right}px ${Hh - r.bottom}px ${r.left}px round 3px)`
      : `inset(${Hh * 0.3}px ${W * 0.35}px ${Hh * 0.3}px ${W * 0.35}px round 3px)`;
    const origin = r ? `${r.left + r.width / 2}px ${r.top + r.height / 2}px` : '50% 50%';
    el.style.transformOrigin = origin;
    el.style.visibility = 'visible';
    el.getAnimations().forEach((a) => a.cancel());
    el.animate(
      [
        { clipPath: from, transform: `rotate(${r ? tilt : 0}deg)` },
        { clipPath: 'inset(0px 0px 0px 0px round 0px)', transform: 'rotate(0deg)' },
      ],
      { duration: reduce ? 1 : 1050, easing: SHEET, fill: 'both' },
    );
    document.body.classList.add('lock');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d?.id, d]);

  const close = (animated = true) => {
    const el = layer.current;
    if (!el || closing.current) return;
    closing.current = true;
    const reduce = prefersReducedMotion();
    const W = window.innerWidth;
    const Hh = window.innerHeight;
    let r = animated ? d?.origin.getRect?.() ?? null : null;
    if (r && (r.width < 4 || r.bottom < 0 || r.top > Hh)) r = null;
    const to = r
      ? `inset(${r.top}px ${W - r.right}px ${Hh - r.bottom}px ${r.left}px round 3px)`
      : `inset(${Hh / 2}px ${W / 2}px ${Hh / 2}px ${W / 2}px round 3px)`;
    if (r) el.style.transformOrigin = `${r.left + r.width / 2}px ${r.top + r.height / 2}px`;
    el.getAnimations().forEach((a) => a.cancel());
    const a = el.animate(
      [
        { clipPath: 'inset(0px 0px 0px 0px round 0px)', transform: 'rotate(0deg)' },
        { clipPath: to, transform: `rotate(${r ? d?.origin.tilt ?? -4.5 : 0}deg)` },
      ],
      { duration: reduce ? 1 : 850, easing: SHEET, fill: 'both' },
    );
    a.onfinish = () => {
      el.style.visibility = 'hidden';
      el.getAnimations().forEach((x) => x.cancel());
      lastId.current = null;
      if (!document.querySelector('.modal-layer')) document.body.classList.remove('lock');
      ui.closeDetail();
    };
  };

  // Escape closes (unless a modal above handles it first).
  useEffect(() => {
    if (!d) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('.modal-layer')) close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Book deleted while open.
  useEffect(() => {
    if (d && lib.loaded && !book && !closing.current) close(false);
  });

  // Focus request (e.g. "Add notes").
  useEffect(() => {
    if (d?.focus === 'notes') setTimeout(() => setNotesFocus((n) => n + 1), 900);
  }, [d?.focus, d?.id]);

  if (!d || !book) {
    return createPortal(<div ref={layer} className="detail" style={{ visibility: 'hidden' }} aria-hidden="true" />, document.body);
  }

  const patch = (p: Partial<Book>) => lib.updateBook(book.id, p);
  const sessions = lib.sessions.filter((s) => s.bookId === book.id).sort((a, b) => (a.date < b.date ? 1 : -1));
  const duration = daysBetween(book.dateStarted, book.dateCompleted);
  const est = minutesToRead(book.pages);
  const meta = [book.year, book.genre, book.pages && `${book.pages} pages`, book.publisher].filter(Boolean).join(' / ');
  const statusLine =
    book.status === 'reading'
      ? `Currently reading${book.pages ? ` · ${Math.round(progressOf(book) * 100)}%` : ''}`
      : book.status === 'read'
        ? `Read${book.dateCompleted ? ` · ${fmtDate(book.dateCompleted)}` : ''}`
        : `Want to read${book.priority ? ` · ${PRIORITY_LABEL[book.priority]}` : ''}`;

  const changeStatus = (s: ReadingStatus) => {
    setStatusMenu(false);
    if (s === book.status) return;
    if (s === 'read') ui.openComplete(book.id);
    else lib.setStatus(book.id, s).then(() => ui.toast(`Moved to ${STATUS_LABEL[s]}`));
  };

  const remove = async () => {
    const ok = await ui.confirm({
      title: `Delete “${book.title}”?`,
      body: 'This removes the book, its notes, quotes and reading sessions from your archive. It cannot be undone unless you have a backup.',
      confirmLabel: 'Delete book',
      danger: true,
    });
    if (!ok) return;
    await lib.deleteBook(book.id);
    ui.toast('Book deleted');
  };

  const focusNotes = () => {
    document.getElementById('xp-notes')?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
    setNotesFocus((n) => n + 1);
  };

  return createPortal(
    <div ref={layer} className="detail" role="dialog" aria-modal="true" aria-label={book.title}>
      <div className="detail__scroll" ref={scroller} data-no-shelf-wheel>
        <header className="detail__top">
          <button type="button" className="box lbl detail__close" onClick={() => close()}>
            Close <X size={11} strokeWidth={1.6} />
          </button>
          <div className="logo logo--center" aria-hidden="true">
            <span className="logo__mark">The Reading Archive</span>
            <span className="logo__sub">Every book leaves a mark</span>
          </div>
          <span className="lbl muted detail__topright">{STATUS_LABEL[book.status]}</span>
        </header>

        <div className="detail__hero">
          <div className="detail__poster">
            <div className="poster" key={book.id}>
              <InkPoster book={book} run={run} />
            </div>
          </div>
          <Rise className="detail__info" delay={620} trigger={`${book.id}-${run}`}>
            <Line className="lbl cobalt">{statusLine}</Line>
            <Line as="h2" className="detail__title">
              {book.title}
            </Line>
            <Line className="detail__author">by {book.author}</Line>
            {meta && <Line className="lbl muted detail__meta">{meta}</Line>}
            <Line className="detail__rating">
              <Stars value={book.rating} onChange={(v) => patch({ rating: v })} label="Your rating" />
              <span className="lbl muted">{book.rating ? `${book.rating} / 5` : 'Not rated yet'}</span>
            </Line>
            {book.description && (
              <Line className="detail__desc">
                <Desc text={book.description} />
              </Line>
            )}
            <Line className="detail__actions">
              <span className="detail__actions-inner">
                <button type="button" className="btn btn--cobalt" onClick={() => ui.openEdit(book.id)}>
                  <Pencil size={12} /> Edit book
                </button>
                <button type="button" className="btn" onClick={focusNotes}>
                  <Plus size={12} /> Add notes
                </button>
                <span className="menu-anchor">
                  <button type="button" className="btn" aria-expanded={statusMenu} onClick={() => setStatusMenu((v) => !v)}>
                    <ArrowUpRight size={12} /> Change status
                  </button>
                  {statusMenu && (
                    <span className="menu" role="menu">
                      {(['reading', 'read', 'want'] as ReadingStatus[]).map((s) => (
                        <button key={s} type="button" role="menuitemradio" aria-checked={book.status === s} className="menu__item lbl" onClick={() => changeStatus(s)}>
                          <i className={`status-dot status-dot--${s}`} />
                          {STATUS_LABEL[s]}
                        </button>
                      ))}
                    </span>
                  )}
                </span>
                {book.status === 'reading' && (
                  <button type="button" className="btn btn--solid" onClick={() => ui.openComplete(book.id)}>
                    <BookmarkCheck size={12} /> Mark completed
                  </button>
                )}
                <button type="button" className="btn btn--danger" onClick={remove}>
                  <Trash2 size={12} /> Delete book
                </button>
              </span>
            </Line>
          </Rise>
        </div>

        <section className="xp" aria-label="My reading experience">
          <header className="xp__head">
            <span className="lbl cobalt">My reading experience</span>
            <hr className="rule" />
          </header>

          <div className="xp__grid">
            <Block title="The record">
              <dl className="facts">
                <div>
                  <dt className="lbl muted">Status</dt>
                  <dd>
                    <i className={`status-dot status-dot--${book.status}`} />
                    {STATUS_LABEL[book.status]}
                  </dd>
                </div>
                <div>
                  <dt className="lbl muted">Started</dt>
                  <dd>
                    <input
                      type="date"
                      className="input input--plain"
                      value={book.dateStarted ?? ''}
                      max={todayISO()}
                      onChange={(e) => patch({ dateStarted: e.target.value || undefined })}
                    />
                  </dd>
                </div>
                <div>
                  <dt className="lbl muted">Completed</dt>
                  <dd>
                    {book.status === 'read' ? (
                      <input
                        type="date"
                        className="input input--plain"
                        value={book.dateCompleted ?? ''}
                        min={book.dateStarted}
                        onChange={(e) => patch({ dateCompleted: e.target.value || undefined })}
                      />
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
                {duration !== null && duration >= 0 && (
                  <div>
                    <dt className="lbl muted">Read in</dt>
                    <dd>{duration === 0 ? 'A single day' : plural(duration + 1, 'day')}</dd>
                  </div>
                )}
                {est && (
                  <div>
                    <dt className="lbl muted">Est. reading time</dt>
                    <dd>{fmtDuration(est)}</dd>
                  </div>
                )}
                {book.isbn && (
                  <div>
                    <dt className="lbl muted">ISBN</dt>
                    <dd className="tnum">{book.isbn}</dd>
                  </div>
                )}
                <div>
                  <dt className="lbl muted">Added</dt>
                  <dd>{fmtDate(book.addedAt.slice(0, 10))}</dd>
                </div>
              </dl>
              {book.status !== 'want' && book.pages ? (
                <div className="xp__progress">
                  <div className="xp__progress-top">
                    <span className="lbl">Progress</span>
                    <span className="tnum lbl muted">
                      {book.status === 'read' ? book.pages : book.currentPage ?? 0} / {book.pages}
                    </span>
                  </div>
                  <ProgressBar value={progressOf(book)} />
                </div>
              ) : null}
              {book.status === 'want' && (
                <div className="xp__want">
                  <span className="lbl muted">Why it’s on the list</span>
                  <EditableText value={book.reason} placeholder="A sentence on why you want to read it." onSave={(v) => patch({ reason: v || undefined })} rows={2} />
                </div>
              )}
            </Block>

            <Block title="Personal review">
              <EditableText
                value={book.review}
                placeholder={book.status === 'read' ? 'What stayed with you? Write your review.' : 'Your review, once you have something to say.'}
                onSave={(v) => patch({ review: v || undefined })}
                rows={7}
              />
            </Block>

            <Block title="Favourite quotes">
              <ListEditor items={book.quotes} onChange={(quotes) => patch({ quotes })} placeholder="A line worth keeping…" quote />
            </Block>

            <Block title="Important lessons">
              <ListEditor items={book.lessons} onChange={(lessons) => patch({ lessons })} placeholder="Something you learned…" />
            </Block>

            <Block title="Personal notes" id="xp-notes" wide>
              <EditableText
                key={`notes-${notesFocus}`}
                value={book.notes}
                placeholder="Marginalia, thoughts, connections to other books."
                onSave={(v) => patch({ notes: v || undefined })}
                startEditing={notesFocus > 0}
                rows={8}
              />
            </Block>

            {book.status === 'reading' && (
              <Block title="Update progress" wide>
                <ReadingProgress book={book} compact />
              </Block>
            )}

            <Block title={`Reading sessions${sessions.length ? ` · ${sessions.length}` : ''}`} wide>
              {sessions.length === 0 ? (
                <p className="editable__empty">
                  {book.status === 'want' ? 'Sessions appear here once you start reading.' : 'No sessions recorded yet. Log one from Reading Now or the progress panel.'}
                </p>
              ) : (
                <table className="sessions">
                  <thead>
                    <tr className="lbl muted">
                      <th>Date</th>
                      <th>Pages</th>
                      <th>Time</th>
                      <th>Note</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr key={s.id}>
                        <td className="tnum">{fmtDate(s.date)}</td>
                        <td className="tnum">
                          {s.pages > 0 ? `+${s.pages}` : '—'}
                          {s.toPage !== undefined && <span className="muted"> · to p.{s.toPage}</span>}
                        </td>
                        <td className="tnum">{s.minutes ? fmtDuration(s.minutes) : '—'}</td>
                        <td className="sessions__note">{s.note ?? ''}</td>
                        <td>
                          <button
                            type="button"
                            className="listed__rm"
                            aria-label="Delete session"
                            onClick={async () => {
                              if (await ui.confirm({ title: 'Delete this session?', body: `${fmtDate(s.date)} · ${s.pages} pages`, confirmLabel: 'Delete', danger: true }))
                                lib.deleteSession(s.id);
                            }}
                          >
                            <X size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Block>
          </div>
        </section>
      </div>
    </div>,
    document.body,
  );
}

function Desc({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 420;
  return (
    <span className="desc">
      <span className={`desc__text ${long && !open ? 'is-clamped' : ''}`}>{text}</span>
      {long && (
        <button type="button" className="lbl cobalt desc__more" onClick={() => setOpen((v) => !v)}>
          {open ? 'Show less' : 'Read more'}
        </button>
      )}
    </span>
  );
}
