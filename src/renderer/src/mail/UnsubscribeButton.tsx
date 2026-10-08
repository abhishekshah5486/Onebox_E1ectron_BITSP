import { useState, type MouseEvent } from 'react';
import { useUnsubscribe } from '../api/mail-queries';
import { describeError } from '../auth/errors';
import { Dialog } from '../ui/Dialog';
import { useSnackbar } from '../ui/Snackbar';
import styles from './UnsubscribeButton.module.css';

const DONE = {
  'one-click': (sender: string) => `Unsubscribed from ${sender}.`,
  link: (sender: string) => `Opened ${sender}’s unsubscribe page.`,
  mailto: (sender: string) => `Opened an unsubscribe email to ${sender}.`,
};

// Like Gmail: a bordered button, a confirm dialog, then a note in the snackbar.
export function UnsubscribeButton({
  threadId,
  sender,
  unsubscribed,
  variant = 'row',
}: {
  threadId: string;
  sender: string;
  unsubscribed: boolean;
  variant?: 'row' | 'header';
}) {
  const unsubscribe = useUnsubscribe();
  const notify = useSnackbar();
  const [asking, setAsking] = useState(false);
  const stop = (event: MouseEvent) => event.stopPropagation();

  if (unsubscribed || unsubscribe.data?.method === 'one-click') {
    return variant === 'header' ? <span className={styles.done}>Unsubscribed</span> : null;
  }
  return (
    <>
      <button
        className={`${styles.button} ${styles[variant]}`}
        aria-label={`Unsubscribe from ${sender}`}
        disabled={unsubscribe.isPending}
        onClick={(event) => {
          stop(event);
          setAsking(true);
        }}
      >
        Unsubscribe
      </button>
      {asking && (
        <Dialog
          title="Unsubscribe"
          confirmLabel="Unsubscribe"
          onCancel={() => setAsking(false)}
          onConfirm={() => {
            setAsking(false);
            unsubscribe.mutate(threadId, {
              onSuccess: (result) => notify({ text: DONE[result.method](sender) }),
              onError: (error) => notify({ text: describeError(error) }),
            });
          }}
        >
          Do you want to stop getting messages from this mailing list ({sender})? OneBox will
          unsubscribe you in one click when the sender supports it; otherwise it opens their
          unsubscribe page.
        </Dialog>
      )}
    </>
  );
}
