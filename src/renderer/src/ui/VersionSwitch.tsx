import { useEffect, useRef, useState } from 'react';
import { useUiVersion, type UiVersion } from '../theme/UiVersionProvider';
import styles from './VersionSwitch.module.css';

const SLIDE_MS = 220;
const VERSIONS: { id: UiVersion; label: string; title: string }[] = [
  { id: 'v1', label: 'v1', title: 'Classic (Gmail style)' },
  { id: 'v2', label: 'v2', title: 'Console (AWS style)' },
];

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// The pill slides to the chosen version first, then the interface swaps underneath it.
export function VersionSwitch() {
  const { version, setVersion } = useUiVersion();
  const [shown, setShown] = useState(version);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const choose = (next: UiVersion) => {
    if (next === shown) return;
    setShown(next);
    clearTimeout(timer.current);
    if (reducedMotion()) setVersion(next);
    else timer.current = setTimeout(() => setVersion(next), SLIDE_MS);
  };

  return (
    <div className={styles.switch} role="radiogroup" aria-label="Interface version">
      <span
        className={styles.thumb}
        style={{ transform: shown === 'v2' ? 'translateX(100%)' : 'none' }}
        aria-hidden="true"
      />
      {VERSIONS.map(({ id, label, title }) => (
        <button
          key={id}
          role="radio"
          aria-checked={shown === id}
          aria-label={`${label} · ${title}`}
          title={title}
          className={`${styles.option} ${shown === id ? styles.selected : ''}`}
          onClick={() => choose(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
