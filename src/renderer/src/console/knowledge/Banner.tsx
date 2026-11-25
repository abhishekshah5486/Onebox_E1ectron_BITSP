import Alert from '@cloudscape-design/components/alert';
import Flashbar from '@cloudscape-design/components/flashbar';
import type { ReactNode } from 'react';
import styles from './Banner.module.css';

// Cloudscape's alert types, plus in-progress (a spinner) and burgundy (what the mailbox did:
// an info notification in a burgundy fill).
export type BannerTone = 'info' | 'success' | 'warning' | 'error' | 'progress' | 'burgundy';

export interface BannerProps {
  tone: BannerTone;
  header?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  // Solid (a flash notification) for the page; outlined (an alert) inside a card.
  solid?: boolean;
}

export function Banner({ tone, header, children, action, solid = false }: BannerProps) {
  if (solid)
    return (
      <div className={tone === 'burgundy' ? styles.burgundy : undefined}>
        <Flashbar
          items={[
            {
              id: 'banner',
              type: tone === 'progress' ? 'in-progress' : tone === 'burgundy' ? 'info' : tone,
              loading: tone === 'progress',
              header,
              content: children,
              action,
            },
          ]}
        />
      </div>
    );
  return (
    <Alert
      type={tone === 'progress' || tone === 'burgundy' ? 'info' : tone}
      header={header}
      action={action}
    >
      {children}
    </Alert>
  );
}
