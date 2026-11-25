import { useId } from 'react';
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

// The Knowledge service icon: a page under a lens with a spark, on the assistant gradient.
export function KnowledgeLogo({ size = 24 }: { size?: number }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className={styles.logo}>
      <defs>
        <linearGradient id={id} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#3b1a8f" />
          <stop offset="0.55" stopColor="#7c3aed" />
          <stop offset="1" stopColor="#4f8bf9" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="6" fill={`url(#${id})`} />
      <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 36H13V9h14l6 6v9.5" />
        <path d="M27 9v6h6" />
        <path d="M17 17h7M17 21h11M17 25h6" />
        <circle cx="31" cy="32" r="5.5" />
        <path d="M35 36l4.5 4.5" />
      </g>
      <path
        fill="#fff"
        d="M31 29.6c.4 1.6.8 2 2.4 2.4-1.6.4-2 .8-2.4 2.4-.4-1.6-.8-2-2.4-2.4 1.6-.4 2-.8 2.4-2.4Z"
      />
    </svg>
  );
}
