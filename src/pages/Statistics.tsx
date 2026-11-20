import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useReadingStats } from '../hooks/useReadingStats';
import { usePrefs } from '../hooks/usePrefs';
import { useUI } from '../hooks/useUI';
import { PageHead } from '../components/ui';
import { Bars, ChartFrame, Columns, LineChart, Ring } from '../components/ReadingCharts';
import { StatisticsCards } from '../components/StatisticsCards';

export function Statistics() {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const s = useReadingStats(year);
  const { yearGoal, setYearGoal } = usePrefs();
  const ui = useUI();
  const goal = yearGoal(year);
  const [draft, setDraft] = useState<string | null>(null);
  const years = Array.from(new Set([thisYear, ...s.completionYears])).sort((a, b) => b - a);

  return (
    <main className="page">
      <PageHead
        kicker="05 — Statistics"
        title={
          <>
            My reading <em>journey</em>
          </>
        }
        dek={s.total ? 'Every figure on this page is counted from your own archive, and changes as it does.' : 'Statistics appear once your archive has books in it.'}
      />

      {s.total === 0 ? (
        <div className="empty">
          <p className="empty__title">No numbers to show yet.</p>
          <button type="button" className="btn btn--solid" onClick={() => ui.openAdd()}>
            <Plus size={13} /> Add a book
          </button>
        </div>
      ) : (
        <>
          <section className="goal">
            <Ring value={goal ? s.doneThisYear / goal : 0} />
            <div className="goal__text">
              <span className="lbl cobalt">{year} reading goal</span>
              {goal ? (
                <p className="goal__line">
                  <b className="tnum">{s.doneThisYear}</b> of <b className="tnum">{goal}</b> books
                  <span className="muted">
                    {' '}
                    — {s.doneThisYear >= goal ? 'goal reached.' : `${goal - s.doneThisYear} to go.`}
                  </span>
                </p>
              ) : (
                <p className="goal__line">
                  <b className="tnum">{s.doneThisYear}</b> {s.doneThisYear === 1 ? 'book' : 'books'} finished. <span className="muted">Set a target to track it.</span>
                </p>
              )}
              {draft === null ? (
                <button type="button" className="btn btn--sm btn--cobalt" onClick={() => setDraft(goal ? String(goal) : '')}>
                  {goal ? 'Change target' : 'Set a target'}
                </button>
              ) : (
                <form
                  className="today__goalform"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setYearGoal(year, Number(draft) || undefined);
                    setDraft(null);
                  }}
                >
                  <input className="input" type="number" min={0} autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Books this year" placeholder="e.g. 30" />
                  <button type="submit" className="btn btn--sm btn--solid">
                    Save
                  </button>
                  <button type="button" className="btn btn--sm btn--ghost" onClick={() => setDraft(null)}>
                    Cancel
                  </button>
                </form>
              )}
            </div>
            <label className="sortsel lbl muted goal__year">
              Year
              <select className="select select--sm" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {years.map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </select>
            </label>
          </section>

          <StatisticsCards s={s} year={year} />

          <div className="charts">
            <ChartFrame title={`Books read per month, ${year}`} data={s.perMonth} unit="books">
              <Columns data={s.perMonth} unit="books" />
            </ChartFrame>
            <ChartFrame title="Books read per year" data={s.perYear} unit="books">
              <Columns data={s.perYear} unit="books" />
            </ChartFrame>
            <ChartFrame title="Pages read over time" note="Cumulative, completed books" data={s.pagesOverTime} unit="pages">
              <LineChart data={s.pagesOverTime} unit="pages" />
            </ChartFrame>
            <ChartFrame title="Genre distribution" note="Books read" data={s.genreData} unit="books">
              <Bars data={s.genreData} unit="books" />
            </ChartFrame>
            <ChartFrame title="Ratings" note={`${s.ratedCount} rated`} data={s.ratingData} unit="books">
              <Bars data={s.ratingData} unit="books" />
            </ChartFrame>
            <ChartFrame title="Reading progress" note="Books open now, % complete" data={s.progressData} unit="%">
              <Bars data={s.progressData} unit="%" />
            </ChartFrame>
          </div>
        </>
      )}
    </main>
  );
}
