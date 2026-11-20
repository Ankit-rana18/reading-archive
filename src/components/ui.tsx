import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useUI } from '../hooks/useUI';
import { prefersReducedMotion } from '../lib/util';
import { Line, Rise } from './MaskText';

const EASE = 'cubic-bezier(.2,.8,.2,1)';
const SHEET = 'cubic-bezier(.76,0,.18,1)';

/* ---------------- Stars ---------------- */
export function Stars({
  value,
  onChange,
  size = 'md',
  label = 'Rating',
}: {
  value?: number;
  onChange?: (v: number | undefined) => void;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;
  const px = size === 'lg' ? 24 : size === 'sm' ? 11 : 15;
  const star = (filled: boolean) => (
    <svg width={px} height={px} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2.8l2.75 5.9 6.45.75-4.78 4.4 1.27 6.37L12 17.05 6.31 20.22l1.27-6.37L2.8 9.45l6.45-.75z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
  if (!onChange) {
    return (
      <span className="stars" role="img" aria-label={value ? `${value} out of 5` : 'Not rated'}>
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i}>{star(i <= (value ?? 0))}</span>
        ))}
      </span>
    );
  }
  return (
    <span className={`stars stars--${size}`} role="radiogroup" aria-label={label} onPointerLeave={() => setHover(null)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`${i} star${i > 1 ? 's' : ''}`}
          onPointerEnter={() => setHover(i)}
          onClick={() => onChange(value === i ? undefined : i)}
        >
          {star(i <= shown)}
        </button>
      ))}
    </span>
  );
}

/* ---------------- Tabs with sliding accent indicator ---------------- */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  className = '',
}: {
  items: { value: T; label: ReactNode; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const ind = useRef<HTMLSpanElement>(null);
  const place = () => {
    const btn = wrap.current?.querySelector<HTMLElement>(`[data-value="${CSS.escape(value)}"]`);
    if (btn && ind.current) {
      ind.current.style.width = `${btn.offsetWidth}px`;
      ind.current.style.transform = `translateX(${btn.offsetLeft}px)`;
    }
  };
  useLayoutEffect(place);
  useEffect(() => {
    const ro = new ResizeObserver(place);
    if (wrap.current) ro.observe(wrap.current);
    document.fonts?.ready.then(place);
    return () => ro.disconnect();
  });
  return (
    <div ref={wrap} className={`tabs ${className}`} role="tablist" aria-label={label}>
      <span ref={ind} className="tabs__ind" aria-hidden="true" />
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          role="tab"
          data-value={it.value}
          aria-selected={it.value === value}
          className="tabs__btn lbl"
          onClick={() => onChange(it.value)}
        >
          {it.label}
          {it.count !== undefined && <span className="tabs__count">{it.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Page head ---------------- */
export function PageHead({ kicker, title, dek, aside }: { kicker: string; title: ReactNode; dek?: ReactNode; aside?: ReactNode }) {
  return (
    <header className="page-head">
      <Rise delay={80}>
        <Line className="page-head__kicker lbl">{kicker}</Line>
        <Line as="h1" className="page-head__title">
          {title}
        </Line>
        {dek && (
          <Line as="p" className="page-head__dek">
            {dek}
          </Line>
        )}
      </Rise>
      {aside && <div className="page-head__aside">{aside}</div>}
    </header>
  );
}

/* ---------------- Modal: a sheet of paper that unrolls from the bottom ---------------- */
export function Modal({
  open,
  onClose,
  title,
  kicker,
  children,
  width = 760,
  className = '',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  kicker?: string;
  children: ReactNode;
  width?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(open);
  const closing = useRef(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      closing.current = false;
    } else if (mounted && ref.current && !closing.current) {
      closing.current = true;
      const reduce = prefersReducedMotion();
      const a = ref.current.animate([{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(100% 0 0 0)' }], {
        duration: reduce ? 1 : 520,
        easing: SHEET,
        fill: 'both',
      });
      a.onfinish = () => {
        setMounted(false);
        closing.current = false;
      };
    }
  }, [open, mounted]);

  useLayoutEffect(() => {
    if (!mounted || !open || !ref.current) return;
    const reduce = prefersReducedMotion();
    ref.current.animate([{ clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], {
      duration: reduce ? 1 : 700,
      easing: SHEET,
      fill: 'both',
    });
    panel.current?.animate([{ transform: 'translateY(60px)' }, { transform: 'translateY(0)' }], {
      duration: reduce ? 1 : 900,
      easing: EASE,
      fill: 'both',
    });
    const prevFocus = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => {
      const f = panel.current?.querySelector<HTMLElement>('[autofocus], input, textarea, select, button:not(.modal__close)');
      f?.focus({ preventScroll: true });
    }, 60);
    document.body.classList.add('lock');
    return () => {
      clearTimeout(t);
      if (!document.querySelector('.modal-layer ~ .modal-layer')) document.body.classList.remove('lock');
      prevFocus?.focus?.({ preventScroll: true });
    };
  }, [mounted, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  if (!mounted) return null;
  return createPortal(
    <div ref={ref} className={`modal-layer ${className}`} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={panel} className="modal" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} style={{ maxWidth: width }}>
        <header className="modal__head">
          <div>
            {kicker && <div className="lbl accent">{kicker}</div>}
            <h2 className="modal__title">{title}</h2>
          </div>
          <button type="button" className="modal__close box lbl" onClick={onClose}>
            Close <X size={12} strokeWidth={1.6} />
          </button>
        </header>
        <div className="modal__body" data-no-shelf-wheel>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ---------------- Confirm dialog ---------------- */
export function ConfirmHost() {
  const { confirmState: c, closeConfirm } = useUI();
  const [typed, setTyped] = useState('');
  useEffect(() => setTyped(''), [c]);
  const ok = !c?.requireText || typed.trim().toUpperCase() === c.requireText.toUpperCase();
  return (
    <Modal open={!!c} onClose={() => closeConfirm(false)} title={c?.title ?? ''} kicker="Please confirm" width={520}>
      {c && (
        <form
          className="confirm"
          onSubmit={(e) => {
            e.preventDefault();
            if (ok) closeConfirm(true);
          }}
        >
          {c.body && <p className="confirm__body">{c.body}</p>}
          {c.requireText && (
            <label className="field">
              <span>Type {c.requireText} to confirm</span>
              <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
            </label>
          )}
          <div className="confirm__actions">
            <button type="button" className="btn" onClick={() => closeConfirm(false)}>
              Cancel
            </button>
            <button type="submit" className={`btn ${c.danger ? 'btn--danger' : 'btn--solid'}`} disabled={!ok} autoFocus={!c.requireText}>
              {c.confirmLabel ?? 'Confirm'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/* ---------------- Toasts ---------------- */
export function ToastHost() {
  const { toasts } = useUI();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.tone}`}>
          <span className="lbl">{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Progress bar that animates in ---------------- */
export function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setV(value));
    return () => cancelAnimationFrame(id);
  }, [value]);
  return (
    <div className={`bar ${className}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
      <i style={{ '--v': v } as React.CSSProperties} />
    </div>
  );
}
