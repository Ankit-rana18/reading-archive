import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Loader2, Search } from 'lucide-react';
import type { Book } from '../types/book';
import { useLibrary } from '../hooks/useBooks';
import { useUI } from '../hooks/useUI';
import { resultDetails, searchBooks, type Edition, type SearchField, type SearchResult, type Source } from '../services/bookAPI';
import { BookForm, emptyValues, toInput, valuesFromBook, type FormValues } from './BookForm';
import { BookCover } from './BookCover';
import { Modal, Tabs } from './ui';
import { STATUS_LABEL } from '../types/book';

type Step = { kind: 'search' } | { kind: 'details'; result: SearchResult } | { kind: 'form'; values: FormValues };

/** Add (search online / manual) and edit books. */
export function AddBookModal() {
  const ui = useUI();
  const lib = useLibrary();
  const ed = ui.editor;
  const editing = ed?.mode === 'edit' ? lib.getBook(ed.id) : undefined;
  const [tab, setTab] = useState<'search' | 'manual'>('search');
  const [step, setStep] = useState<Step>({ kind: 'search' });
  const [dup, setDup] = useState<Book | null>(null);
  const [saving, setSaving] = useState(false);
  const status = ed?.mode === 'add' ? ed.status ?? 'want' : 'want';

  useEffect(() => {
    if (!ed) return;
    setDup(null);
    setSaving(false);
    setTab('search');
    setStep({ kind: 'search' });
  }, [ed]);

  const manualInitial = useMemo(() => emptyValues(status), [status, ed]);
  const editInitial = useMemo(() => (editing ? valuesFromBook(editing) : null), [editing?.id, ed]);

  const save = async (v: FormValues, cover: Blob | null | undefined) => {
    if (saving) return;
    const input = toInput(v);
    const existing = lib.findDuplicate(input, editing?.id);
    if (existing) {
      setDup(existing);
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const { quotes, lessons, ...rest } = input;
        await lib.updateBook(editing.id, { ...rest, ...(quotes ? { quotes } : {}), ...(lessons ? { lessons } : {}) }, cover);
        ui.toast('Changes saved');
      } else {
        const b = await lib.addBook(input, cover ?? null);
        ui.toast(`Added to ${STATUS_LABEL[b.status]}`);
      }
      ui.closeEditor();
    } catch (e) {
      ui.toast(`Could not save the book: ${(e as Error).message}`, 'error');
      setSaving(false);
    }
  };

  const dupMsg = dup && (
    <>
      <span>
        “{dup.title}” by {dup.author} is already in your archive ({STATUS_LABEL[dup.status]}).
      </span>
      <button
        type="button"
        className="btn btn--sm"
        onClick={() => {
          ui.closeEditor();
          ui.openDetail(dup.id);
        }}
      >
        Open it
      </button>
    </>
  );

  const open = !!ed && (ed.mode === 'add' || !!editing);
  const title = editing ? 'Edit book' : 'Add a book';

  return (
    <Modal open={open} onClose={ui.closeEditor} title={title} kicker={editing ? editing.title : 'The Reading Archive'} width={1040} className="addbook">
      {editing && editInitial ? (
        <BookForm initial={editInitial} existing={editing} onSubmit={save} submitLabel="Save changes" error={dupMsg} />
      ) : (
        <>
          {step.kind !== 'form' && (
            <div className="addbook__tabs">
              <Tabs
                label="How to add"
                value={tab}
                onChange={(t) => {
                  setTab(t);
                  setDup(null);
                }}
                items={[
                  { value: 'search', label: 'Search online' },
                  { value: 'manual', label: 'Manual entry' },
                ]}
              />
            </div>
          )}
          {tab === 'manual' && step.kind !== 'form' && <BookForm initial={manualInitial} onSubmit={save} submitLabel="Add to archive" error={dupMsg} />}
          {tab === 'search' && step.kind === 'search' && (
            <SearchPanel
              onPick={(r) => setStep({ kind: 'details', result: r })}
              onManual={() => setTab('manual')}
              isOwned={(r) => !!lib.findDuplicate({ title: r.title, author: r.author, isbn: r.isbn })}
            />
          )}
          {tab === 'search' && step.kind === 'details' && (
            <EditionPanel
              result={step.result}
              onBack={() => setStep({ kind: 'search' })}
              onUse={(values) => {
                setDup(null);
                setStep({ kind: 'form', values: { ...values, status } });
              }}
            />
          )}
          {step.kind === 'form' && (
            <BookForm
              initial={step.values}
              onSubmit={save}
              submitLabel="Add to archive"
              error={dupMsg}
              extraActions={
                <button type="button" className="btn btn--ghost" onClick={() => setStep({ kind: 'search' })}>
                  <ArrowLeft size={12} /> Back to results
                </button>
              }
            />
          )}
        </>
      )}
    </Modal>
  );
}

