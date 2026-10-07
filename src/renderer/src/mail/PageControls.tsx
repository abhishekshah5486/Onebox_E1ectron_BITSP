import { Icon } from '../ui/Icon';
import styles from './MailboxPage.module.css';

interface PageControlsProps {
  label: string;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  busy?: boolean;
}

export function PageControls({ label, canPrev, canNext, onPrev, onNext, busy }: PageControlsProps) {
  return (
    <div className={styles.paging}>
      <span className={styles.count} aria-live="polite">
        {label}
      </span>
      <button aria-label="Newer" title="Newer" disabled={!canPrev || busy} onClick={onPrev}>
        <Icon name="back" size={18} />
      </button>
      <button
        aria-label="Older"
        title="Older"
        disabled={!canNext || busy}
        onClick={onNext}
        className={styles.flip}
      >
        <Icon name="back" size={18} />
      </button>
    </div>
  );
}

export function SkeletonRows({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className={styles.skeletons}>
      <p className={styles.status}>{label}</p>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className={styles.skeleton} />
      ))}
    </div>
  );
}
