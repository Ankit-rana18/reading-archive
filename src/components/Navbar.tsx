import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BarChart3, Menu, Plus, Search, Settings2, X } from 'lucide-react';
import { navigate, type Route } from '../hooks/useRoute';
import { useUI } from '../hooks/useUI';
import { useLibrary } from '../hooks/useBooks';
import { prefersReducedMotion } from '../lib/util';

const LINKS: { to: Route; label: string; key: 'all' | 'reading' | 'want' | 'read' }[] = [
  { to: '/library', label: 'My Library', key: 'all' },
  { to: '/reading', label: 'Reading Now', key: 'reading' },
  { to: '/wishlist', label: 'Want to Read', key: 'want' },
  { to: '/history', label: 'History', key: 'read' },
];

export function Logo({ center }: { center?: boolean }) {
  return (
    <a href="#/" className={`logo ${center ? 'logo--center' : ''}`} aria-label="The Reading Archive — home">
      <span className="logo__mark">The Reading Archive</span>
      <span className="logo__sub">Every book leaves a mark</span>
    </a>
  );
}

export function Navbar({ route }: { route: Route }) {
  const ui = useUI();
  const { books } = useLibrary();
  const linksRef = useRef<HTMLDivElement>(null);
  const indRef = useRef<HTMLSpanElement>(null);
  const [menu, setMenu] = useState(false);
  const sheet = useRef<HTMLDivElement>(null);

  const counts = {
    all: books.length,
    reading: books.filter((b) => b.status === 'reading').length,
    want: books.filter((b) => b.status === 'want').length,
    read: books.filter((b) => b.status === 'read').length,
  };

  const place = () => {
    const el = linksRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    const ind = indRef.current;
    if (!ind) return;
    if (!el) {
      ind.style.transform = `translateX(${ind.offsetLeft}px) scaleX(0)`;
      return;
    }
    ind.style.width = `${el.offsetWidth}px`;
    ind.style.transform = `translateX(${el.offsetLeft}px) scaleX(1)`;
  };
  useLayoutEffect(place, [route, books.length]);
  useEffect(() => {
    window.addEventListener('resize', place);
    document.fonts?.ready.then(place);
    return () => window.removeEventListener('resize', place);
  }, []);

  useEffect(() => setMenu(false), [route]);
  useLayoutEffect(() => {
    if (!menu || !sheet.current) return;
    const reduce = prefersReducedMotion();
    sheet.current.animate([{ clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)' }], {
      duration: reduce ? 1 : 700,
      easing: 'cubic-bezier(.76,0,.18,1)',
      fill: 'both',
    });
    sheet.current.querySelectorAll<HTMLElement>('.rise').forEach((el, i) =>
      el.animate([{ transform: 'translateY(110%)' }, { transform: 'translateY(0)' }], {
        duration: reduce ? 1 : 800,
        delay: reduce ? 0 : 260 + i * 60,
        easing: 'cubic-bezier(.2,.8,.2,1)',
        fill: 'both',
      }),
    );
    document.body.classList.add('lock');
    return () => document.body.classList.remove('lock');
  }, [menu]);

  // "/" opens search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const a = document.activeElement;
      if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT')) return;
      if ((e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) && !document.querySelector('.modal-layer')) {
        e.preventDefault();
        ui.setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ui]);

  return (
    <>
      <nav className={`nav ${route === '/' ? 'nav--home' : ''}`} aria-label="Main">
        <div className="nav__left">
          <Logo />
        </div>
        <div className="nav__links" ref={linksRef}>
          {LINKS.map((l) => (
            <a key={l.to} href={`#${l.to}`} className="nav__link lbl" aria-current={route === l.to ? 'page' : undefined}>
              {l.label}
              <sup className="nav__count">{counts[l.key]}</sup>
            </a>
          ))}
          <span ref={indRef} className="nav__ind" aria-hidden="true" />
        </div>
        <div className="nav__right">
          <button type="button" className="icon-btn" aria-label="Search the archive (/)" onClick={() => ui.setSearchOpen(true)}>
            <Search size={17} strokeWidth={1.4} />
          </button>
          <a href="#/stats" className="icon-btn nav__hide-sm" aria-label="Statistics" aria-pressed={route === '/stats'}>
            <BarChart3 size={17} strokeWidth={1.4} />
          </a>
          <a href="#/settings" className="icon-btn nav__hide-sm" aria-label="Settings" aria-pressed={route === '/settings'}>
            <Settings2 size={17} strokeWidth={1.4} />
          </a>
          <button type="button" className="btn btn--cobalt nav__add" onClick={() => ui.openAdd()}>
            <Plus size={13} strokeWidth={1.6} />
            <span>Add book</span>
          </button>
          <button type="button" className="icon-btn nav__burger" aria-label="Open menu" aria-expanded={menu} onClick={() => setMenu(true)}>
            <Menu size={18} strokeWidth={1.4} />
          </button>
        </div>
      </nav>

      {menu && (
        <div ref={sheet} className="mmenu" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="mmenu__top">
            <Logo />
            <button type="button" className="box lbl" onClick={() => setMenu(false)}>
              Close <X size={11} />
            </button>
          </div>
          <ul className="mmenu__list">
            {[{ to: '/' as Route, label: 'The Shelf', key: 'all' as const }, ...LINKS, { to: '/stats' as Route, label: 'Statistics', key: 'all' as const }, { to: '/settings' as Route, label: 'Settings', key: 'all' as const }].map(
              (l, i) => (
                <li key={l.to} className="mask">
                  <button type="button" className={`rise mmenu__link ${route === l.to ? 'is-on' : ''}`} onClick={() => navigate(l.to)}>
                    <span className="lbl muted">{String(i + 1).padStart(2, '0')}</span>
                    {l.label}
                  </button>
                </li>
              ),
            )}
          </ul>
          <div className="mmenu__foot">
            <button
              type="button"
              className="btn btn--solid"
              onClick={() => {
                setMenu(false);
                ui.openAdd();
              }}
            >
              <Plus size={13} /> Add a book
            </button>
          </div>
        </div>
      )}
    </>
  );
}
