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
import { useEffect, useRef, useState } from 'react';
import {
  useConnectStorage,
  useDisconnectStorage,
  useStorage,
  useUpdateStorageAccount,
} from '../api/queries';
import type { StorageAccount, StorageProviderId } from '../api/settings';
import { describeError } from '../auth/errors';
import { ProviderLogo } from '../storage/ProviderLogo';
import { PLANNED_PROVIDERS, STORAGE_PROVIDERS, storagePathLabel } from '../storage/providers';
import tableStyles from '../ui/DataTable.module.css';
import { useFlash } from './flash';

const WAIT_MS = 3 * 60_000;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

// Changes whenever an account is added or connected again.
const signature = (accounts: StorageAccount[] | undefined) =>
  (accounts ?? []).map((account) => `${account.id}:${account.updatedAt}`).join(',');

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

export function StorageSection() {
  const [waitingFrom, setWaitingFrom] = useState<{ at: number; before: string } | null>(null);
  const status = useStorage(waitingFrom !== null);
  const connect = useConnectStorage();
  const disconnect = useDisconnectStorage();
  const flash = useFlash();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editing, setEditing] = useState<StorageAccount | null>(null);
  const [confirm, setConfirm] = useState(false);
  const announced = useRef<number | null>(null);

  const accounts = status.data?.accounts ?? [];
  const available = status.data?.providers ?? [];
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
      flash({ type: 'success', content: 'Storage account connected.' });
    }
    const timer = setTimeout(
      () => setWaitingFrom(null),
      done ? 0 : waitingFrom.at + WAIT_MS - Date.now(),
    );
    return () => clearTimeout(timer);
  }, [waitingFrom, now, flash]);

  const start = (provider: StorageProviderId) =>
    connect.mutate(provider, {
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
                  loading={status.isFetching && !status.isLoading}
                  onClick={() => void status.refetch()}
                />
                <Button disabled={!only} onClick={() => setEditing(only)}>
                  Edit folder
                </Button>
                <Button disabled={current.length === 0} onClick={() => setConfirm(true)}>
                  Disconnect
                </Button>
                <ButtonDropdown
                  variant="primary"
                  loading={connect.isPending || waitingFrom !== null}
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
                  ? 'Connect Google Drive to save attachments there. OneDrive and Dropbox are coming.'
                  : 'Add a storage provider’s OAuth client to the server to turn this on.'}
              </Box>
              {waitingFrom !== null && (
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
