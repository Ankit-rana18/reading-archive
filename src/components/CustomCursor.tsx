import { useEffect, useRef } from 'react';

/**
 * A ring cursor that eases after the pointer. States come from the nearest
 * [data-cursor] ancestor: "spine" (shrinks), "open"/"view" (cobalt disc with a label),
 * or any button/link (small ring, no dot).
 */
export function CustomCursor() {
  const ref = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine)');
    if (!fine.matches) return;
    document.documentElement.classList.add('has-cursor');
    const el = ref.current!;
    let mx = -100;
    let my = -100;
    let x = -100;
    let y = -100;
    let target: Element | null = null;
    let visible = false;
    let last = performance.now();
    let raf = 0;
    let state = '';

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      mx = e.clientX;
      my = e.clientY;
      target = e.target as Element;
      if (!visible) {
        visible = true;
        x = mx;
        y = my;
        el.classList.add('is-visible');
      }
    };
    const onLeave = () => {
      visible = false;
      el.classList.remove('is-visible');
    };
    const onDown = () => el.classList.add('is-down');
    const onUp = () => el.classList.remove('is-down');

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const k = 1 - Math.exp(-16 * dt);
      x += (mx - x) * k;
      y += (my - y) * k;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;

      let next = '';
      let label = '';
      if (target && target.isConnected) {
        const hint = target.closest('[data-cursor]') as HTMLElement | null;
        const interactive = target.closest('button, a, select, label, input[type="range"], input[type="checkbox"], [role="button"], summary');
        const text = target.closest('input:not([type="range"]):not([type="checkbox"]), textarea, [contenteditable="true"]');
        if (hint?.dataset.cursor === 'open' || hint?.dataset.cursor === 'view') {
          next = 'open';
          label = hint.dataset.cursorLabel ?? (hint.dataset.cursor === 'open' ? 'Open' : 'View');
        } else if (text) next = 'text';
        else if (interactive && !(hint?.dataset.cursor === 'spine')) next = 'btn';
        else if (hint?.dataset.cursor === 'spine') next = 'spine';
      }
      if (next !== state) {
        el.dataset.state = next;
        state = next;
      }
      if (labelRef.current && label && labelRef.current.textContent !== label) labelRef.current.textContent = label;
    };
    raf = requestAnimationFrame(frame);

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      document.documentElement.classList.remove('has-cursor');
    };
  }, []);

  return (
    <div ref={ref} className="cursor" aria-hidden="true">
      <span className="cursor__ring" />
      <span className="cursor__dot" />
      <span className="cursor__label" ref={labelRef}>
        Open
      </span>
    </div>
  );
}
