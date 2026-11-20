import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Book } from '../types/book';
import { bookShape, prefersReducedMotion } from '../lib/util';
import { BookSpine } from './BookSpine';
import { CoverArt } from './BookCover';
import { MaskSwap } from './MaskText';

export interface ShelfHandle {
  step(dir: number): void;
  goTo(id: string): void;
  activeBook(): Book | undefined;
}

interface Props {
  books: Book[];
  startId?: string;
  /** Lines under the shelf: title, subtitle, meta. */
  caption: (b: Book) => [string, string, string];
  onOpen(book: Book, getRect: () => DOMRect | null): void;
  onActiveChange?(book: Book): void;
  /** Listen to arrow keys / Enter on the whole window. */
  globalKeys?: boolean;
  /** 'global': any wheel scrolls the shelf (full-screen hero). 'local': only horizontal wheel over the shelf. */
  wheel?: 'global' | 'local';
  /** Freeze input (a dialog is open). */
  paused?: boolean;
  className?: string;
}

const PERSPECTIVE = 2200;
const smooth = (x: number) => x * x * (3 - 2 * x);
const mod = (a: number, n: number) => ((a % n) + n) % n;

export const BookShelf = forwardRef<ShelfHandle, Props>(function BookShelf(
  { books, startId, caption, onOpen, onActiveChange, globalKeys, wheel = 'local', paused = false, className = '' },
  ref,
) {
  const N = books.length;
  const loop = N >= 7;
  const M = loop ? N * 3 : N;

  const wrapRef = useRef<HTMLElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const playRef = useRef<HTMLButtonElement>(null);
  const plankRef = useRef<HTMLDivElement>(null);
  const tapeEls = useRef<(HTMLDivElement | null)[]>([]);
  const [H, setH] = useState(0);
  const [active, setActive] = useState(0);
  const [dir, setDir] = useState(1);

  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const cb = useRef({ onOpen, onActiveChange });
  cb.current = { onOpen, onActiveChange };

  /* ---------- geometry ---------- */
  const shapes = useMemo(() => books.map((b) => bookShape(b)), [books]);
  const geo = useMemo(() => {
    const w = shapes.map((s) => s.spine * H);
    const h = shapes.map((s) => s.height * H);
    const d = h.map((x) => x * 0.66);
    const gap = H * 0.03;
    const G = gap * 1.8;
    // Prefix sums over an extended index range [-M, 2M) so we never need modulo inside sums.
    const P = new Float64Array(3 * M + 1);
    for (let e = 0; e < 3 * M; e++) P[e + 1] = P[e] + w[mod(e - M, M) % N] + gap;
    const pitch = N ? w.reduce((a, b) => a + b, 0) / N + gap : 1;
    const dMax = N ? Math.max(...d) : 0;
    const dAvg = N ? d.reduce((a, b) => a + b, 0) / N : 0;
    return { w, h, d, gap, G, P, pitch, dMax, dAvg };
  }, [shapes, H, M, N]);
  const geoRef = useRef(geo);
  geoRef.current = geo;

  /* ---------- motion state ---------- */
  const st = useRef({
    s: 0,
    T: 0,
    hover: -1,
    lift: new Float32Array(0),
    mx: -1,
    my: -1,
    tiltX: 0,
    tiltY: 0,
    onCover: false,
    active: -1,
    last: 0,
    down: null as null | { x: number; T0: number; id: number; moved: boolean },
    dragging: false,
    suppress: false,
    wheelTimer: 0 as number | undefined,
    cursor: '',
  });

  // (Re)initialise when the set of books changes, keeping the active book if possible.
  const idsKey = books.map((b) => b.id).join('|');
  const prevActiveId = useRef<string | undefined>(startId);
  useLayoutEffect(() => {
    const s = st.current;
    let idx = books.findIndex((b) => b.id === (prevActiveId.current ?? startId));
    if (idx < 0) idx = Math.floor((N - 1) / 2);
    const base = loop ? N + idx : idx;
    s.s = s.T = Math.max(0, base);
    s.lift = new Float32Array(M);
    s.active = -1;
    s.hover = -1;
    tapeEls.current.length = M;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  /* ---------- measure H from CSS --H ---------- */
  useLayoutEffect(() => {
    const measure = () => {
      const h = probeRef.current?.getBoundingClientRect().height ?? 0;
      setH((prev) => (Math.abs(prev - h) > 0.5 ? h : prev));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (wrapRef.current) ro.observe(wrapRef.current);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const clampT = useCallback(
    (T: number, soft = 0) => (loop ? T : Math.max(-soft, Math.min(N - 1 + soft, T))),
    [loop, N],
  );

  const activeV = useCallback(() => (loop ? mod(Math.round(st.current.s), M) : Math.round(st.current.s)), [loop, M]);

  const rectOfActive = useCallback(() => {
    const el = tapeEls.current[activeV()];
    return el?.querySelector('.cv')?.getBoundingClientRect() ?? null;
  }, [activeV]);

  const openActive = useCallback(() => {
    const s = st.current;
    if (!N) return;
    s.T = clampT(Math.round(s.T));
    const b = books[mod(Math.round(s.s), N)];
    if (b) cb.current.onOpen(b, rectOfActive);
  }, [N, books, clampT, rectOfActive]);

  const step = useCallback(
    (d: number) => {
      const s = st.current;
      s.T = clampT(Math.round(s.T) + d);
    },
    [clampT],
  );

  useImperativeHandle(
    ref,
    () => ({
      step,
      goTo(id: string) {
        const i = books.findIndex((b) => b.id === id);
        if (i < 0) return;
        const s = st.current;
        if (!loop) s.T = i;
        else {
          const cur = mod(Math.round(s.T), N);
          let delta = i - cur;
          if (delta > N / 2) delta -= N;
          if (delta < -N / 2) delta += N;
          s.T = Math.round(s.T) + delta;
        }
      },
      activeBook: () => (N ? books[mod(Math.round(st.current.s), N)] : undefined),
    }),
    [books, loop, N, step],
  );

  /* ---------- animation loop ---------- */
  useEffect(() => {
    if (!N || !H) return;
    let raf = 0;
    const s = st.current;
    s.last = performance.now();

    const layoutX = (c: number, rel: number) => {
      const g = geoRef.current;
      if (rel === 0) return 0;
      const dc = g.d[mod(c, M) % N];
      const idx = c + rel;
      const wi = g.w[mod(idx, M) % N];
      if (rel > 0) return dc / 2 + g.G + (g.P[idx + M] - g.P[c + 1 + M]) + wi / 2;
      return -(dc / 2 + g.G + (g.P[c + M] - g.P[idx + 1 + M]) + wi / 2);
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const g = geoRef.current;
      const wrap = wrapRef.current;
      if (!wrap) return;
      const dt = Math.min(0.05, (now - s.last) / 1000);
      s.last = now;
      const reduce = prefersReducedMotion();
      const isPaused = pausedRef.current;

      // spring
      const k = reduce ? 1e6 : s.dragging ? 18 : 5.2;
      s.s += (s.T - s.s) * (1 - Math.exp(-k * dt));
      if (Math.abs(s.T - s.s) < 1e-4) s.s = s.T;
      if (loop && Math.abs(s.s) > M * 4) {
        const shift = Math.floor(s.s / M) * M;
        s.s -= shift;
        s.T -= shift;
        if (s.down) s.down.T0 -= shift;
      }

      // active book & caption
      const act = mod(Math.round(s.s), N);
      if (act !== s.active) {
        const d = Math.sign(s.T - s.s) || 1;
        const first = s.active === -1;
        s.active = act;
        prevActiveId.current = books[act]?.id;
        setDir(first ? 1 : d);
        setActive(act);
        if (books[act]) cb.current.onActiveChange?.(books[act]);
      }

      const rect = wrap.getBoundingClientRect();
      const W = rect.width;
      const cx = rect.left + W / 2;
      const cy = rect.top + rect.height / 2;
      const dA = g.d[act];
      const settled = Math.abs(s.T - s.s) < 0.3;
      s.onCover =
        !isPaused &&
        settled &&
        s.mx >= 0 &&
        Math.abs(s.mx - cx) < 0.55 * dA &&
        Math.abs(s.my - cy) < 0.55 * H;

      // tilt toward the cursor
      let tY = 0;
      let tX = 0;
      if (s.onCover) {
        tY = ((s.mx - cx) / (0.55 * dA)) * 9;
        tX = (-(s.my - cy) / (H / 2)) * 6;
      } else if (s.mx >= 0 && !isPaused) {
        tY = ((s.mx - cx) / Math.max(1, W)) * 5;
      }
      const te = reduce ? 1 : 1 - Math.exp(-7 * dt);
      s.tiltY += (tY - s.tiltY) * te;
      s.tiltX += (tX - s.tiltX) * te;

      // tapes
      const k0 = Math.floor(s.s);
      const f = s.s - k0;
      const c0 = loop ? mod(k0, M) : k0;
      const hasNext = loop || k0 + 1 <= N - 1;
      const c1 = loop ? mod(k0 + 1, M) : k0 + 1;
      const limit = W / 2 + 1.5 * g.dMax;
      const le = reduce ? 1 : 1 - Math.exp(-12 * dt);
      for (let v = 0; v < M; v++) {
        const el = tapeEls.current[v];
        if (!el) continue;
        let rel0 = v - c0;
        if (loop) {
          rel0 = mod(rel0, M);
          if (rel0 > M / 2) rel0 -= M;
        }
        const r = rel0 - f;
        const x0 = layoutX(c0, rel0);
        const x = hasNext ? x0 + (layoutX(c1, rel0 - 1) - x0) * f : x0;
        if (Math.abs(x) > limit) {
          if (el.style.visibility !== 'hidden') el.style.visibility = 'hidden';
          continue;
        }
        if (el.style.visibility === 'hidden') el.style.visibility = '';
        const bi = v % N;
        const o = smooth(Math.max(0, 1 - Math.abs(r)));
        const liftT = s.hover === v && Math.abs(r) > 0.5 && !isPaused ? 1 : 0;
        s.lift[v] += (liftT - s.lift[v]) * le;
        const lift = s.lift[v];
        const y = ((H - g.h[bi]) / 2) * (1 - o) - o * 0.025 * H - lift * 0.045 * H;
        const z = o * 0.2 * H;
        el.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,${z.toFixed(2)}px) rotateZ(${(-4.5 * o).toFixed(3)}deg) rotateX(${(s.tiltX * o).toFixed(3)}deg) rotateY(${(-90 * o + s.tiltY * o).toFixed(3)}deg)`;
        el.style.zIndex = String(Math.round(100 - Math.abs(r) * 4));
        el.style.setProperty('--o', o.toFixed(3));
        el.style.setProperty('--lift', lift.toFixed(3));
      }

      // play ring
      const play = playRef.current;
      if (play) {
        const sc = isPaused ? 0 : smooth(Math.max(0, 1 - Math.abs(s.T - s.s) * 3));
        play.style.transform = `translate(-50%,-50%) scale(${sc.toFixed(3)})`;
        play.style.left = `${W / 2 - 0.5 * dA - 6}px`;
        play.style.top = `${rect.height / 2 + 0.36 * H}px`;
        play.tabIndex = sc > 0.5 ? 0 : -1;
      }

      // cursor hint
      const cur = s.onCover ? 'open' : s.hover >= 0 && !isPaused ? 'spine' : '';
      if (cur !== s.cursor) {
        s.cursor = cur;
        if (cur) wrap.dataset.cursor = cur;
        else delete wrap.dataset.cursor;
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [N, H, M, loop, books]);

  /* ---------- pointer input ---------- */
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const s = st.current;

    const onMove = (e: PointerEvent) => {
      s.mx = e.clientX;
      s.my = e.clientY;
      const t = (e.target as Element | null)?.closest?.('[data-v]') as HTMLElement | null;
      s.hover = t && wrap.contains(t) ? Number(t.dataset.v) : -1;
      if (s.down && e.pointerId === s.down.id) {
        const dx = e.clientX - s.down.x;
        if (!s.down.moved && Math.abs(dx) > 5) {
          s.down.moved = true;
          s.dragging = true;
          wrap.setPointerCapture?.(e.pointerId);
          wrap.classList.add('is-dragging');
        }
        if (s.down.moved) s.T = clampT(s.down.T0 - dx / geoRef.current.pitch, 0.4);
      }
    };
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && !s.down) {
        s.hover = -1;
      }
    };
    const onDown = (e: PointerEvent) => {
      if (pausedRef.current || e.button !== 0) return;
      if ((e.target as Element).closest('button')) return;
      s.down = { x: e.clientX, T0: s.T, id: e.pointerId, moved: false };
    };
    const onUp = (e: PointerEvent) => {
      const d = s.down;
      if (!d || e.pointerId !== d.id) return;
      s.down = null;
      wrap.classList.remove('is-dragging');
      if (d.moved) {
        s.dragging = false;
        s.T = clampT(Math.round(s.T));
        return;
      }
      if (pausedRef.current) return;
      // a click
      const t = (e.target as Element).closest('[data-v]') as HTMLElement | null;
      if (s.onCover && e.pointerType === 'mouse') {
        openActive();
        return;
      }
      if (!t) return;
      const v = Number(t.dataset.v);
      let rel = v - (loop ? mod(Math.round(s.s), M) : Math.round(s.s));
      if (loop) {
        rel = mod(rel, M);
        if (rel > M / 2) rel -= M;
      }
      if (rel === 0 && Math.abs(s.T - s.s) < 0.5) openActive();
      else s.T = clampT(Math.round(s.T) + rel);
    };
    const onCancel = () => {
      s.down = null;
      s.dragging = false;
      wrap.classList.remove('is-dragging');
      s.T = clampT(Math.round(s.T));
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    wrap.addEventListener('pointerleave', onLeave);
    wrap.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      window.removeEventListener('pointermove', onMove);
      wrap.removeEventListener('pointerleave', onLeave);
      wrap.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
  }, [clampT, openActive, loop, M]);

  /* ---------- wheel ---------- */
  useEffect(() => {
    const target: Window | HTMLElement | null = wheel === 'global' ? window : wrapRef.current;
    if (!target) return;
    const s = st.current;
    const onWheel = (ev: Event) => {
      const e = ev as WheelEvent;
      if (pausedRef.current || !N) return;
      if ((e.target as Element)?.closest?.('[data-no-shelf-wheel]')) return;
      const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      if (wheel === 'local' && !horizontal && !e.shiftKey) return;
      e.preventDefault();
      const delta = horizontal ? e.deltaX : e.deltaY;
      const unit = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? 400 : 1;
      s.T = clampT(s.T + ((delta * unit) / geoRef.current.pitch) * 0.5, 0.3);
      window.clearTimeout(s.wheelTimer);
      s.wheelTimer = window.setTimeout(() => (s.T = clampT(Math.round(s.T))), 160);
    };
    target.addEventListener('wheel', onWheel, { passive: false });
    return () => target.removeEventListener('wheel', onWheel);
  }, [wheel, clampT, N]);

  /* ---------- keyboard ---------- */
  useEffect(() => {
    const wrap = wrapRef.current;
    const onKey = (e: KeyboardEvent) => {
      if (pausedRef.current || !N) return;
      const a = document.activeElement;
      const typing = a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || (a as HTMLElement).isContentEditable);
      if (typing) return;
      const inShelf = wrap?.contains(a) || a === wrap;
      if (!globalKeys && !inShelf) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        step(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        step(1);
      } else if (e.key === 'Enter' && (a === document.body || a === wrap || !a)) {
        e.preventDefault();
        openActive();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [globalKeys, N, step, openActive]);

  const cur = books[active];
  const [l1, l2, l3] = cur ? caption(cur) : ['', '', ''];
  const plankY = H ? (H / 2) * (PERSPECTIVE / (PERSPECTIVE - geo.dAvg / 2)) : 0;

  return (
    <div className={`shelf-block ${className}`}>
      <section
        ref={wrapRef}
        className="shelf"
        aria-label="Bookshelf"
        aria-roledescription="carousel"
        tabIndex={0}
      >
        <div ref={probeRef} className="shelf__probe" aria-hidden="true" />
        <div ref={plankRef} className="shelf__plank" style={{ top: `calc(50% + ${plankY}px)` }} aria-hidden="true" />
        <div className="stage" style={{ '--H': `${H}px` } as React.CSSProperties}>
          {H > 0 &&
            Array.from({ length: M }, (_, v) => {
              const bi = v % N;
              const b = books[bi];
              const w = geo.w[bi];
              const h = geo.h[bi];
              const d = geo.d[bi];
              return (
                <div
                  key={`${b.id}-${v}`}
                  ref={(el) => (tapeEls.current[v] = el)}
                  className="tape"
                  data-v={v}
                  aria-hidden={v % N !== active || undefined}
                >
                  <div
                    className="tape__face sp"
                    style={{ width: w, height: h, left: -w / 2, top: -h / 2, transform: `translateZ(${d / 2}px)` }}
                  >
                    <BookSpine book={b} width={w} height={h} variant={shapes[bi].style} />
                  </div>
                  <div
                    className="tape__face cv"
                    style={{ width: d, height: h, left: -d / 2, top: -h / 2, transform: `rotateY(90deg) translateZ(${w / 2}px)` }}
                  >
                    <CoverArt book={b} eager={Math.abs(v - (loop ? N : 0) - active) < 4} />
                    <span className="cv__hinge" />
                  </div>
                </div>
              );
            })}
        </div>
        <button ref={playRef} className="playring" aria-label={cur ? `Open ${cur.title}` : 'Open book'} onClick={openActive}>
          <svg width="13" height="13" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M3.2 1.6 L10.4 6 L3.2 10.4 Z" fill="currentColor" />
          </svg>
        </button>
      </section>

      <div className="caption">
        <button className="caption__arrow caption__arrow--prev" aria-label="Previous book" onClick={() => step(-1)} disabled={!loop && active === 0}>
          <svg width="18" height="10" viewBox="0 0 18 10" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
            <path d="M5 1 L1 5 L5 9 M1 5 H17" />
          </svg>
        </button>
        <div className="caption__lines" aria-live="polite">
          <MaskSwap text={l1} dir={dir} className="caption__title" />
          <MaskSwap text={l2} dir={dir} className="caption__sub lbl" />
          <MaskSwap text={l3} dir={dir} className="caption__meta" />
        </div>
        <button className="caption__arrow caption__arrow--next" aria-label="Next book" onClick={() => step(1)} disabled={!loop && active === N - 1}>
          <svg width="18" height="10" viewBox="0 0 18 10" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
            <path d="M13 1 L17 5 L13 9 M17 5 H1" />
          </svg>
        </button>
      </div>
    </div>
  );
});
