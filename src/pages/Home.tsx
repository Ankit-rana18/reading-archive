import { useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import type { Book, ReadingStatus } from '../types/book';
import { PRIORITY_LABEL, STATUS_LABEL } from '../types/book';
import { useLibrary } from '../hooks/useBooks';
import { useUI } from '../hooks/useUI';
import { BookShelf, type ShelfHandle } from '../components/BookShelf';
import { Tabs } from '../components/ui';
import { Line, Rise } from '../components/MaskText';
import { fmtDate, progressOf } from '../lib/util';

const PRIO = { high: 0, medium: 1, low: 2 };

export function shelfOrder(books: Book[]): Book[] {
  const reading = books.filter((b) => b.status === 'reading').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const read = books.filter((b) => b.status === 'read').sort((a, b) => (b.dateCompleted ?? '').localeCompare(a.dateCompleted ?? ''));
  const want = books.filter((b) => b.status === 'want').sort((a, b) => PRIO[a.priority ?? 'medium'] - PRIO[b.priority ?? 'medium'] || b.addedAt.localeCompare(a.addedAt));
  return [...reading, ...read, ...want];
}

export function captionFor(b: Book): [string, string, string] {
  const sub = `${b.author} / ${STATUS_LABEL[b.status]}`;
  let meta = '';
  if (b.status === 'reading') meta = b.pages ? `Page ${b.currentPage ?? 0} of ${b.pages} · ${Math.round(progressOf(b) * 100)}%` : b.year ? String(b.year) : 'In progress';
  else if (b.status === 'read') meta = [b.year, b.dateCompleted && `Finished ${fmtDate(b.dateCompleted)}`, b.rating && '★'.repeat(b.rating)].filter(Boolean).join(' · ');
  else meta = [b.year, b.priority && PRIORITY_LABEL[b.priority]].filter(Boolean).join(' · ');
  return [b.title, sub, meta || '—'];
}

type Filter = ReadingStatus | 'all';

export function Home() {
  const { books, loaded, loadError, sessions } = useLibrary();
  const ui = useUI();
  const shelf = useRef<ShelfHandle>(null);
  const [filter, setFilter] = useState<Filter>('all');

  const ordered = useMemo(() => shelfOrder(books), [books]);
  const shown = useMemo(() => (filter === 'all' ? ordered : ordered.filter((b) => b.status === filter)), [ordered, filter]);
  const startId = shown.find((b) => b.status === 'reading')?.id ?? shown[Math.floor((shown.length - 1) / 2)]?.id;
  const pagesRead = books.reduce((n, b) => n + (b.status === 'read' ? b.pages ?? 0 : b.status === 'reading' ? b.currentPage ?? 0 : 0), 0);
  const paused = !!ui.detail || !!ui.editor || ui.searchOpen || !!ui.completeId || !!ui.confirmState;
  void sessions;

  const counts = {
    all: books.length,
    reading: books.filter((b) => b.status === 'reading').length,
    read: books.filter((b) => b.status === 'read').length,
    want: books.filter((b) => b.status === 'want').length,
  };

  if (!loaded) return <main className="home" aria-busy="true" />;

  if (loadError) {
    return (
      <main className="home">
        <div className="empty">
          <p className="empty__title">The archive could not be opened.</p>
          <p className="empty__body">{loadError} Private browsing modes sometimes block storage; try a normal window.</p>
        </div>
      </main>
    );
  }

  if (books.length === 0) {
    return (
      <main className="home home--empty">
        <div className="shelf-block">
          <div className="ghost-shelf" aria-hidden="true">
            {[0.16, 0.12, 0.19, 0.1, 0.14, 0.17, 0.11].map((w, i) => (
              <i key={i} style={{ width: `calc(var(--H) * ${w})`, height: `calc(var(--H) * ${0.84 + ((i * 37) % 16) / 100})` }} />
            ))}
          </div>
        </div>
        <Rise className="home__empty" delay={200}>
          <Line className="lbl accent">An empty shelf</Line>
          <Line as="h1" className="empty__title">
            Your literary journey begins here.
          </Line>
          <Line as="p" className="empty__body">
            Every book you have read, are reading, or hope to read — kept in one place, for good.
          </Line>
          <Line>
            <button type="button" className="btn btn--solid home__cta" onClick={() => ui.openAdd()}>
              <Plus size={13} /> Add your first book
            </button>
          </Line>
        </Rise>
        <HomeFooter books={0} pages={0} />
      </main>
    );
  }

  return (
    <main className="home">
      <div className="home__tabs">
        <Tabs
          label="Shelf filter"
          value={filter}
          onChange={setFilter}
          items={[
            { value: 'all', label: 'All', count: counts.all },
            { value: 'reading', label: 'Reading', count: counts.reading },
            { value: 'read', label: 'Read', count: counts.read },
            { value: 'want', label: 'Want to read', count: counts.want },
          ]}
        />
      </div>

      {shown.length === 0 ? (
        <div className="empty home__none">
          <p className="empty__title">Nothing on this shelf yet.</p>
          <button type="button" className="btn btn--accent" onClick={() => ui.openAdd(filter === 'all' ? undefined : filter)}>
            <Plus size={13} /> Add a book
          </button>
        </div>
      ) : (
        <BookShelf
          key={filter}
          ref={shelf}
          books={shown}
          startId={startId}
          caption={captionFor}
          globalKeys
          wheel="global"
          paused={paused}
          onOpen={(b, getRect) => ui.openDetail(b.id, { getRect, tilt: -4.5 })}
        />
      )}

      <HomeFooter books={books.length} pages={pagesRead} />
    </main>
  );
}

function HomeFooter({ books, pages }: { books: number; pages: number }) {
  return (
    <footer className="home__foot">
      <span className="lbl">© The Reading Archive — Every book leaves a mark.</span>
      <span className="lbl tnum">
        {books} {books === 1 ? 'book' : 'books'} · {pages.toLocaleString()} pages read
      </span>
    </footer>
  );
}
