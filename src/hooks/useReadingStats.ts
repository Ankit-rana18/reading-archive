import { useMemo } from 'react';
import { useLibrary } from './useBooks';
import { MONTHS_SHORT, progressOf, streaks } from '../lib/util';
import type { Datum } from '../components/ReadingCharts';

/** Every number here is computed from the saved library — nothing is estimated or invented. */
export function useReadingStats(year: number) {
  const { books, sessions } = useLibrary();
  return useMemo(() => {
    const read = books.filter((b) => b.status === 'read');
    const reading = books.filter((b) => b.status === 'reading');
    const want = books.filter((b) => b.status === 'want');
    const pagesRead = read.reduce((n, b) => n + (b.pages ?? 0), 0) + reading.reduce((n, b) => n + (b.currentPage ?? 0), 0);
    const rated = read.filter((b) => b.rating);
    const avgRating = rated.length ? rated.reduce((n, b) => n + (b.rating ?? 0), 0) / rated.length : null;

    const tally = (vals: string[]) => {
      const m = new Map<string, number>();
      vals.forEach((v) => m.set(v, (m.get(v) ?? 0) + 1));
      return Array.from(m.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    };
    const authors = tally(read.map((b) => b.author));
    const genres = tally(read.filter((b) => b.genre).map((b) => b.genre!));
    const topAuthor = authors[0] && authors[0][1] > 1 ? authors[0] : null;

    const y = String(year);
    const doneThisYear = read.filter((b) => b.dateCompleted?.startsWith(y));
    const perMonth: Datum[] = MONTHS_SHORT.map((m, i) => ({
      label: m,
      full: `${m} ${year}`,
      value: doneThisYear.filter((b) => Number(b.dateCompleted!.slice(5, 7)) === i + 1).length,
    }));

    const years = Array.from(new Set(read.filter((b) => b.dateCompleted).map((b) => Number(b.dateCompleted!.slice(0, 4))))).sort();
    const perYear: Datum[] = [];
    if (years.length) for (let yy = years[0]; yy <= years[years.length - 1]; yy++) perYear.push({ label: String(yy), value: read.filter((b) => b.dateCompleted?.startsWith(String(yy))).length });

    const genreTop = genres.slice(0, 7);
    const other = genres.slice(7).reduce((n, g) => n + g[1], 0);
    const genreData: Datum[] = [...genreTop.map(([g, n]) => ({ label: g, value: n })), ...(other ? [{ label: 'Other', value: other }] : [])];

    const ratingData: Datum[] = [5, 4, 3, 2, 1].map((r) => ({ label: '★'.repeat(r), full: `${r} star${r > 1 ? 's' : ''}`, value: read.filter((b) => b.rating === r).length }));

    const progressData: Datum[] = reading.map((b) => ({ label: b.title, value: Math.round(progressOf(b) * 100) }));

    // cumulative pages of completed books, by month of completion
    const dated = read.filter((b) => b.dateCompleted && b.pages).sort((a, b) => a.dateCompleted!.localeCompare(b.dateCompleted!));
    const pagesOverTime: Datum[] = [];
    if (dated.length) {
      const [y0, m0] = dated[0].dateCompleted!.split('-').map(Number);
      const last = dated[dated.length - 1].dateCompleted!.split('-').map(Number);
      let cum = 0;
      let idx = 0;
      for (let yy = y0, mm = m0; yy < last[0] || (yy === last[0] && mm <= last[1]); mm === 12 ? ((mm = 1), yy++) : mm++) {
        const key = `${yy}-${String(mm).padStart(2, '0')}`;
        while (idx < dated.length && dated[idx].dateCompleted!.startsWith(key)) cum += dated[idx++].pages!;
        pagesOverTime.push({ label: `${MONTHS_SHORT[mm - 1]} ${String(yy).slice(2)}`, full: `${MONTHS_SHORT[mm - 1]} ${yy}`, value: cum });
      }
    }

    const sessionPages = sessions.reduce((n, s) => n + s.pages, 0);
    return {
      total: books.length,
      readCount: read.length,
      readingCount: reading.length,
      wantCount: want.length,
      pagesRead,
      avgRating,
      ratedCount: rated.length,
      topAuthor,
      topGenre: genres[0] ?? null,
      doneThisYear: doneThisYear.length,
      streak: streaks(sessions),
      sessionCount: sessions.length,
      sessionPages,
      perMonth,
      perYear,
      genreData,
      ratingData,
      progressData,
      pagesOverTime,
      completionYears: years,
    };
  }, [books, sessions, year]);
}
