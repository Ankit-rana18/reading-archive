import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { checkOwner, cloudAdapter, cloudEnabled, sendSignInLink, supabase } from '../services/cloud';
import { idbAdapter, setStorageAdapter } from '../services/storage';

/**
 * Who is looking at the archive.
 *  - local:  no cloud configured; this browser's own library, fully editable.
 *  - owner:  signed in as the archive's owner; reads and writes the cloud archive.
 *  - viewer: anyone else (signed out, or signed in but not the owner); read-only.
 */
export type AccessMode = 'local' | 'owner' | 'viewer';

interface AccessCtx {
  ready: boolean;
  mode: AccessMode;
  canEdit: boolean;
  cloud: boolean;
  email: string | null;
  /** Why the last sign-in link did not work, if it did not. */
  authError: string | null;
  signIn(email: string): Promise<void>;
  signOut(): Promise<void>;
  recheck(): void;
}

const Ctx = createContext<AccessCtx | null>(null);

export function AccessProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [owner, setOwner] = useState(false);
  const [ready, setReady] = useState(!cloudEnabled);
  const [tick, setTick] = useState(0);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    // getSession() waits for the client to finish starting up, which includes exchanging the
    // ?code=… from a sign-in link. Only after that is it safe to tidy the address bar.
    supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      setSession(data.session);
      const url = new URL(window.location.href);
      const failed = url.searchParams.get('error_description');
      if (failed || error) setAuthError(failed ?? error?.message ?? 'Sign-in failed');
      ['code', 'error', 'error_code', 'error_description'].forEach((k) => url.searchParams.delete(k));
      if (url.href !== window.location.href) window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!cloudEnabled) return;
    let alive = true;
    const done = (isOwner: boolean) => {
      if (!alive) return;
      setOwner(isOwner);
      setReady(true);
    };
    if (!session) done(false);
    else checkOwner().then(done, () => done(false));
    return () => {
      alive = false;
    };
  }, [session, tick]);

  const mode: AccessMode = !cloudEnabled ? 'local' : owner ? 'owner' : 'viewer';
  // Point storage at the right backend before the library mounts and loads.
  setStorageAdapter(mode === 'local' ? idbAdapter : cloudAdapter);

  useEffect(() => {
    document.documentElement.dataset.access = mode === 'viewer' ? 'view' : 'edit';
  }, [mode]);

  const signIn = useCallback((email: string) => sendSignInLink(email.trim()), []);
  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
  }, []);
  const recheck = useCallback(() => setTick((t) => t + 1), []);

  const value = useMemo<AccessCtx>(
    () => ({
      ready,
      mode,
      canEdit: mode !== 'viewer',
      cloud: cloudEnabled,
      email: session?.user.email ?? null,
      authError,
      signIn,
      signOut,
      recheck,
    }),
    [ready, mode, session, authError, signIn, signOut, recheck],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAccess() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAccess must be used inside AccessProvider');
  return c;
}
