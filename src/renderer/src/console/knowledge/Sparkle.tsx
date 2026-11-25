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

// The Knowledge service icon, in the console's flat style: a tree whose branches end in ideas.
export function KnowledgeLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className={styles.logo}>
      <rect width="48" height="48" rx="4" fill="#01a88d" />
      <path
        fill="none"
        stroke="#fff"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M24 38V22M24 28l-7-6M24 25l7-7M17 22v-6M31 18l-4-5M24 22l3-9M17 22h-5M24 28l12-3M18 38h12"
      />
      <g fill="#fff">
        <circle cx="17" cy="15" r="1.9" />
        <circle cx="26.5" cy="12" r="1.9" />
        <circle cx="32" cy="18" r="1.9" />
        <circle cx="12" cy="22" r="1.9" />
        <circle cx="36" cy="25" r="1.9" />
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

// The spectrum a white beam leaves the prism as: red bent least, violet most.
const BANDS = [
  ['#ff3b3b', '75.6,37 76.5,38.6 124,49.3 124,44'],
  ['#ff9a1f', '76.5,38.6 77.4,40.1 124,54.7 124,49.3'],
  ['#ffe53b', '77.4,40.1 78.3,41.7 124,60 124,54.7'],
  ['#3bdc6a', '78.3,41.7 79.2,43.3 124,65.3 124,60'],
  ['#2f8cff', '79.2,43.3 80.1,44.8 124,70.7 124,65.3'],
  ['#8a4dff', '80.1,44.8 81,46.4 124,76 124,70.7'],
] as const;

// A glass prism splitting a beam of light into its colours.
export function KnowledgePrism({ width = 120 }: { width?: number }) {
  const id = useId();
  const ref = (name: string) => `url(#${id}${name})`;
  const bands = BANDS.map(([fill, points]) => <polygon key={fill} points={points} fill={fill} />);
  return (
    <svg
      className={styles.prism}
      width={width}
      height={(width * 80) / 128}
      viewBox="0 0 128 80"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${id}glass`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.34" />
          <stop offset="0.5" stopColor="#cfe3ff" stopOpacity="0.1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.22" />
        </linearGradient>
        <linearGradient id={`${id}inner`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.6" stopColor="#ffd6a5" />
          <stop offset="1" stopColor="#b39dff" />
        </linearGradient>
        <linearGradient id={`${id}beam`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" className={styles.beamFrom} />
          <stop offset="1" className={styles.beamTo} />
        </linearGradient>
        <radialGradient id={`${id}glint`}>
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}fade`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0.55" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={`${id}mask`}>
          <rect width="128" height="80" fill={ref('fade')} />
        </mask>
        <filter id={`${id}soft`} x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="0.6" />
        </filter>
        <filter id={`${id}glow`} x="-30%" y="-80%" width="160%" height="260%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <g className={styles.spectrum} mask={ref('mask')}>
        <g filter={ref('glow')} opacity="0.7">
          {bands}
        </g>
        <g filter={ref('soft')} opacity="0.92">
          {bands}
        </g>
      </g>
      <line
        className={styles.beamGlow}
        x1="0"
        y1="47"
        x2="43.5"
        y2="38.6"
        strokeWidth="4"
        filter={ref('glow')}
      />
      <line
        x1="0"
        y1="47"
        x2="43.5"
        y2="38.6"
        stroke={ref('beam')}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <polygon className={styles.glassBack} points="67,5 37,57 97,57" />
      <path className={styles.glassBack} d="M60 10L67 5M90 62L97 57" />
      <polygon className={styles.glassFront} points="60,10 30,62 90,62" fill={ref('glass')} />
      <polygon points="43.5,38.6 75.6,37 81,46.4" fill={ref('inner')} opacity="0.5" />
      <path
        d="M58.5 14L34 59"
        stroke="#fff"
        strokeOpacity="0.75"
        strokeWidth="0.9"
        strokeLinecap="round"
      />
      <circle className={styles.glint} cx="43.5" cy="38.6" r="3.2" fill={ref('glint')} />
      <circle cx="78.3" cy="41.7" r="2.6" fill={ref('glint')} opacity="0.7" />
    </svg>
  );
}
