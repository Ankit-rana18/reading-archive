import { useMemo, useState } from 'react';
import { LayoutGrid, LibraryBig, List, Plus } from 'lucide-react';
import type { ReadingStatus, ViewMode } from '../types/book';
import { useLibrary } from '../hooks/useBooks';
import { useUI } from '../hooks/useUI';
import { usePrefs } from '../hooks/usePrefs';
import { applyFilters, NO_FILTERS, sortBooks, type Filters, type SortKey } from '../lib/filter';
import { PageHead, Tabs } from '../components/ui';
import { FilterPanel, SearchBar, SortSelect } from '../components/FilterPanel';
import { BookCard, BookRow } from '../components/BookCard';
import { BookShelf } from '../components/BookShelf';
import { captionFor } from './Home';
import { numWord } from '../lib/util';

export function MyLibrary() {
  const { books } = useLibrary();
  const ui = useUI();
  const { prefs } = usePrefs();
  const [view, setView] = useState<ViewMode>(prefs.defaultView);
  const [f, setF] = useState<Filters>(NO_FILTERS);
  const [sort, setSort] = useState<SortKey>('added');

  const shown = useMemo(() => sortBooks(applyFilters(books, f), sort), [books, f, sort]);
  const counts = {
    all: books.length,
    read: books.filter((b) => b.status === 'read').length,
    reading: books.filter((b) => b.status === 'reading').length,
    want: books.filter((b) => b.status === 'want').length,
  };
  const paused = !!ui.detail || !!ui.editor || ui.searchOpen || !!ui.completeId || !!ui.confirmState;

  return (
    <main className="page">
      <PageHead
        kicker="01 — My Library"
        title={
          <>
            The <em>whole</em> collection
          </>
        }
        dek={
          books.length
            ? `${numWord(books.length)} ${books.length === 1 ? 'book' : 'books'} kept: ${counts.read} read, ${counts.reading} open on the desk, ${counts.want} waiting.`
            : 'Nothing kept yet. Add the first book and the collection begins.'
        }
        aside={
          <button type="button" className="btn btn--solid" onClick={() => ui.openAdd()}>
            <Plus size={13} /> Add book
          </button>
        }
      />

      <div className="toolbar">
        <Tabs
          label="Reading status"
          value={f.status}
          onChange={(status) => setF({ ...f, status: status as ReadingStatus | 'all' })}
          items={[
            { value: 'all', label: 'All', count: counts.all },
            { value: 'read', label: 'Read', count: counts.read },
            { value: 'reading', label: 'Reading', count: counts.reading },
            { value: 'want', label: 'Want to read', count: counts.want },
          ]}
        />
        <SearchBar value={f.q} onChange={(q) => setF({ ...f, q })} />
        <div className="toolbar__spacer" />
        <SortSelect value={sort} onChange={setSort} />
        <div className="viewtoggle" role="group" aria-label="View">
          {(
            [
              ['shelf', LibraryBig, 'Bookshelf'],
              ['grid', LayoutGrid, 'Grid'],
              ['list', List, 'List'],
            ] as const
          ).map(([v, Icon, label]) => (
            <button key={v} type="button" className="icon-btn" aria-pressed={view === v} aria-label={`${label} view`} title={label} onClick={() => setView(v)}>
              <Icon size={16} strokeWidth={1.4} />
            </button>
          ))}
        </div>
      </div>
      <div className="toolbar toolbar--filters">
        <FilterPanel books={books} filters={f} onChange={setF} />
        <span className="lbl muted">
          {shown.length} of {books.length} shown
        </span>
      </div>

      {books.length === 0 ? (
        <div className="empty">
          <p className="empty__title">Your literary journey begins here.</p>
          <button type="button" className="btn btn--solid" onClick={() => ui.openAdd()}>
            <Plus size={13} /> Add your first book
          </button>
        </div>
      ) : shown.length === 0 ? (
        <div className="empty">
          <p className="empty__title">No books match.</p>
          <button type="button" className="btn" onClick={() => setF(NO_FILTERS)}>
            Clear search and filters
          </button>
        </div>
      ) : view === 'shelf' ? (
        <div className="lib-shelf">
          <BookShelf
            key={`${f.status}-${sort}-${shown.length}`}
            books={shown}
            caption={captionFor}
            wheel="local"
            paused={paused}
            onOpen={(b, getRect) => ui.openDetail(b.id, { getRect, tilt: -4.5 })}
          />
          <p className="lib-shelf__hint lbl muted">Drag, scroll sideways or use ← → to browse · click the open book to read its record</p>
        </div>
      ) : view === 'grid' ? (
        <div className="bgrid">
          {shown.map((b) => (
            <BookCard key={b.id} book={b} showStatus={f.status === 'all'} />
          ))}
        </div>
      ) : (
        <ul className="blist">
          <li className="brow brow--head lbl muted" aria-hidden="true">
            <span>Title</span>
            <span>Year</span>
            <span>Genre</span>
            <span>Rating</span>
            <span>Finished / progress</span>
            <span>Status</span>
            <span />
          </li>
          {shown.map((b) => (
            <BookRow key={b.id} book={b} />
          ))}
        </ul>
      )}
    </main>
  );
}
