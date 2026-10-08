import { useState, type MouseEvent } from 'react';
import { useUnsubscribe } from '../api/mail-queries';
import { describeError } from '../auth/errors';
import styles from './UnsubscribeButton.module.css';

const DONE: Record<'one-click' | 'link' | 'mailto', string> = {
  'one-click': 'Unsubscribed',
  link: 'Opened the sender’s unsubscribe page',
  mailto: 'Opened an unsubscribe email',
};

// Two clicks, like Gmail's confirm step, so a stray click never unsubscribes anyone.
export function UnsubscribeButton({
  threadId,
  sender,
  unsubscribed,
  size = 'normal',
}: {
  threadId: string;
  sender: string;
  unsubscribed: boolean;
  size?: 'normal' | 'small';
}) {
  const unsubscribe = useUnsubscribe();
  const [confirming, setConfirming] = useState(false);
  const className = `${styles.button} ${size === 'small' ? styles.small : ''}`;
  const stop = (event: MouseEvent) => event.stopPropagation();

  if (unsubscribed || unsubscribe.data) {
    return (
      <span className={`${className} ${styles.done}`} role="status" onClick={stop}>
        {DONE[unsubscribe.data?.method ?? 'one-click']}
      </span>
    );
  }
  if (unsubscribe.isError) {
    return (
      <span className={`${className} ${styles.error}`} role="alert" onClick={stop}>
        {describeError(unsubscribe.error)}
      </span>
    );
  }
  return (
    <button
      className={`${className} ${confirming ? styles.confirm : ''}`}
      aria-label={confirming ? `Confirm unsubscribe from ${sender}` : `Unsubscribe from ${sender}`}
      disabled={unsubscribe.isPending}
      onBlur={() => setConfirming(false)}
      onClick={(event) => {
        stop(event);
        if (confirming) unsubscribe.mutate(threadId);
        else setConfirming(true);
      }}
    >
      {unsubscribe.isPending
        ? 'Unsubscribing…'
        : confirming
          ? 'Confirm unsubscribe'
          : 'Unsubscribe'}
    </button>
  );
}
