import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import FormField from '@cloudscape-design/components/form-field';
import Header from '@cloudscape-design/components/header';
import Input from '@cloudscape-design/components/input';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Table from '@cloudscape-design/components/table';
import { useEffect, useRef, useState } from 'react';
import {
  useConnectGoogleDrive,
  useDisconnectGoogleDrive,
  useGoogleDrive,
  useUpdateDriveAccount,
} from '../api/queries';
import type { DriveAccount } from '../api/settings';
import { describeError } from '../auth/errors';
import { drivePathLabel } from '../mail/attachments/drivePath';
import tableStyles from '../ui/DataTable.module.css';
import { useFlash } from './flash';

const WAIT_MS = 3 * 60_000;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

// Changes whenever an account is added or connected again.
const signature = (accounts: DriveAccount[] | undefined) =>
  (accounts ?? []).map((account) => `${account.id}:${account.updatedAt}`).join(',');

function FolderModal({ account, onDismiss }: { account: DriveAccount; onDismiss: () => void }) {
  const update = useUpdateDriveAccount();
  const flash = useFlash();
  const [path, setPath] = useState(account.defaultPath);

  return (
    <Modal
      visible
      onDismiss={onDismiss}
      header="Default folder"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={update.isPending}
              onClick={() =>
                update.mutate(
                  { id: account.id, defaultPath: path },
                  {
                    onSuccess: (saved) => {
                      flash({
                        type: 'success',
                        content: `Files for ${saved.email} will go to ${drivePathLabel(saved.defaultPath)}.`,
                      });
                      onDismiss();
                    },
                    onError: (error) => flash({ type: 'error', content: describeError(error) }),
                  },
                )
              }
            >
              Save
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <FormField
        label="Folder path"
        description={`Where OneBox saves attachments in ${account.email}'s Drive. Missing folders are created, and you can pick another folder each time you save.`}
        constraintText={`Leave empty for the top of My Drive. Saves to: ${drivePathLabel(path)}`}
      >
        <Input
          value={path}
          placeholder="OneBox/Receipts"
          onChange={({ detail }) => setPath(detail.value)}
        />
      </FormField>
    </Modal>
  );
}

export function GoogleDriveCard() {
  const [waitingFrom, setWaitingFrom] = useState<{ at: number; before: string } | null>(null);
  const status = useGoogleDrive(waitingFrom !== null);
  const connect = useConnectGoogleDrive();
  const disconnect = useDisconnectGoogleDrive();
  const flash = useFlash();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editing, setEditing] = useState<DriveAccount | null>(null);
  const [confirm, setConfirm] = useState(false);
  const announced = useRef<number | null>(null);

  const accounts = status.data?.accounts ?? [];
  const configured = status.data?.configured ?? false;
  const current = accounts.filter((account) => selectedIds.includes(account.id));
  const only = current.length === 1 ? current[0]! : null;
  const fail = (error: unknown) => flash({ type: 'error', content: describeError(error) });

  // Stops waiting once the sign-in shows up in the list, or after a few minutes.
  const now = signature(status.data?.accounts);
  useEffect(() => {
    if (waitingFrom === null) return;
    const done = now !== waitingFrom.before;
    if (done && announced.current !== waitingFrom.at) {
      announced.current = waitingFrom.at;
      flash({ type: 'success', content: 'Google account connected.' });
    }
    const timer = setTimeout(
      () => setWaitingFrom(null),
      done ? 0 : waitingFrom.at + WAIT_MS - Date.now(),
    );
    return () => clearTimeout(timer);
  }, [waitingFrom, now, flash]);

  const start = () =>
    connect.mutate(undefined, {
      onSuccess: ({ url }) => {
        // Electron opens it in the browser; the web app opens a popup.
        window.open(url, 'onebox-google', 'width=520,height=680');
        setWaitingFrom({ at: Date.now(), before: now });
      },
      onError: fail,
    });

  return (
    <div className={tableStyles.table}>
      <Table
        variant="container"
        loading={status.isLoading}
        loadingText="Loading Google accounts"
        selectionType="multi"
        selectedItems={current}
        onSelectionChange={({ detail }) =>
          setSelectedIds(detail.selectedItems.map((item) => item.id))
        }
        trackBy="id"
        items={accounts}
        ariaLabels={{
          selectionGroupLabel: 'Google Drive accounts',
          itemSelectionLabel: (_, item) => item.email,
          allItemsSelectionLabel: () => 'Select all Google accounts',
        }}
        header={
          <Header
            variant="h2"
            counter={accounts.length ? `(${accounts.length})` : undefined}
            description="Save attachments to Drive and attach Drive files to your mail. OneBox only sees files it creates or you pick."
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  iconName="refresh"
                  ariaLabel="Reload Google accounts"
                  loading={status.isFetching && !status.isLoading}
                  onClick={() => void status.refetch()}
                />
                <Button disabled={!only} onClick={() => setEditing(only)}>
                  Edit folder
                </Button>
                <Button disabled={current.length === 0} onClick={() => setConfirm(true)}>
                  Disconnect
                </Button>
                <Button
                  variant="primary"
                  disabled={!configured}
                  loading={connect.isPending || waitingFrom !== null}
                  onClick={start}
                >
                  {accounts.length ? 'Connect another account' : 'Connect Google Drive'}
                </Button>
              </SpaceBetween>
            }
          >
            Google Drive
          </Header>
        }
        columnDefinitions={[
          {
            id: 'account',
            header: 'Account',
            cell: (item) => <Box fontWeight="bold">{item.email}</Box>,
          },
          {
            id: 'folder',
            header: 'Default folder',
            cell: (item) => drivePathLabel(item.defaultPath),
          },
          {
            id: 'status',
            header: 'Status',
            cell: () => <StatusIndicator type="success">Connected</StatusIndicator>,
          },
          { id: 'connected', header: 'Connected on', cell: (item) => formatDate(item.connectedAt) },
        ]}
        empty={
          <Box textAlign="center" color="inherit" padding="m">
            <SpaceBetween size="xs">
              <b>{configured ? 'No Google accounts connected' : 'Google Drive is not set up'}</b>
              <Box color="inherit">
                {configured
                  ? 'Connect one or more Google accounts to save attachments to Drive.'
                  : 'Add a Google OAuth client to the server to turn this on.'}
              </Box>
              {waitingFrom !== null && (
                <StatusIndicator type="pending">Waiting for Google sign-in</StatusIndicator>
              )}
            </SpaceBetween>
          </Box>
        }
      />

      {editing && <FolderModal account={editing} onDismiss={() => setEditing(null)} />}

      <Modal
        visible={confirm && current.length > 0}
        onDismiss={() => setConfirm(false)}
        header={current.length > 1 ? 'Disconnect Google accounts' : 'Disconnect Google account'}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setConfirm(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={disconnect.isPending}
                onClick={() => {
                  for (const account of current) {
                    disconnect.mutate(account.id, {
                      onSuccess: () =>
                        flash({ type: 'success', content: `Disconnected ${account.email}.` }),
                      onError: fail,
                    });
                  }
                  setSelectedIds([]);
                  setConfirm(false);
                }}
              >
                Disconnect
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        {only ? (
          <>
            Disconnect <b>{only.email}</b>? Files already saved stay in that Drive.
          </>
        ) : (
          <>
            Disconnect <b>{current.length} Google accounts</b>? Files already saved stay in their
            Drives.
          </>
        )}
      </Modal>
    </div>
  );
}
