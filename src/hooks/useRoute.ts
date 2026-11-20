import { useEffect, useState } from 'react';

export type Route = '/' | '/library' | '/reading' | '/wishlist' | '/history' | '/stats' | '/settings';
const ROUTES: Route[] = ['/', '/library', '/reading', '/wishlist', '/history', '/stats', '/settings'];

const current = (): Route => {
  const h = window.location.hash.replace(/^#/, '') || '/';
  return (ROUTES.includes(h as Route) ? h : '/') as Route;
};

export function navigate(to: Route) {
  if (current() === to) return;
  window.location.hash = to;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(current);
  useEffect(() => {
    const on = () => setRoute(current());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
