import type { Book, ReadingSession } from '../types/book';

export const uid = () =>
  (crypto as Crypto & { randomUUID?: () => string }).randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** Local-time YYYY-MM-DD. */
export function todayISO(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISO(s?: string): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3]);
}

export function daysBetween(a?: string, b?: string): number | null {
  const da = parseISO(a);
  const db = parseISO(b);
  if (!da || !db) return null;
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_SHORT = MONTHS;

export function fmtDate(s?: string, withYear = true): string {
  const d = parseISO(s);
  if (!d) return '—';
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${withYear ? ' ' + d.getFullYear() : ''}`;
}

export function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const norm = (s?: string) =>
  (s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const cleanIsbn = (s?: string) => (s ?? '').replace(/[^0-9Xx]/g, '').toUpperCase();

/** Cloth colours for generated spines and covers. */
export const CLOTHS = [
  { bg: '#1F3FB0', fg: '#F4F2ED' }, // cobalt
  { bg: '#A4513D', fg: '#F4F2ED' }, // rust
  { bg: '#777B55', fg: '#F4F2ED' }, // olive
  { bg: '#1E1D1B', fg: '#E9DFC8' }, // ink
  { bg: '#6E2A2A', fg: '#EEDFC6' }, // oxblood
  { bg: '#C49A45', fg: '#1E1D1B' }, // ochre
  { bg: '#2F4A3A', fg: '#E9DFC8' }, // forest
  { bg: '#4D5763', fg: '#F1EDE4' }, // slate
  { bg: '#E4DCCB', fg: '#1E1D1B' }, // linen
  { bg: '#B8653A', fg: '#F7EFE2' }, // terracotta
  { bg: '#24324F', fg: '#E6D6AE' }, // navy
  { bg: '#8C8A7E', fg: '#141414' }, // stone
];

function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function clothFor(book: Pick<Book, 'title' | 'author' | 'spineColor'>) {
  if (book.spineColor) {
    return { bg: book.spineColor, fg: luminance(book.spineColor) > 0.4 ? '#1E1D1B' : '#F4F2ED' };
  }
  return CLOTHS[hash(norm(book.title) + norm(book.author)) % CLOTHS.length];
}

/** Deterministic per-book physical proportions, relative to shelf height H. */
export function bookShape(book: Pick<Book, 'title' | 'author' | 'pages'>) {
  const h0 = hash(norm(book.title) + '|' + norm(book.author));
  const rnd = (n: number) => ((h0 >>> n) & 255) / 255;
  const pages = book.pages && book.pages > 0 ? book.pages : 180 + rnd(3) * 320;
  const spine = Math.min(0.2, Math.max(0.085, 0.07 + (pages / 1000) * 0.13)); // × H
  const height = 0.85 + rnd(11) * 0.15; // × H
  const style = h0 % 4; // spine typographic variant
  return { spine, height, style };
}

export function minutesToRead(pages?: number): number | null {
  if (!pages || pages <= 0) return null;
  // ~275 words per page at ~250 words per minute.
  return Math.round(pages * 1.1);
}

export function fmtDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function progressOf(book: Book): number {
  if (book.status === 'read') return 1;
  if (!book.pages || !book.currentPage) return 0;
  return Math.max(0, Math.min(1, book.currentPage / book.pages));
}

/** Consecutive-day streaks from recorded sessions. */
export function streaks(sessions: ReadingSession[]) {
  const days = Array.from(new Set(sessions.filter((s) => s.pages > 0 || (s.minutes ?? 0) > 0).map((s) => s.date))).sort();
  let longest = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const d of days) {
    const cur = parseISO(d)!;
    if (prev && Math.round((cur.getTime() - prev.getTime()) / 86400000) === 1) run++;
    else run = 1;
    longest = Math.max(longest, run);
    prev = cur;
  }
  // Current streak: ends today or yesterday.
  let current = 0;
  if (days.length) {
    const last = parseISO(days[days.length - 1])!;
    const gap = Math.round((parseISO(todayISO())!.getTime() - last.getTime()) / 86400000);
    if (gap <= 1) {
      current = 1;
      for (let i = days.length - 1; i > 0; i--) {
        const a = parseISO(days[i - 1])!;
        const b = parseISO(days[i])!;
        if (Math.round((b.getTime() - a.getTime()) / 86400000) === 1) current++;
        else break;
      }
    }
  }
  return { current, longest, days: days.length };
}

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export const prefersReducedMotion = () =>
  document.documentElement.dataset.motion === 'reduce' ||
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function plural(n: number, one: string, many = one + 's') {
  return `${n} ${n === 1 ? one : many}`;
}

const NUM_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
export const numWord = (n: number) => (n < NUM_WORDS.length ? NUM_WORDS[n] : String(n));
