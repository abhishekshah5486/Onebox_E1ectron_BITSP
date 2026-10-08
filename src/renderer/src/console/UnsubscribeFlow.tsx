import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { useState } from 'react';
import type { Thread } from '../api/mail';
import { useUnsubscribe } from '../api/mail-queries';
import { describeError } from '../auth/errors';
import { displayName } from '../mail/format';

const RESULT = {
  'one-click': (sender: string) => `Unsubscribed from ${sender}.`,
  link: (sender: string) => `Opened ${sender}’s unsubscribe page in your browser.`,
  mailto: (sender: string) => `Opened an unsubscribe email to ${sender} in your mail app.`,
};

// Confirm first, like Gmail; then report what happened above the list or conversation.
export function useUnsubscribeFlow() {
  const unsubscribe = useUnsubscribe();
  const [asking, setAsking] = useState<{ id: string; sender: string } | null>(null);
  const [sender, setSender] = useState('');

  const modal = (
    <Modal
      visible={asking !== null}
      onDismiss={() => setAsking(null)}
      header={`Unsubscribe from ${asking?.sender ?? ''}?`}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={() => setAsking(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!asking) return;
                setSender(asking.sender);
                unsubscribe.mutate(asking.id);
                setAsking(null);
              }}
            >
              Unsubscribe
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      OneBox asks the sender to stop emailing you. When they support it this takes one click;
      otherwise their unsubscribe page opens.
    </Modal>
  );

  const notice = unsubscribe.isError ? (
    <Alert type="error" dismissible onDismiss={() => unsubscribe.reset()}>
      {describeError(unsubscribe.error)}
    </Alert>
  ) : unsubscribe.data ? (
    <Alert type="success" dismissible onDismiss={() => unsubscribe.reset()}>
      {RESULT[unsubscribe.data.method](sender)}
    </Alert>
  ) : null;

  return {
    ask: (thread: Thread) => setAsking({ id: thread.id, sender: displayName(thread.lastFrom) }),
    pending: unsubscribe.isPending,
    modal,
    notice,
  };
}
