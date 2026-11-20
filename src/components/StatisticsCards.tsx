import type { useReadingStats } from '../hooks/useReadingStats';

type Stats = ReturnType<typeof useReadingStats>;

export function StatisticsCards({ s, year }: { s: Stats; year: number }) {
  const cells: { label: string; value: string; note?: string }[] = [
    { label: 'Books read', value: String(s.readCount) },
    { label: 'Reading now', value: String(s.readingCount) },
    { label: 'On the wishlist', value: String(s.wantCount) },
    { label: 'Pages read', value: s.pagesRead.toLocaleString(), note: 'Finished books plus current pages' },
    { label: 'Average rating', value: s.avgRating ? s.avgRating.toFixed(1) : '—', note: s.ratedCount ? `From ${s.ratedCount} rated` : 'No ratings yet' },
    { label: `Finished in ${year}`, value: String(s.doneThisYear) },
    { label: 'Most-read author', value: s.topAuthor ? s.topAuthor[0] : '—', note: s.topAuthor ? `${s.topAuthor[1]} books` : 'No author read twice yet' },
    { label: 'Favourite genre', value: s.topGenre ? s.topGenre[0] : '—', note: s.topGenre ? `${s.topGenre[1]} read` : 'Add genres to see this' },
    {
      label: 'Longest streak',
      value: s.sessionCount ? `${s.streak.longest} ${s.streak.longest === 1 ? 'day' : 'days'}` : '—',
      note: s.sessionCount ? `Current: ${s.streak.current} · ${s.sessionCount} sessions logged` : 'Log sessions in Reading Now',
    },
  ];
  return (
    <dl className="metrics">
      {cells.map((c) => (
        <div key={c.label} className="metric">
          <dt className="lbl muted">{c.label}</dt>
          <dd className={`metric__value ${c.value.length > 9 ? 'metric__value--text' : 'tnum'}`}>{c.value}</dd>
          {c.note && <dd className="lbl muted metric__note">{c.note}</dd>}
        </div>
      ))}
    </dl>
  );
}
