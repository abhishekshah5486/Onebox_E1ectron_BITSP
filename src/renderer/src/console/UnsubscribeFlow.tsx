import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { useState } from 'react';
import type { Thread } from '../api/mail';
import { useUnsubscribe } from '../api/mail-queries';
import { describeError } from '../auth/errors';
import { displayName } from '../mail/format';
import { useFlash } from '../settings/flash';

const RESULT = {
  'one-click': (sender: string) => `Unsubscribed from ${sender}.`,
  link: (sender: string) => `Opened ${sender}’s unsubscribe page in your browser.`,
  mailto: (sender: string) => `Opened an unsubscribe email to ${sender} in your mail app.`,
};

// Confirm first, like Gmail; then report what happened in a banner.
export function useUnsubscribeFlow() {
  const unsubscribe = useUnsubscribe();
  const [asking, setAsking] = useState<{ id: string; sender: string } | null>(null);
  const flash = useFlash();

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
                const sender = asking.sender;
                unsubscribe.mutate(asking.id, {
                  onSuccess: ({ method }) =>
                    flash({ type: 'success', content: RESULT[method](sender) }),
                  onError: (error) => flash({ type: 'error', content: describeError(error) }),
                });
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

  return {
    ask: (thread: Thread) => setAsking({ id: thread.id, sender: displayName(thread.lastFrom) }),
    pending: unsubscribe.isPending,
    modal,
  };
}
