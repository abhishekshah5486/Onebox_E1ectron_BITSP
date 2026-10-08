import { IconButton } from '../ui/IconButton';
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
      <IconButton icon="chevronLeft" label="Newer" disabled={!canPrev || busy} onClick={onPrev} />
      <IconButton icon="chevron" label="Older" disabled={!canNext || busy} onClick={onNext} />
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
