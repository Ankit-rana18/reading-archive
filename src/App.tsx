import { useEffect, useLayoutEffect, useRef } from 'react';
import { LibraryProvider } from './hooks/useBooks';
import { PrefsProvider } from './hooks/usePrefs';
import { AccessProvider, useAccess } from './hooks/useAccess';
import { UIProvider, useUI } from './hooks/useUI';
import { useRoute } from './hooks/useRoute';
import { Navbar } from './components/Navbar';
import { CustomCursor } from './components/CustomCursor';
import { Backdrop } from './components/Backdrop';
import { BookDetail } from './components/BookDetail';
import { AddBookModal } from './components/AddBookModal';
import { CompleteDialog } from './components/CompleteDialog';
import { GlobalSearch } from './components/GlobalSearch';
import { ConfirmHost, ToastHost } from './components/ui';
import { Home } from './pages/Home';
import { MyLibrary } from './pages/MyLibrary';
import { ReadingNow } from './pages/ReadingNow';
import { Wishlist } from './pages/Wishlist';
import { ReadingHistory } from './pages/ReadingHistory';
import { Statistics } from './pages/Statistics';
import { Settings } from './pages/Settings';
import { prefersReducedMotion } from './lib/util';

function Shell() {
  const route = useRoute();
  const ui = useUI();
  const main = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.classList.toggle('is-home', route === '/');
    window.scrollTo(0, 0);
    const names: Record<string, string> = {
      '/': 'The Shelf',
      '/library': 'My Library',
      '/reading': 'Reading Now',
      '/wishlist': 'Want to Read',
      '/history': 'Reading History',
      '/stats': 'Statistics',
      '/settings': 'Settings',
    };
    document.title = `${names[route]} — The Reading Archive`;
  }, [route]);

  // page change: the glass sheet glides up into place. Transform only: clip-path or opacity on an
  // ancestor would stop the glass from sampling the video (they create a backdrop root).
  // The full-screen shelf (fixed) is left alone, as a transform would re-anchor it.
  useLayoutEffect(() => {
    const el = main.current;
    if (!el || route === '/' || prefersReducedMotion()) return;
    const a = el.animate([{ transform: 'translateY(48px)' }, { transform: 'none' }], {
      duration: 900,
      easing: 'cubic-bezier(.2,.8,.2,1)',
    });
    return () => a.cancel();
  }, [route]);

  const Page = { '/': Home, '/library': MyLibrary, '/reading': ReadingNow, '/wishlist': Wishlist, '/history': ReadingHistory, '/stats': Statistics, '/settings': Settings }[route];

  return (
    <>
      <Backdrop dense={route !== '/'} />
      <a className="skip" href="#main">
        Skip to content
      </a>
      <Navbar route={route} />
      <div id="main" ref={main} key={route} className="route">
        <Page />
      </div>
      <div className="grain" aria-hidden="true" />
      <BookDetail />
      <AddBookModal />
      <CompleteDialog />
      <GlobalSearch />
      <ConfirmHost />
      <ToastHost />
      <CustomCursor />
    </>
  );
}

function WithLibrary() {
  const ui = useUI();
  const access = useAccess();
  if (!access.ready) return <Backdrop dense={false} />;
  return (
    <LibraryProvider key={access.mode} readOnly={!access.canEdit} onError={(m) => ui.toast(m, 'error')}>
      <Shell />
    </LibraryProvider>
  );
}

export default function App() {
  return (
    <PrefsProvider>
      <AccessProvider>
        <UIProvider>
          <WithLibrary />
        </UIProvider>
      </AccessProvider>
    </PrefsProvider>
  );
}
