import { useLayoutEffect, useRef, type ElementType, type ReactNode } from 'react';
import { prefersReducedMotion } from '../lib/util';

const EASE = 'cubic-bezier(.2,.8,.2,1)';

/**
 * A line of text inside an overflow mask. When `text` changes the new text slides in
 * from `dir` (+1: from below, −1: from above) while the old text slides out the other way.
 */
export function MaskSwap({ text, dir, className = '' }: { text: string; dir: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const make = () => {
      const s = document.createElement('span');
      s.textContent = text;
      return s;
    };
    if (first.current || prefersReducedMotion()) {
      first.current = false;
      el.replaceChildren(make());
      return;
    }
    const d = dir >= 0 ? 1 : -1;
    el.querySelectorAll<HTMLSpanElement>('span:not([data-leaving])').forEach((old) => {
      old.dataset.leaving = '1';
      const cur = getComputedStyle(old).transform;
      const a = old.animate(
        [{ transform: cur === 'none' ? 'translateY(0)' : cur }, { transform: `translateY(${-d * 105}%)` }],
        { duration: 650, easing: EASE, fill: 'both' },
      );
      a.onfinish = () => old.remove();
    });
    const span = make();
    el.append(span);
    span.animate([{ transform: `translateY(${d * 105}%)` }, { transform: 'translateY(0)' }], {
      duration: 650,
      easing: EASE,
      fill: 'both',
    });
  }, [text, dir]);
  return <div ref={ref} className={`mask-swap ${className}`} />;
}

/**
 * Children rise out of their own overflow masks on mount, one after another.
 * Wrap each line in <Line>.
 */
export function Rise({
  children,
  delay = 0,
  stagger = 75,
  as: Tag = 'div',
  className,
  trigger,
}: {
  children: ReactNode;
  delay?: number;
  stagger?: number;
  as?: ElementType;
  className?: string;
  trigger?: unknown;
}) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const items = Array.from(el.querySelectorAll<HTMLElement>('.rise'));
    const reduce = prefersReducedMotion();
    const anims = items.map((it, i) =>
      it.animate([{ transform: 'translateY(110%)' }, { transform: 'translateY(0)' }], {
        duration: reduce ? 1 : 900,
        delay: reduce ? 0 : delay + i * stagger,
        easing: EASE,
        fill: 'both',
      }),
    );
    return () => anims.forEach((a) => a.cancel());
  }, [delay, stagger, trigger]);
  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}

export function Line({ children, className = '', as: Tag = 'div' }: { children: ReactNode; className?: string; as?: ElementType }) {
  return (
    <Tag className={`mask ${className}`}>
      <span className="rise">{children}</span>
    </Tag>
  );
}
