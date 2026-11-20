import { useEffect, useRef, useState } from 'react';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import type { ViewMode } from '../types/book';
import { useLibrary } from '../hooks/useBooks';
import { usePrefs } from '../hooks/usePrefs';
import { useUI } from '../hooks/useUI';
import { PageHead, Tabs } from '../components/ui';
import { AccessPanel } from '../components/AccessPanel';
import { useAccess } from '../hooks/useAccess';
import { exportCSV, exportJSON, parseBackup, type ParsedBackup } from '../services/backup';
import { requestPersistence, storageInfo } from '../services/storage';
import { fmtDate } from '../lib/util';

const fmtBytes = (n: number | null) => (n === null ? '—' : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

function Row({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="srow">
      <div className="srow__text">
        <h3 className="srow__title">{title}</h3>
        {desc && <p className="srow__desc muted">{desc}</p>}
      </div>
      <div className="srow__ctl">{children}</div>
    </div>
  );
}

export function Settings() {
  const lib = useLibrary();
  const ui = useUI();
  const access = useAccess();
  const { prefs, setPrefs, yearGoal, setYearGoal } = usePrefs();
  const year = new Date().getFullYear();
  const [info, setInfo] = useState<{ persisted: boolean; usage: number | null; quota: number | null } | null>(null);
  const [pending, setPending] = useState<ParsedBackup | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    storageInfo().then(setInfo);
  }, [lib.books.length, lib.coverVersion]);

  const doExport = async () => {
    setBusy(true);
    try {
      await exportJSON(lib.books, lib.sessions, prefs);
      ui.toast('Backup downloaded');
    } catch (e) {
      ui.toast(`Export failed: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const pick = async (f?: File) => {
    if (!f) return;
    try {
      setPending(await parseBackup(f));
    } catch (e) {
      ui.toast((e as Error).message, 'error');
    } finally {
      if (file.current) file.current.value = '';
    }
  };

  const doImport = async (mode: 'merge' | 'replace') => {
    if (!pending) return;
    if (mode === 'replace') {
      const ok = await ui.confirm({
        title: 'Replace your whole archive?',
        body: `Your current ${lib.books.length} books and ${lib.sessions.length} sessions will be erased and replaced by the ${pending.books.length} books in the backup. Export a backup first if you might need them.`,
        confirmLabel: 'Replace archive',
        danger: true,
        requireText: 'REPLACE',
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const r = await lib.importBackup(pending, mode);
      if (pending.prefs && mode === 'replace') setPrefs({ ...pending.prefs });
      ui.toast(mode === 'replace' ? `Archive restored: ${r.added} books` : `Imported ${r.added} new, updated ${r.updated}`);
      setPending(null);
    } catch (e) {
      ui.toast(`Import failed: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    const ok = await ui.confirm({
      title: 'Clear the entire library?',
      body: `This permanently deletes all ${lib.books.length} books, ${lib.sessions.length} reading sessions and every stored cover from this browser. It cannot be undone without a backup.`,
      confirmLabel: 'Clear library',
      danger: true,
      requireText: 'DELETE',
    });
    if (!ok) return;
    await lib.clearLibrary();
    ui.toast('Library cleared');
  };

  return (
    <main className="page page--narrow">
      <PageHead kicker="06 — Settings" title={<>The <em>colophon</em></>} dek="Appearance, goals, and the safekeeping of your archive." />

      <AccessPanel />

      <section className="sgroup">
        <h2 className="sgroup__title lbl accent">Appearance</h2>
        <Row title="Theme" desc="Warm paper by day, or ink for the evening.">
          <Tabs
            label="Theme"
            value={prefs.theme}
            onChange={(theme) => setPrefs({ theme })}
            items={[
              { value: 'paper', label: 'Paper' },
              { value: 'ink', label: 'Ink' },
            ]}
          />
        </Row>
        <Row title="Motion" desc="Reduce animation. Your system setting is always respected too.">
          <Tabs
            label="Motion"
            value={prefs.motion}
            onChange={(motion) => setPrefs({ motion })}
            items={[
              { value: 'system', label: 'Full' },
              { value: 'reduce', label: 'Reduced' },
            ]}
          />
        </Row>
        <Row title="Default library view">
          <Tabs
            label="Default view"
            value={prefs.defaultView}
            onChange={(defaultView: ViewMode) => setPrefs({ defaultView })}
            items={[
              { value: 'shelf', label: 'Bookshelf' },
              { value: 'grid', label: 'Grid' },
              { value: 'list', label: 'List' },
            ]}
          />
        </Row>
      </section>

      {access.canEdit && (
        <>
      <section className="sgroup">
        <h2 className="sgroup__title lbl accent">Goals</h2>
        <Row title={`${year} reading goal`} desc="Books to finish this year.">
          <input
            className="input input--num"
            type="number"
            min={0}
            value={yearGoal(year) ?? ''}
            placeholder="—"
            onChange={(e) => setYearGoal(year, Number(e.target.value) || undefined)}
            aria-label="Yearly goal"
          />
        </Row>
        <Row title="Daily page goal" desc="Used on Reading Now and for wishlist estimates.">
          <input
            className="input input--num"
            type="number"
            min={0}
            value={prefs.dailyPageGoal || ''}
            placeholder="—"
            onChange={(e) => setPrefs({ dailyPageGoal: Math.max(0, Number(e.target.value) || 0) })}
            aria-label="Daily page goal"
          />
        </Row>
      </section>

      <section className="sgroup">
        <h2 className="sgroup__title lbl accent">Your data</h2>
        <Row
          title="Where it lives"
          desc={
            access.mode === 'owner'
              ? 'Your archive is stored in your Supabase cloud database: the same books on every device, readable by anyone with the link, editable only by you. Keep an occasional JSON backup anyway.'
              : 'Everything is stored privately in this browser (IndexedDB), on this device only. Nothing is uploaded. Clearing site data or using another browser starts an empty archive — keep backups.'
          }
        >
          <dl className="sinfo">
            <div>
              <dt className="lbl muted">Books</dt>
              <dd className="tnum">{lib.books.length}</dd>
            </div>
            <div>
              <dt className="lbl muted">Sessions</dt>
              <dd className="tnum">{lib.sessions.length}</dd>
            </div>
            <div>
              <dt className="lbl muted">Used</dt>
              <dd className="tnum">{fmtBytes(info?.usage ?? null)}</dd>
            </div>
            <div>
              <dt className="lbl muted">Protected</dt>
              <dd>
                {info?.persisted ? (
                  'Yes'
                ) : (
                  <button type="button" className="lbl accent" onClick={() => requestPersistence().then(() => storageInfo().then(setInfo))}>
                    Ask browser
                  </button>
                )}
              </dd>
            </div>
          </dl>
        </Row>
        <Row title="Export my library" desc="A complete JSON backup: books, notes, quotes, ratings, sessions, uploaded covers and preferences.">
          <button type="button" className="btn btn--solid" onClick={doExport} disabled={busy}>
            <Download size={13} /> Export JSON
          </button>
        </Row>
        <Row title="Export as spreadsheet" desc="Book records as CSV, for Excel, Numbers or Google Sheets.">
          <button type="button" className="btn" onClick={() => exportCSV(lib.books)} disabled={!lib.books.length}>
            <FileSpreadsheet size={13} /> Export CSV
          </button>
        </Row>
        <Row title="Import my library" desc="Restore from a Reading Archive JSON backup. You choose whether to merge or replace before anything changes.">
          <button type="button" className="btn" onClick={() => file.current?.click()} disabled={busy}>
            <Upload size={13} /> Choose backup…
          </button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => pick(e.target.files?.[0])} />
        </Row>
        {pending && (
          <div className="import-preview">
            <p>
              Backup{pending.exportedAt ? ` from ${fmtDate(pending.exportedAt.slice(0, 10))}` : ''}: <b>{pending.books.length}</b> books, <b>{pending.sessions.length}</b> sessions,{' '}
              <b>{pending.covers.length}</b> covers.
              {pending.skipped > 0 && <span className="muted"> {pending.skipped} invalid entries will be skipped.</span>}
            </p>
            <p className="muted">Merge adds new books and keeps the newer version of any book in both. Replace erases the current archive first.</p>
            <div className="confirm__actions">
              <button type="button" className="btn btn--ghost" onClick={() => setPending(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn--danger" onClick={() => doImport('replace')} disabled={busy}>
                Replace
              </button>
              <button type="button" className="btn btn--solid" onClick={() => doImport('merge')} disabled={busy}>
                Merge
              </button>
            </div>
          </div>
        )}
        <Row title="Clear library" desc="Delete every book and session from this browser.">
          <button type="button" className="btn btn--danger" onClick={clear} disabled={!lib.books.length}>
            Clear library
          </button>
        </Row>
      </section>
        </>
      )}

      <section className="sgroup">
        <h2 className="sgroup__title lbl accent">About</h2>
        <div className="about">
          <p>
            <b>The Reading Archive</b> is a permanent record of the books in a reader’s life, kept by its owner and open for anyone to browse.
          </p>
          <p className="muted">
            Book search uses the free Open Library and Google Books APIs; only your search terms are sent to them. Covers come from those services or from images you upload.
          </p>
          <p className="muted">Shortcuts: ← → browse the shelf · Enter opens the selected book · / opens search · Esc closes.</p>
        </div>
      </section>
    </main>
  );
}
