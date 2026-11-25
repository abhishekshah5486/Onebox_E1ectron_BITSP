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

// The Knowledge service icon, in the console's flat style: a hexagon of linked ideas.
export function KnowledgeLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className={styles.logo}>
      <rect width="48" height="48" rx="4" fill="#7b3fe4" />
      <g fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M24 9l13 7.5v15L24 39l-13-7.5v-15Z" />
        <path d="M24 24l-6-4M24 24l6-4M24 24v7" />
      </g>
      <g fill="#fff">
        <circle cx="24" cy="24" r="2.6" />
        <circle cx="18" cy="20" r="1.8" />
        <circle cx="30" cy="20" r="1.8" />
        <circle cx="24" cy="31" r="1.8" />
      </g>
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
