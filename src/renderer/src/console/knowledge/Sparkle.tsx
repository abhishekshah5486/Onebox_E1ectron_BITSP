import { useEffect, useId, useRef } from 'react';
import { drawPrism } from './prism';
import styles from './Knowledge.module.css';

// Two four-point stars filled with the assistant gradient.
export function Sparkle({ size = 20 }: { size?: number }) {
  const id = useId();
  return (
    <svg
      className={styles.sparkle}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a78bfa" />
          <stop offset="0.55" stopColor="#6366f1" />
          <stop offset="1" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${id})`}
        d="M14 6c.6 4.2 2.3 5.9 6.5 6.5-4.2.6-5.9 2.3-6.5 6.5-.6-4.2-2.3-5.9-6.5-6.5C11.7 11.9 13.4 10.2 14 6Z"
      />
      <path
        fill={`url(#${id})`}
        d="M6 2c.3 2 1.1 2.8 3 3-1.9.3-2.7 1.1-3 3-.3-1.9-1.1-2.7-3-3 1.9-.2 2.7-1 3-3Z"
      />
    </svg>
  );
}

export function FlowLoader({ label }: { label: string }) {
  return (
    <div className={styles.loader} role="status" aria-label={label}>
      <Sparkle size={36} />
      <div className={styles.loaderLine} />
    </div>
  );
}

// The Knowledge service icon, flat like the console's: a hexagon around a spark.
export function KnowledgeLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className={styles.logo}>
      <rect width="48" height="48" fill="#7638fa" />
      <path
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M24 10l12 7v14l-12 7-12-7V17ZM24 17.5c.6 4 2.5 5.9 6.5 6.5-4 .6-5.9 2.5-6.5 6.5-.6-4-2.5-5.9-6.5-6.5 4-.6 5.9-2.5 6.5-6.5Z"
      />
    </svg>
  );
}

// A soft orb of light whose colour bands turn against each other.
export function KnowledgeOrb({ size = 24 }: { size?: number }) {
  return (
    <span className={styles.orbHalo} style={{ fontSize: size }} aria-hidden="true">
      <span className={styles.orb}>
        <i />
      </span>
    </span>
  );
}

// A glass prism splitting a beam of light, redrawn each frame (still when motion is reduced).
export function KnowledgePrism({ width = 160 }: { width?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const height = Math.round(width * 0.6);
  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    const scale = window.devicePixelRatio || 1;
    el.width = width * scale;
    el.height = height * scale;
    const dark = () =>
      !!el.closest('.awsui-dark-mode') || document.body.classList.contains('awsui-dark-mode');
    const frame = (time: number) => {
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      drawPrism(ctx, width, height, time, dark());
    };
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      frame(0);
      return;
    }
    let id = requestAnimationFrame(function loop(time) {
      frame(time);
      id = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(id);
  }, [width, height]);
  return (
    <canvas ref={canvas} className={styles.prism} style={{ width, height }} aria-hidden="true" />
  );
}
