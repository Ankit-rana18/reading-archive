import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../lib/util';

const BASE = import.meta.env.BASE_URL;
const VIDEO = `${BASE}media/sunset-field.mp4`;

/**
 * The live landscape behind the whole site: a muted, looping, inline video under a warm paper wash.
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
