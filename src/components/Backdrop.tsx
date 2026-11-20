import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../lib/util';

const BASE = import.meta.env.BASE_URL;
const VIDEO = `${BASE}media/sunset-field.mp4`;

/**
 * The live landscape behind the whole site: a muted, looping, inline video, shown at full strength.
 * Readability comes from the liquid-glass surfaces on top of it, not from a wash over the video.
 * Paused while the tab is hidden; with reduced motion it rests on its first frame. A blurred still
 * (.backdrop::before) shows underneath until the video paints, or if it cannot play at all.
 */
export function Backdrop({ dense }: { dense: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [still, setStill] = useState(() => prefersReducedMotion());

  // follow the OS setting and the in-app motion preference
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setStill(prefersReducedMotion());
    mq.addEventListener('change', sync);
    const mo = new MutationObserver(sync);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
    return () => {
      mq.removeEventListener('change', sync);
      mo.disconnect();
    };
  }, []);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const play = () => {
      if (still || document.hidden) v.pause();
      // Autoplay can be refused (data saver, strict policies): the poster frame stays in place.
      else v.play().catch(() => {});
    };
    play();
    document.addEventListener('visibilitychange', play);
    return () => document.removeEventListener('visibilitychange', play);
  }, [still]);

  // Liquid-glass light: every glass surface reads --gx/--gy (viewport px) for its specular highlight,
  // so one light source moves across the whole interface. Follows the pointer; drifts slowly on touch.
  useEffect(() => {
    const root = document.documentElement.style;
    let x = window.innerWidth * 0.3;
    let y = window.innerHeight * 0.15;
    let tx = x;
    let ty = y;
    let lastMove = -1e9;
    let raf = 0;
    const set = () => {
      root.setProperty('--gx', `${x.toFixed(1)}px`);
      root.setProperty('--gy', `${y.toFixed(1)}px`);
    };
    set();
    if (still) return;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      tx = e.clientX;
      ty = e.clientY;
      lastMove = performance.now();
    };
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (document.hidden) return;
      if (now - lastMove > 4000) {
        // idle / touch: a slow lissajous drift, like light moving over water
        const t = now / 1000;
        tx = window.innerWidth * (0.5 + 0.38 * Math.sin(t * 0.21));
        ty = window.innerHeight * (0.35 + 0.3 * Math.sin(t * 0.13 + 1.3));
      }
      const k = 0.12;
      const nx = x + (tx - x) * k;
      const ny = y + (ty - y) * k;
      if (Math.abs(nx - x) + Math.abs(ny - y) < 0.2) return;
      x = nx;
      y = ny;
      set();
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
    };
  }, [still]);

  return (
    <div className={`backdrop${dense ? ' backdrop--dense' : ''}`} aria-hidden="true">
      <video
        ref={ref}
        className="backdrop__video"
        src={VIDEO}
        muted
        loop
        playsInline
        autoPlay={!still}
        preload={still ? 'none' : 'metadata'}
        disablePictureInPicture
        tabIndex={-1}
      />
      <div className="backdrop__wash" />
    </div>
  );
}
