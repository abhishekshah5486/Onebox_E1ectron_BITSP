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

// The Knowledge mark: a soft orb of light whose colour bands turn against each other.
export function KnowledgeLogo({ size = 24 }: { size?: number }) {
  return (
    <span className={styles.orbHalo} style={{ fontSize: size }} aria-hidden="true">
      <span className={styles.orb}>
        <i />
      </span>
    </span>
  );
}
