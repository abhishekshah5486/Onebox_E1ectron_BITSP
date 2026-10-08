import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import KeyValuePairs from '@cloudscape-design/components/key-value-pairs';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import { useEffect, useRef, useState } from 'react';
import { useConnectGoogleDrive, useDisconnectGoogleDrive, useGoogleDrive } from '../api/queries';
import { describeError } from '../auth/errors';
import { useFlash } from './flash';

const WAIT_MS = 3 * 60_000;

export function GoogleDriveCard() {
  const [waitingSince, setWaitingSince] = useState<number | null>(null);
  const status = useGoogleDrive(waitingSince !== null);
  const connect = useConnectGoogleDrive();
  const disconnect = useDisconnectGoogleDrive();
  const flash = useFlash();
  const [confirm, setConfirm] = useState(false);
  const drive = status.data;
  const fail = (error: unknown) => flash({ type: 'error', content: describeError(error) });

  const announced = useRef<number | null>(null);

  // Stops waiting once the account shows up, or after a few minutes.
  useEffect(() => {
    if (waitingSince === null) return;
    const done = Boolean(drive?.connected);
    if (done && announced.current !== waitingSince) {
      announced.current = waitingSince;
      flash({
        type: 'success',
        content: `Google Drive connected as ${drive?.email ?? 'your account'}.`,
      });
    }
    const timer = setTimeout(
      () => setWaitingSince(null),
      done ? 0 : waitingSince + WAIT_MS - Date.now(),
    );
    return () => clearTimeout(timer);
  }, [waitingSince, drive, flash]);

  const start = () =>
    connect.mutate(undefined, {
      onSuccess: ({ url }) => {
        // Electron opens it in the browser; the web app opens a popup.
        window.open(url, 'onebox-google', 'width=520,height=680');
        setWaitingSince(Date.now());
      },
      onError: fail,
    });

  const actions = drive?.connected ? (
    <Button onClick={() => setConfirm(true)}>Disconnect</Button>
  ) : (
    <Button
      variant="primary"
      disabled={!drive?.configured}
      loading={connect.isPending || waitingSince !== null}
      onClick={start}
    >
      Connect Google Drive
    </Button>
  );

  const state = () => {
    if (status.isLoading) return <StatusIndicator type="loading">Loading</StatusIndicator>;
    if (!drive?.configured)
      return <StatusIndicator type="stopped">Not set up on this server</StatusIndicator>;
    if (drive.connected) return <StatusIndicator type="success">Connected</StatusIndicator>;
    if (waitingSince !== null) {
      return <StatusIndicator type="pending">Waiting for Google sign-in</StatusIndicator>;
    }
    return <StatusIndicator type="stopped">Not connected</StatusIndicator>;
  };

  return (
    <>
      <Container
        header={
          <Header
            variant="h2"
            description="Save attachments to Drive and attach Drive files to your mail. OneBox only sees files it creates or you pick."
            actions={actions}
          >
            Google Drive
          </Header>
        }
      >
        <KeyValuePairs
          columns={3}
          items={[
            { label: 'Status', value: state() },
            { label: 'Account', value: drive?.email ?? '-' },
            {
              label: 'Saved files go to',
              value: drive?.connected ? 'OneBox folder in My Drive' : '-',
            },
          ]}
        />
      </Container>

      <Modal
        visible={confirm}
        onDismiss={() => setConfirm(false)}
        header="Disconnect Google Drive"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setConfirm(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={disconnect.isPending}
                onClick={() =>
                  disconnect.mutate(undefined, {
                    onSuccess: () => {
                      flash({ type: 'success', content: 'Google Drive disconnected.' });
                      setConfirm(false);
                    },
                    onError: fail,
                  })
                }
              >
                Disconnect
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        Disconnect <b>{drive?.email}</b>? Files already saved stay in your Drive.
      </Modal>
    </>
  );
}
