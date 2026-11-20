import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Prefs } from '../types/book';
import { loadPrefs, savePrefs } from '../services/storage';

interface PrefsCtx {
  prefs: Prefs;
  setPrefs(patch: Partial<Prefs>): void;
  yearGoal(year: number): number | undefined;
  setYearGoal(year: number, target: number | undefined): void;
}

const Ctx = createContext<PrefsCtx | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setState] = useState<Prefs>(loadPrefs);

  useEffect(() => {
    savePrefs(prefs);
    const root = document.documentElement;
    root.dataset.theme = prefs.theme;
    if (prefs.motion === 'reduce') root.dataset.motion = 'reduce';
    else delete root.dataset.motion;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', prefs.theme === 'ink' ? '#171614' : '#EDEBE6');
  }, [prefs]);

  const setPrefs = useCallback((patch: Partial<Prefs>) => setState((p) => ({ ...p, ...patch })), []);
  const yearGoal = useCallback((y: number) => prefs.yearGoals[String(y)], [prefs.yearGoals]);
  const setYearGoal = useCallback(
    (y: number, target: number | undefined) =>
      setState((p) => {
        const yearGoals = { ...p.yearGoals };
        if (target && target > 0) yearGoals[String(y)] = Math.round(target);
        else delete yearGoals[String(y)];
        return { ...p, yearGoals };
      }),
    [],
  );

  return <Ctx.Provider value={{ prefs, setPrefs, yearGoal, setYearGoal }}>{children}</Ctx.Provider>;
}

export function usePrefs() {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePrefs must be used inside PrefsProvider');
  return c;
}