/* ---------------- search ---------------- */

const lastSearch = { q: '', field: 'any' as SearchField, source: 'openlibrary' as Source, results: [] as SearchResult[] };

function SearchPanel({ onPick, onManual, isOwned }: { onPick: (r: SearchResult) => void; onManual: () => void; isOwned: (r: SearchResult) => boolean }) {
  const [q, setQ] = useState(lastSearch.q);
  const [field, setField] = useState<SearchField>(lastSearch.field);
  const [source, setSource] = useState<Source>(lastSearch.source);
  const [results, setResults] = useState<SearchResult[]>(lastSearch.results);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(lastSearch.results.length > 0);
  const ctrl = useRef<AbortController | null>(null);

  const run = (query = q) => {
    ctrl.current?.abort();
    if (query.trim().length < 2) {
      setResults([]);
      setSearched(false);
      setError(null);
      return;
    }
    const c = new AbortController();
    ctrl.current = c;
    setLoading(true);
    setError(null);
    searchBooks(query, field, source, c.signal)
      .then((r) => {
        setResults(r);
        setSearched(true);
        Object.assign(lastSearch, { q: query, field, source, results: r });
      })
      .catch((e: Error) => e.name !== 'AbortError' && setError(e.message))
      .finally(() => !c.signal.aborted && setLoading(false));
  };

  useEffect(() => {
    if (q === lastSearch.q && field === lastSearch.field && source === lastSearch.source && lastSearch.results.length) return;
    const t = setTimeout(() => run(), 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, field, source]);
  useEffect(() => () => ctrl.current?.abort(), []);

  return (
    <div className="spanel">
      <form
        className="spanel__bar"
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
      >
        <Search size={18} strokeWidth={1.4} aria-hidden="true" />
        <input
          className="spanel__input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={field === 'isbn' ? 'ISBN, e.g. 9780141439518' : field === 'author' ? 'Author name' : 'Title, author or ISBN'}
          aria-label="Search for a book"
          autoFocus
        />
        {loading && <Loader2 size={16} className="spin" aria-label="Searching" />}
      </form>
      <div className="spanel__opts">
        <div className="spanel__chips" role="group" aria-label="Search by">
          {(['any', 'title', 'author', 'isbn'] as SearchField[]).map((f) => (
            <button key={f} type="button" className="chip" aria-pressed={field === f} onClick={() => setField(f)}>
              {f === 'any' ? 'Anything' : f === 'isbn' ? 'ISBN' : f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <label className="spanel__source lbl muted">
          Source
          <select className="select select--sm" value={source} onChange={(e) => setSource(e.target.value as Source)}>
            <option value="openlibrary">Open Library</option>
            <option value="google">Google Books</option>
          </select>
        </label>
      </div>

      {error && (
        <div className="spanel__state">
          <p className="empty__body">{error}</p>
          <div className="confirm__actions">
            <button type="button" className="btn" onClick={() => run()}>
              Try again
            </button>
            <button type="button" className="btn btn--cobalt" onClick={() => setSource(source === 'google' ? 'openlibrary' : 'google')}>
              Try {source === 'google' ? 'Open Library' : 'Google Books'}
            </button>
            <button type="button" className="btn btn--solid" onClick={onManual}>
              Enter manually
            </button>
          </div>
        </div>
      )}

      {!error && loading && results.length === 0 && (
        <div className="results">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="result result--skeleton" aria-hidden="true">
              <div className="result__cover" />
              <div className="result__text">
                <i />
                <i />
              </div>
            </div>
          ))}
        </div>
      )}

      {!error && !loading && searched && results.length === 0 && (
        <div className="spanel__state">
          <p className="empty__body">Nothing found for “{q}”. Try another spelling, switch source, or enter the book by hand.</p>
          <button type="button" className="btn btn--solid" onClick={onManual}>
            Enter manually
          </button>
        </div>
      )}

      {!error && results.length > 0 && (
        <ul className={`results ${loading ? 'is-loading' : ''}`}>
          {results.map((r) => {
            const owned = isOwned(r);
            return (
              <li key={`${r.source}-${r.id}`}>
                <button type="button" className="result is-liftable" onClick={() => onPick(r)} data-cursor="view" data-cursor-label="Select">
                  <BookCover book={{ title: r.title, author: r.author, year: r.year, coverUrl: r.coverUrl }} className="result__cover" />
                  <span className="result__text">
                    <span className="result__title">{r.title}</span>
                    <span className="result__author">{r.author}</span>
                    <span className="lbl muted">
                      {[r.year, r.editionCount && r.editionCount > 1 ? `${r.editionCount} editions` : null].filter(Boolean).join(' · ')}
                    </span>
                    {owned && <span className="lbl cobalt">In your archive</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!searched && !loading && !error && (
        <p className="spanel__hint muted">
          Search Open Library or Google Books. Pick a result to choose an edition and review the details before saving.
        </p>
      )}
    </div>
  );
}

/* ---------------- edition picker ---------------- */

function EditionPanel({ result, onBack, onUse }: { result: SearchResult; onBack: () => void; onUse: (v: FormValues) => void }) {
  const [state, setState] = useState<{ loading: boolean; description?: string; genre?: string; editions: Edition[]; error?: string }>({
    loading: true,
    editions: [],
  });

  useEffect(() => {
    const c = new AbortController();
    resultDetails(result, c.signal)
      .then((d) => setState({ loading: false, ...d }))
      .catch((e: Error) => e.name !== 'AbortError' && setState({ loading: false, editions: [], error: e.message }));
    return () => c.abort();
  }, [result]);

  const base = (): FormValues => ({
    ...emptyValues(),
    title: result.title,
    author: result.author,
    year: result.year ? String(result.year) : '',
    genre: state.genre ?? result.genre ?? '',
    isbn: result.isbn ?? '',
    publisher: result.publisher ?? '',
    pages: result.pages ? String(result.pages) : '',
    description: state.description ?? result.description ?? '',
    coverUrl: result.coverUrl ?? '',
    source: result.source,
    sourceId: result.id,
  });

  const useEdition = (e: Edition) => {
    const b = base();
    onUse({
      ...b,
      // keep the work's original publication year; take physical details from the edition
      publisher: e.publisher ?? b.publisher,
      pages: e.pages ? String(e.pages) : b.pages,
      isbn: e.isbn ?? b.isbn,
      coverUrl: e.coverUrl ?? b.coverUrl,
    });
  };

  return (
    <div className="epanel">
      <button type="button" className="btn btn--sm btn--ghost" onClick={onBack}>
        <ArrowLeft size={12} /> Results
      </button>
      <div className="epanel__work">
        <BookCover book={{ title: result.title, author: result.author, year: result.year, coverUrl: result.coverUrl }} className="epanel__cover" eager />
        <div>
          <h3 className="epanel__title">{result.title}</h3>
          <p className="epanel__author">by {result.author}</p>
          <p className="lbl muted">{[result.year, state.genre ?? result.genre].filter(Boolean).join(' / ')}</p>
          {state.loading ? (
            <p className="muted epanel__desc">
              <Loader2 size={14} className="spin" /> Loading details…
            </p>
          ) : state.description ? (
            <p className="epanel__desc">{state.description.length > 520 ? state.description.slice(0, 520).trimEnd() + '…' : state.description}</p>
          ) : (
            <p className="muted epanel__desc">No description available — you can add one yourself.</p>
          )}
          <button type="button" className="btn btn--solid" disabled={state.loading} onClick={() => onUse(base())}>
            Use these details
          </button>
        </div>
      </div>

      {state.editions.length > 0 && (
        <>
          <div className="section-title">
            <h2>Choose an edition</h2>
            <span className="lbl muted">{state.editions.length} shown</span>
          </div>
          <ul className="editions">
            {state.editions.map((e) => (
              <li key={e.id}>
                <button type="button" className="edition is-liftable" onClick={() => useEdition(e)} data-cursor="view" data-cursor-label="Use">
                  <BookCover book={{ title: e.title, author: result.author, year: e.year, coverUrl: e.coverUrl }} className="edition__cover" />
                  <span className="edition__text">
                    <span className="edition__title">{e.title}</span>
                    <span className="lbl muted">{[e.publisher, e.publishDate].filter(Boolean).join(' · ') || 'Unknown publisher'}</span>
                    <span className="lbl muted">{[e.pages && `${e.pages} pp`, e.isbn, e.language?.toUpperCase()].filter(Boolean).join(' · ')}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {state.error && <p className="muted">{state.error}</p>}
    </div>
  );
}
