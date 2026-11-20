import { useEffect, useState } from 'react';
import { Copy, LogIn, LogOut, UploadCloud } from 'lucide-react';
import { useAccess } from '../hooks/useAccess';
import { useUI } from '../hooks/useUI';
import { idbAdapter } from '../services/storage';
import { cloudAdapter } from '../services/cloud';

/** Settings section: who you are, signing in as the owner, sharing, and moving a local library up. */
export function AccessPanel() {
  const a = useAccess();
  const ui = useUI();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState<number | null>(null);

  const shareUrl = `${window.location.origin}${window.location.pathname}`;

  // How many books are sitting in this browser's own (pre-cloud) library?
  useEffect(() => {
    if (a.mode !== 'owner') return;
    idbAdapter.loadBooks().then((b) => setLocal(b.length), () => setLocal(0));
  }, [a.mode]);

  if (!a.cloud) return null;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      await a.signIn(email);
      setSent(true);
    } catch (err) {
      ui.toast(`Could not send the link: ${(err as Error).message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const upload = async () => {
    const ok = await ui.confirm({
      title: 'Move this browser’s books to the cloud?',
      body: `${local} books, their reading sessions and uploaded covers will be copied into your shared archive. Books already there are kept; the newer copy of any book wins. Nothing is deleted from this browser.`,
      confirmLabel: 'Copy to the cloud',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const [books, sessions, coverIds, existing] = await Promise.all([
        idbAdapter.loadBooks(),
        idbAdapter.loadSessions(),
        idbAdapter.listCoverIds(),
        cloudAdapter.loadBooks(),
      ]);
      const have = new Map(existing.map((b) => [b.id, b]));
      const toSave = books.filter((b) => !have.has(b.id) || b.updatedAt > have.get(b.id)!.updatedAt);
      for (const id of coverIds) {
        const blob = await idbAdapter.getCover(id);
        if (blob) await cloudAdapter.saveCover(id, blob);
      }
      await cloudAdapter.saveBooks(toSave);
      await cloudAdapter.saveSessions(sessions);
      ui.toast(`Copied ${toSave.length} books to the cloud`);
      setTimeout(() => window.location.reload(), 900);
    } catch (err) {
      ui.toast(`Upload stopped: ${(err as Error).message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      ui.toast('Link copied');
    } catch {
      ui.toast(shareUrl);
    }
  };

  return (
    <section className="sgroup access">
      <h2 className="sgroup__title lbl accent">Archive access</h2>

      <div className="srow">
        <div className="srow__text">
          <div className="srow__title">Share your shelf</div>
          <p className="srow__desc muted">
            Anyone with this link can browse your books, history and statistics. They cannot add, edit or delete anything; only the owner account can.
          </p>
        </div>
        <div className="srow__ctl">
          <button type="button" className="btn" onClick={copyLink}>
            <Copy size={12} /> Copy link
          </button>
        </div>
      </div>

      {a.mode === 'owner' && (
        <>
          <div className="srow">
            <div className="srow__text">
              <div className="srow__title">Signed in as the owner</div>
              <p className="srow__desc muted">{a.email} · changes you make are saved to the cloud and appear for visitors straight away.</p>
            </div>
            <div className="srow__ctl">
              <button type="button" className="btn" onClick={() => a.signOut()}>
                <LogOut size={12} /> Sign out
              </button>
            </div>
          </div>
          {!!local && (
            <div className="srow">
              <div className="srow__text">
                <div className="srow__title">Books saved only in this browser</div>
                <p className="srow__desc muted">This browser still holds {local} books from before the cloud archive. Copy them up so they are shared and safe.</p>
              </div>
              <div className="srow__ctl">
                <button type="button" className="btn btn--solid" onClick={upload} disabled={busy}>
                  <UploadCloud size={12} /> {busy ? 'Copying…' : 'Copy to the cloud'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {a.mode === 'viewer' && a.email && (
        <div className="srow">
          <div className="srow__text">
            <div className="srow__title">View only</div>
            <p className="srow__desc muted">{a.email} is signed in but is not this archive’s owner.</p>
          </div>
          <div className="srow__ctl">
            <button type="button" className="btn" onClick={() => a.recheck()}>
              Check again
            </button>
            <button type="button" className="btn" onClick={() => a.signOut()}>
              <LogOut size={12} /> Sign out
            </button>
          </div>
        </div>
      )}

      {a.mode === 'viewer' && !a.email && (
        <div className="srow">
          <div className="srow__text">
            <div className="srow__title">Owner sign-in</div>
            <p className="srow__desc muted">
              {sent ? 'Check your inbox and open the link on this device to start editing.' : 'You are viewing this archive. If it is yours, sign in with your email; we send you a one-time link, no password.'}
            </p>
          </div>
          <form className="srow__ctl access__form" onSubmit={send}>
            <input
              className="input"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              aria-label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button type="submit" className="btn btn--solid" disabled={busy}>
              <LogIn size={12} /> {sent ? 'Send again' : 'Email me a link'}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
