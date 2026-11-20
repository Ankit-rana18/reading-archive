import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { prefersReducedMotion } from '../lib/util';

export interface Datum {
  label: string;
  value: number;
  /** Longer label for tooltips/tables. */
  full?: string;
}

const EASE = 'cubic-bezier(.2,.8,.2,1)';

function useGrowIn<T extends Element>(dep: unknown) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = prefersReducedMotion();
    const anims: Animation[] = [];
    el.querySelectorAll<SVGElement | HTMLElement>('[data-grow]').forEach((m, i) => {
      const axis = m.dataset.grow;
      anims.push(
        m.animate([{ transform: axis === 'x' ? 'scaleX(0)' : 'scaleY(0)' }, { transform: 'scale(1)' }], {
          duration: reduce ? 1 : 900,
          delay: reduce ? 0 : 120 + i * 35,
          easing: EASE,
          fill: 'both',
        }),
      );
    });
    el.querySelectorAll<SVGPathElement>('[data-draw]').forEach((p) => {
      const len = p.getTotalLength?.() ?? 0;
      p.style.strokeDasharray = `${len}`;
      anims.push(p.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: reduce ? 1 : 1400, easing: EASE, fill: 'both' }));
    });
    return () => anims.forEach((a) => a.cancel());
  }, [dep]);
  return ref;
}

/** Frame: title, optional note, chart, and a table view for accessibility. */
export function ChartFrame({ title, note, children, data, unit }: { title: string; note?: ReactNode; children: ReactNode; data: Datum[]; unit: string }) {
  const empty = data.every((d) => d.value === 0);
  return (
    <figure className="chart">
      <figcaption className="chart__head">
        <h3 className="chart__title">{title}</h3>
        {note && <span className="lbl muted">{note}</span>}
      </figcaption>
      {empty ? <p className="chart__empty muted">No data yet — this fills in as you read.</p> : children}
      {!empty && (
        <details className="chart__table">
          <summary className="lbl muted">View as table</summary>
          <table>
            <tbody>
              {data.map((d) => (
                <tr key={d.label}>
                  <th scope="row">{d.full ?? d.label}</th>
                  <td className="tnum">
                    {d.value.toLocaleString()} {unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </figure>
  );
}

/** Vertical single-series bars. */
export function Columns({ data, unit, height = 200 }: { data: Datum[]; unit: string; height?: number }) {
  const ref = useGrowIn<HTMLDivElement>(JSON.stringify(data));
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  return (
    <div className="cols" ref={ref} style={{ height }} onPointerLeave={() => setHover(null)}>
      <div className="cols__grid" aria-hidden="true">
        {ticks.map((t) => (
          <span key={t} style={{ bottom: `${(t / top) * 100}%` }}>
            <i className="tnum">{t}</i>
          </span>
        ))}
      </div>
      <div className="cols__bars" role="img" aria-label={data.map((d) => `${d.full ?? d.label}: ${d.value} ${unit}`).join(', ')}>
        {data.map((d, i) => (
          <div key={d.label} className={`cols__col ${hover === i ? 'is-hover' : ''}`} onPointerEnter={() => setHover(i)}>
            <div className="cols__track">
              {d.value > 0 && <div className="cols__bar" data-grow="y" style={{ height: `${(d.value / top) * 100}%` }} />}
              {hover === i && (
                <div className="tip" style={{ bottom: `calc(${(d.value / top) * 100}% + 8px)` }}>
                  <span className="lbl muted">{d.full ?? d.label}</span>
                  <b className="tnum">
                    {d.value.toLocaleString()} {unit}
                  </b>
                </div>
              )}
            </div>
            <span className="cols__label lbl muted">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Horizontal single-series bars with direct value labels (few rows). */
export function Bars({ data, unit }: { data: Datum[]; unit: string }) {
  const ref = useGrowIn<HTMLUListElement>(JSON.stringify(data));
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="hbars" ref={ref}>
      {data.map((d) => (
        <li key={d.label} className="hbars__row" title={`${d.full ?? d.label}: ${d.value} ${unit}`}>
          <span className="hbars__label">{d.label}</span>
          <span className="hbars__track">
            <span className="hbars__bar" data-grow="x" style={{ width: `${(d.value / max) * 100}%` }} />
          </span>
          <span className="hbars__value tnum lbl">{d.value.toLocaleString()}</span>
        </li>
      ))}
    </ul>
  );
}

/** A single cumulative line with crosshair tooltip. */
export function LineChart({ data, unit, height = 220 }: { data: Datum[]; unit: string; height?: number }) {
  const ref = useGrowIn<HTMLDivElement>(JSON.stringify(data));
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = height;
  const pad = { l: 44, r: 12, t: 14, b: 26 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const x = (i: number) => pad.l + (data.length <= 1 ? (W - pad.l - pad.r) / 2 : (i / (data.length - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - v / top) * (H - pad.t - pad.b);
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ');
  const area = `${path} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  const labelEvery = Math.ceil(data.length / 8);
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    data.forEach((_, i) => {
      if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    });
    setHover(best);
  };
  return (
    <div className="linechart" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Cumulative ${unit}`} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t} className="lc__grid">
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} />
            <text x={pad.l - 8} y={y(t) + 3} textAnchor="end">
              {t.toLocaleString()}
            </text>
          </g>
        ))}
        {data.map((d, i) =>
          i % labelEvery === 0 || i === data.length - 1 ? (
            <text key={d.label} className="lc__x" x={x(i)} y={H - 6} textAnchor="middle">
              {d.label}
            </text>
          ) : null,
        )}
        <path d={area} className="lc__area" />
        <path d={path} className="lc__line" data-draw />
        {hover !== null && (
          <g>
            <line className="lc__cross" x1={x(hover)} x2={x(hover)} y1={pad.t} y2={y(0)} />
            <circle className="lc__dot" cx={x(hover)} cy={y(data[hover].value)} r="5" />
          </g>
        )}
      </svg>
      {hover !== null && (
        <div className="tip tip--float" style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(data[hover].value) / H) * 100}%` }}>
          <span className="lbl muted">{data[hover].full ?? data[hover].label}</span>
          <b className="tnum">
            {data[hover].value.toLocaleString()} {unit}
          </b>
        </div>
      )}
    </div>
  );
}

/** Goal ring. */
export function Ring({ value, size = 168 }: { value: number; size?: number }) {
  const ref = useGrowIn<HTMLDivElement>(value);
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="ring" ref={ref} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} className="ring__track" />
        {v > 0 && (
          <path
            data-draw
            className="ring__val"
            d={`M ${size / 2} ${size / 2 - r} a ${r} ${r} 0 ${v > 0.5 ? 1 : 0} 1 ${r * Math.sin(v * 2 * Math.PI * 0.9999)} ${r - r * Math.cos(v * 2 * Math.PI * 0.9999)}`}
          />
        )}
      </svg>
      <span className="ring__pct tnum">
        {Math.round(v * 100)}
        <small>%</small>
      </span>
      <span className="sr-only">{c ? '' : ''}</span>
    </div>
  );
}

function niceTicks(max: number): number[] {
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000, 50000, 100000];
  const step = steps.find((s) => max / s <= 4) ?? Math.ceil(max / 4);
  const out: number[] = [];
  for (let t = 0; t <= max + step - 1e-9; t += step) out.push(t);
  if (out.length < 2) out.push(step);
  return out;
}
