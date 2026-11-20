import type { Book, ReadingStatus } from '../types/book';
import { norm } from './util';

export type SortKey = 'added' | 'alpha' | 'author' | 'rating-desc' | 'rating-asc' | 'completed-desc' | 'completed-asc' | 'published';

export const SORT_LABEL: Record<SortKey, string> = {
  added: 'Recently added',
  alpha: 'Alphabetical',
  author: 'Author',
  'rating-desc': 'Highest rated',
  'rating-asc': 'Lowest rated',
  'completed-desc': 'Recently completed',
  'completed-asc': 'Oldest completed',
  published: 'Publication year',
};

export interface Filters {
  q: string;
  status: ReadingStatus | 'all';
  genre: string;
  author: string;
  pubYear: string; // decade like "1950" or "" ; exact year also accepted
  readYear: string;
  minRating: number;
}

export const NO_FILTERS: Filters = { q: '', status: 'all', genre: '', author: '', pubYear: '', readYear: '', minRating: 0 };

export const activeFilterCount = (f: Filters) =>
  [f.genre, f.author, f.pubYear, f.readYear].filter(Boolean).length + (f.minRating ? 1 : 0);

/** Which field matched a free-text query (for search result hints). */
export function matchField(b: Book, q: string): string | null {
  const n = norm(q);
  if (!n) return null;
  if (norm(b.title).includes(n)) return 'title';
  if (norm(b.author).includes(n)) return 'author';
  if (norm(b.genre).includes(n)) return 'genre';
  if (b.isbn && b.isbn.replace(/[^0-9X]/gi, '').includes(q.replace(/[^0-9X]/gi, '')) && q.replace(/[^0-9X]/gi, '').length >= 3) return 'isbn';
  if (norm(b.publisher).includes(n)) return 'publisher';
  if (norm(b.notes).includes(n)) return 'notes';
  if (norm(b.review).includes(n)) return 'review';
  if (b.quotes.some((x) => norm(x).includes(n))) return 'quotes';
  if (b.lessons.some((x) => norm(x).includes(n))) return 'lessons';
  if (norm(b.description).includes(n)) return 'description';
  return null;
}

export function applyFilters(books: Book[], f: Filters): Book[] {
  return books.filter((b) => {
    if (f.status !== 'all' && b.status !== f.status) return false;
    if (f.genre && (b.genre ?? '') !== f.genre) return false;
    if (f.author && b.author !== f.author) return false;
    if (f.pubYear) {
      if (!b.year) return false;
      if (f.pubYear.endsWith('s')) {
        const dec = parseInt(f.pubYear, 10);
        if (b.year < dec || b.year >= dec + 10) return false;
      } else if (String(b.year) !== f.pubYear) return false;
    }
    if (f.readYear && (b.status !== 'read' || !b.dateCompleted?.startsWith(f.readYear))) return false;
    if (f.minRating && (b.rating ?? 0) < f.minRating) return false;
    if (f.q.trim() && !matchField(b, f.q)) return false;
    return true;
  });
}

export function sortBooks(books: Book[], key: SortKey): Book[] {
  const a = books.slice();
  const t = (s?: string) => s ?? '';
  switch (key) {
    case 'alpha':
      return a.sort((x, y) => x.title.localeCompare(y.title, undefined, { sensitivity: 'base' }));
    case 'author':
      return a.sort((x, y) => x.author.localeCompare(y.author) || x.title.localeCompare(y.title));
    case 'rating-desc':
      return a.sort((x, y) => (y.rating ?? -1) - (x.rating ?? -1) || x.title.localeCompare(y.title));
    case 'rating-asc':
      return a.sort((x, y) => (x.rating ?? 99) - (y.rating ?? 99) || x.title.localeCompare(y.title));
    case 'completed-desc':
      return a.sort((x, y) => t(y.dateCompleted).localeCompare(t(x.dateCompleted)));
    case 'completed-asc':
      return a.sort((x, y) => (x.dateCompleted ? 0 : 1) - (y.dateCompleted ? 0 : 1) || t(x.dateCompleted).localeCompare(t(y.dateCompleted)));
    case 'published':
      return a.sort((x, y) => (x.year ?? 99999) - (y.year ?? 99999));
    case 'added':
    default:
      return a.sort((x, y) => y.addedAt.localeCompare(x.addedAt));
  }
}

/** Distinct values for filter menus. */
export function facets(books: Book[]) {
  const genres = Array.from(new Set(books.map((b) => b.genre).filter((g): g is string => !!g))).sort();
  const authors = Array.from(new Set(books.map((b) => b.author))).sort((a, b) => a.localeCompare(b));
  const decades = Array.from(new Set(books.filter((b) => b.year).map((b) => `${Math.floor(b.year! / 10) * 10}s`))).sort();
  const readYears = Array.from(new Set(books.filter((b) => b.dateCompleted).map((b) => b.dateCompleted!.slice(0, 4)))).sort().reverse();
  return { genres, authors, decades, readYears };
}
