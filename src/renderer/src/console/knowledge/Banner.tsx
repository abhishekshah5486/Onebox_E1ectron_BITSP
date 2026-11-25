import Icon, { type IconProps } from '@cloudscape-design/components/icon';
import Spinner from '@cloudscape-design/components/spinner';
import type { ReactNode } from 'react';
import styles from './Banner.module.css';

// Cloudscape's four alert types, plus violet (what a model wrote) and burgundy (what the
// mailbox did), and in-progress with a spinner.
export type BannerTone =
  'info' | 'success' | 'warning' | 'error' | 'violet' | 'burgundy' | 'progress';

const ICON: Record<Exclude<BannerTone, 'progress'>, IconProps.Name> = {
  info: 'status-info',
  success: 'status-positive',
  warning: 'status-warning',
  error: 'status-negative',
  violet: 'gen-ai',
  burgundy: 'envelope',
};

export interface BannerProps {
  tone: BannerTone;
  header?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  // Solid fills the banner with its colour (for the page); outlined suits a card.
  solid?: boolean;
}

export function Banner({ tone, header, children, action, solid = false }: BannerProps) {
  return (
    <div
      className={`${styles.banner} ${styles[tone]} ${solid ? styles.solid : styles.outlined}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <span className={styles.icon}>
        {tone === 'progress' ? (
          <Spinner variant={solid ? 'inverted' : 'normal'} />
        ) : (
          <Icon name={ICON[tone]} />
        )}
      </span>
      <div className={styles.body}>
        {header && <div className={styles.header}>{header}</div>}
        {children && <div>{children}</div>}
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
