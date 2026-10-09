import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ButtonDropdown from '@cloudscape-design/components/button-dropdown';
import FormField from '@cloudscape-design/components/form-field';
import Header from '@cloudscape-design/components/header';
import Input from '@cloudscape-design/components/input';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Table from '@cloudscape-design/components/table';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useConnectStorage,
  useDisconnectStorage,
  useStorage,
  useUpdateStorageAccount,
} from '../api/queries';
import type {
  StorageAccount,
  StorageProviderId,
  StorageSignInFailure,
  StorageStatus,
} from '../api/settings';
import { describeError } from '../auth/errors';
import { ProviderLogo } from '../storage/ProviderLogo';
import { PLANNED_PROVIDERS, STORAGE_PROVIDERS, storagePathLabel } from '../storage/providers';
import tableStyles from '../ui/DataTable.module.css';
import { useFlash } from './flash';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

function FolderModal({ account, onDismiss }: { account: StorageAccount; onDismiss: () => void }) {
  const update = useUpdateStorageAccount();
  const provider = STORAGE_PROVIDERS[account.provider];
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
                        content: `Files for ${saved.email} will go to ${storagePathLabel(saved.defaultPath, saved.provider)}.`,
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
        description={`Where OneBox saves attachments in ${account.email}'s ${provider.name}. Missing folders are created, and you can pick another folder each time you save.`}
        constraintText={`Leave empty for the top of ${provider.rootName}. Saves to: ${storagePathLabel(path, account.provider)}`}
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

// After this long the spinner gives way to a "still waiting" notice; the wait itself lasts
// until the sign-in link expires (the server says when).
const SLOW_AFTER_MS = 3 * 60_000;

interface Waiting {
  id: number;
  provider: StorageProviderId;
  startedAt: number;
  expiresAt: number;
  // The accounts before the sign-in, to tell when a new or refreshed one shows up.
  before: StorageAccount[];
  // The popup in the web app; Electron opens the system browser and returns none.
  popup: Window | null;
  slow: boolean;
}

type Outcome =
  | { kind: 'connected'; account: StorageAccount; again: boolean }
  | { kind: 'failed'; failure: StorageSignInFailure }
  | { kind: 'closed' | 'expired' | 'cancelled' };

let nextConnect = 0;

// What changed since the sign-in started: a new account, or one connected again.
function connectedSince(wait: Waiting, data: StorageStatus | undefined): Outcome | null {
  for (const account of data?.accounts ?? []) {
    if (account.provider !== wait.provider) continue;
    const old = wait.before.find((a) => a.id === account.id);
    if (!old || old.updatedAt !== account.updatedAt) {
      return { kind: 'connected', account, again: Boolean(old) };
    }
  }
  const failure = data?.failures.find(
    (f) => f.provider === wait.provider && Date.parse(f.at) >= wait.startedAt,
  );
  return failure ? { kind: 'failed', failure } : null;
}

export function StorageSection() {
  const [waiting, setWaiting] = useState<Waiting | null>(null);
  const status = useStorage(waiting ? (waiting.slow ? 15_000 : 2_000) : false);
  const connect = useConnectStorage();
  const disconnect = useDisconnectStorage();
  const flash = useFlash();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editing, setEditing] = useState<StorageAccount | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [reloading, setReloading] = useState(false);
  const finished = useRef<number | null>(null);
  const startRef = useRef<(provider: StorageProviderId) => void>(() => {});

  const accounts = status.data?.accounts ?? [];
  const available = status.data?.providers ?? [];
  const current = accounts.filter((account) => selectedIds.includes(account.id));
  const only = current.length === 1 ? current[0]! : null;
  const fail = (error: unknown) => flash({ type: 'error', content: describeError(error) });

  // Reports how a sign-in ended (once) and stops waiting.
  const finish = useCallback(
    (wait: Waiting, outcome: Outcome) => {
      if (finished.current === wait.id) return;
      finished.current = wait.id;
      const name = STORAGE_PROVIDERS[wait.provider].name;
      const id = `storage-connect-${wait.id}`;
      const tryAgain = { label: 'Try again', onClick: () => startRef.current(wait.provider) };
      switch (outcome.kind) {
        case 'connected':
          flash({
            id,
            type: 'success',
            header: outcome.again ? `${name} reconnected.` : `${name} connected.`,
            content: outcome.again
              ? `${outcome.account.email} is up to date.`
              : `${outcome.account.email} is ready.`,
            ...(!outcome.again && {
              action: { label: 'Set default folder', onClick: () => setEditing(outcome.account) },
            }),
          });
          break;
        case 'failed':
          flash({
            id,
            type: 'error',
            header: `Couldn't connect ${name}.`,
            content:
              outcome.failure.reason === 'ACCESS_DENIED'
                ? 'OneBox needs permission to save files. Please try again and allow access.'
                : `${outcome.failure.message} Please try again.`,
            action: tryAgain,
          });
          break;
        case 'closed':
          flash({
            id,
            type: 'error',
            header: `Couldn't connect ${name}.`,
            content: 'The sign-in window was closed before it finished. Please try again.',
            action: tryAgain,
          });
          break;
        case 'expired':
          flash({
            id,
            type: 'warning',
            tone: 'amber',
            header: `${name} sign-in timed out.`,
            content: 'The sign-in link expired after 10 minutes. Please try again.',
            action: tryAgain,
          });
          break;
        case 'cancelled':
          wait.popup?.close();
          flash({
            id,
            type: 'info',
            tone: 'burgundy',
            content: `${name} connection cancelled.`,
            action: { label: 'Connect again', onClick: () => startRef.current(wait.provider) },
          });
          break;
      }
      setWaiting(null);
    },
    [flash],
  );

  // Done as soon as the account (or a failure) shows up.
  useEffect(() => {
    if (!waiting) return;
    const outcome = connectedSince(waiting, status.data);
    if (outcome) finish(waiting, outcome);
  }, [waiting, status.data, finish]);

  // Timers for the wait: a closed popup ends it after one last look, a slow one turns into a
  // notice, and the link's expiry ends it for good.
  useEffect(() => {
    if (!waiting) return;
    const name = STORAGE_PROVIDERS[waiting.provider].name;
    const expire = setTimeout(
      () => finish(waiting, { kind: 'expired' }),
      waiting.expiresAt - Date.now(),
    );
    const slow = waiting.slow
      ? undefined
      : setTimeout(
          () => {
            setWaiting({ ...waiting, slow: true });
            flash({
              id: `storage-connect-${waiting.id}`,
              type: 'warning',
              header: `Still waiting for ${name} sign-in.`,
              content: 'If you finish signing in, it will show up here automatically.',
              action: { label: 'Cancel', onClick: () => finish(waiting, { kind: 'cancelled' }) },
            });
          },
          waiting.startedAt + SLOW_AFTER_MS - Date.now(),
        );
    const watch = setInterval(() => {
      if (!waiting.popup?.closed) return;
      clearInterval(watch);
      void status.refetch().then(({ data }) => {
        finish(waiting, connectedSince(waiting, data) ?? { kind: 'closed' });
      });
    }, 500);
    return () => {
      clearTimeout(expire);
      clearTimeout(slow);
      clearInterval(watch);
    };
    // status.refetch is stable; the wait is what matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting, finish, flash]);

  const start = (provider: StorageProviderId) => {
    const name = STORAGE_PROVIDERS[provider].name;
    connect.mutate(provider, {
      onSuccess: ({ url, expiresAt }) => {
        const popup = window.open(url, 'onebox-storage', 'width=520,height=680');
        const wait: Waiting = {
          id: nextConnect++,
          provider,
          startedAt: Date.now(),
          expiresAt: Date.parse(expiresAt),
          before: accounts,
          popup,
          slow: false,
        };
        setWaiting(wait);
        flash({
          id: `storage-connect-${wait.id}`,
          type: 'info',
          loading: true,
          header: `Waiting for ${name} sign-in…`,
          content: 'Finish signing in in the window that opened.',
          action: { label: 'Cancel', onClick: () => finish(wait, { kind: 'cancelled' }) },
        });
      },
      onError: () =>
        flash({
          type: 'error',
          header: `Couldn't start ${name} sign-in.`,
          content: 'Check your connection and try again.',
          action: { label: 'Try again', onClick: () => startRef.current(provider) },
        }),
    });
  };
  // Banners outlive this render, so their buttons reach start through a ref.
  useEffect(() => {
    startRef.current = start;
  });

  const reload = () => {
    setReloading(true);
    void status.refetch().finally(() => setReloading(false));
  };

  return (
    <div className={tableStyles.table}>
      <Table
        variant="container"
        loading={status.isLoading}
        loadingText="Loading storage accounts"
        selectionType="multi"
        selectedItems={current}
        onSelectionChange={({ detail }) =>
          setSelectedIds(detail.selectedItems.map((item) => item.id))
        }
        trackBy="id"
        items={accounts}
        ariaLabels={{
          selectionGroupLabel: 'Storage accounts',
          itemSelectionLabel: (_, item) => item.email,
          allItemsSelectionLabel: () => 'Select all storage accounts',
        }}
        header={
          <Header
            variant="h2"
            counter={accounts.length ? `(${accounts.length})` : undefined}
            description="Save attachments to your cloud storage and attach files from it. OneBox only sees the files it saves or you pick."
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  iconName="refresh"
                  ariaLabel="Reload storage accounts"
                  loading={reloading}
                  onClick={reload}
                />
                <Button disabled={!only} onClick={() => setEditing(only)}>
                  Edit folder
                </Button>
                <Button disabled={current.length === 0} onClick={() => setConfirm(true)}>
                  Disconnect
                </Button>
                <ButtonDropdown
                  variant="primary"
                  loading={connect.isPending}
                  disabled={waiting !== null}
                  items={[
                    ...available.map((id) => ({
                      id,
                      text: STORAGE_PROVIDERS[id].name,
                      iconUrl: STORAGE_PROVIDERS[id].logo,
                      iconAlt: '',
                    })),
                    ...PLANNED_PROVIDERS.map((name) => ({
                      id: name,
                      text: name,
                      secondaryText: 'Coming soon',
                      disabled: true,
                    })),
                  ]}
                  onItemClick={({ detail }) => start(detail.id as StorageProviderId)}
                >
                  Connect storage
                </ButtonDropdown>
              </SpaceBetween>
            }
          >
            Cloud storage
          </Header>
        }
        columnDefinitions={[
          {
            id: 'provider',
            header: 'Provider',
            cell: (item) => (
              <span className={tableStyles.withLogo}>
                <ProviderLogo provider={item.provider} />
                {STORAGE_PROVIDERS[item.provider].name}
              </span>
            ),
          },
          {
            id: 'account',
            header: 'Account',
            cell: (item) => <Box fontWeight="bold">{item.email}</Box>,
          },
          {
            id: 'folder',
            header: 'Default folder',
            cell: (item) => storagePathLabel(item.defaultPath, item.provider),
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
              <b>{available.length ? 'No storage connected' : 'Cloud storage is not set up'}</b>
              <Box color="inherit">
                {available.length
                  ? 'Connect Google Drive, OneDrive or Dropbox to save attachments there.'
                  : 'Add a storage provider’s OAuth client to the server to turn this on.'}
              </Box>
              {waiting !== null && (
                <StatusIndicator type="pending">Waiting for sign-in</StatusIndicator>
              )}
            </SpaceBetween>
          </Box>
        }
      />

      {editing && <FolderModal account={editing} onDismiss={() => setEditing(null)} />}

      <Modal
        visible={confirm && current.length > 0}
        onDismiss={() => setConfirm(false)}
        header={current.length > 1 ? 'Disconnect storage accounts' : 'Disconnect storage account'}
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
            Disconnect <b>{only.email}</b> ({STORAGE_PROVIDERS[only.provider].name})? Files already
            saved stay there.
          </>
        ) : (
          <>
            Disconnect <b>{current.length} storage accounts</b>? Files already saved stay there.
          </>
        )}
      </Modal>
    </div>
  );
}
