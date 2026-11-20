import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ReadingStatus } from '../types/book';

export interface DetailOrigin {
  /** Screen rect the paper sheet grows out of. */
  getRect?: () => DOMRect | null;
  tilt?: number;
}

export interface ConfirmOptions {
  title: string;
  body?: string;
  confirmLabel?: string;
  danger?: boolean;
  /** User must type this word to enable the confirm button. */
  requireText?: string;
}

export interface Toast {
  id: number;
  msg: string;
  tone: 'info' | 'error';
}

interface UICtx {
  toasts: Toast[];
  toast(msg: string, tone?: Toast['tone']): void;
  confirmState: (ConfirmOptions & { resolve(v: boolean): void }) | null;
  confirm(o: ConfirmOptions): Promise<boolean>;
  closeConfirm(v: boolean): void;
  detail: { id: string; origin: DetailOrigin; focus?: string } | null;
  openDetail(id: string, origin?: DetailOrigin, focus?: string): void;
  closeDetail(): void;
  editor: { mode: 'add'; status?: ReadingStatus } | { mode: 'edit'; id: string } | null;
  openAdd(status?: ReadingStatus): void;
  openEdit(id: string): void;
  closeEditor(): void;
  searchOpen: boolean;
  setSearchOpen(v: boolean): void;
  completeId: string | null;
  openComplete(id: string): void;
  closeComplete(): void;
}

const Ctx = createContext<UICtx | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirm] = useState<UICtx['confirmState']>(null);
  const [detail, setDetail] = useState<UICtx['detail']>(null);
  const [editor, setEditor] = useState<UICtx['editor']>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [completeId, setCompleteId] = useState<string | null>(null);
  const n = useRef(0);

  const toast = useCallback((msg: string, tone: Toast['tone'] = 'info') => {
    const id = ++n.current;
    setToasts((t) => [...t.slice(-2), { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 6000 : 3200);
  }, []);

  const confirm = useCallback(
    (o: ConfirmOptions) => new Promise<boolean>((resolve) => setConfirm({ ...o, resolve })),
    [],
  );
  const closeConfirm = useCallback((v: boolean) => {
    setConfirm((c) => {
      c?.resolve(v);
      return null;
    });
  }, []);

  const value = useMemo<UICtx>(
    () => ({
      toasts,
      toast,
      confirmState,
      confirm,
      closeConfirm,
      detail,
      openDetail: (id, origin = {}, focus) => setDetail({ id, origin, focus }),
      closeDetail: () => setDetail(null),
      editor,
      openAdd: (status) => setEditor({ mode: 'add', status }),
      openEdit: (id) => setEditor({ mode: 'edit', id }),
      closeEditor: () => setEditor(null),
      searchOpen,
      setSearchOpen,
      completeId,
      openComplete: (id) => setCompleteId(id),
      closeComplete: () => setCompleteId(null),
    }),
    [toasts, toast, confirmState, confirm, closeConfirm, detail, editor, searchOpen, completeId],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUI() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useUI must be used inside UIProvider');
  return c;
}
