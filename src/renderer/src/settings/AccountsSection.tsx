import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ButtonDropdown from '@cloudscape-design/components/button-dropdown';
import Header from '@cloudscape-design/components/header';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator, {
  type StatusIndicatorProps,
} from '@cloudscape-design/components/status-indicator';
import Table from '@cloudscape-design/components/table';
import { useState } from 'react';
import type { Account, AccountStatus } from '../api/accounts';
import { useAccounts, useRemoveAccount, useTestAccount, useUpdateAccount } from '../api/queries';
import { describeError } from '../auth/errors';
import { AddAccountModal } from './AddAccountModal';
import { useFlash } from './flash';

const STATUS: Record<AccountStatus, { type: StatusIndicatorProps.Type; label: string }> = {
  CONNECTED: { type: 'success', label: 'Connected' },
  AUTH_FAILED: { type: 'error', label: 'Sign-in failed' },
  UNREACHABLE: { type: 'warning', label: 'Unreachable' },
  TLS_ERROR: { type: 'error', label: 'Certificate problem' },
  DISABLED: { type: 'stopped', label: 'Disabled' },
};

const PROVIDER_LABEL = {
  GMAIL: 'Gmail',
  OUTLOOK: 'Outlook',
  ICLOUD: 'iCloud',
  YAHOO: 'Yahoo',
  IMAP: 'IMAP',
} as const;

const formatTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '—');

export function AccountsSection() {
  const accounts = useAccounts();
  const testAccount = useTestAccount();
  const updateAccount = useUpdateAccount();
  const removeAccount = useRemoveAccount();
  const flash = useFlash();
  const [selected, setSelected] = useState<Account | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const items = accounts.data ?? [];
  const current = items.find((item) => item.id === selected?.id) ?? null;
  const fail = (error: unknown) => flash({ type: 'error', content: describeError(error) });

  const runTest = (account: Account) =>
    testAccount.mutate(account.id, {
      onSuccess: (result) =>
        flash(
          result.ok
            ? { type: 'success', content: `${account.emailAddress} is connected.` }
            : {
                type: 'error',
                header: `${account.emailAddress} could not connect`,
                content: result.message,
              },
        ),
      onError: fail,
    });

  const toggle = (account: Account) =>
    updateAccount.mutate(
      { id: account.id, enabled: account.status === 'DISABLED' },
      {
        onSuccess: (updated) =>
          flash({
            type:
              updated.status === 'DISABLED' || updated.status === 'CONNECTED'
                ? 'success'
                : 'warning',
            content:
              updated.status === 'DISABLED'
                ? `Paused syncing for ${account.emailAddress}.`
                : `${account.emailAddress}: ${STATUS[updated.status].label}.`,
          }),
        onError: fail,
      },
    );

  const remove = (account: Account) =>
    removeAccount.mutate(account.id, {
      onSuccess: () => {
        flash({ type: 'success', content: `Removed ${account.emailAddress}.` });
        setSelected(null);
        setConfirmRemove(false);
      },
      onError: fail,
    });

  return (
    <>
      <Table
        variant="container"
        loading={accounts.isLoading}
        loadingText="Loading accounts"
        selectionType="single"
        selectedItems={current ? [current] : []}
        onSelectionChange={({ detail }) => setSelected(detail.selectedItems[0] ?? null)}
        trackBy="id"
        items={items}
        ariaLabels={{
          selectionGroupLabel: 'Accounts',
          itemSelectionLabel: (_, item) => item.emailAddress,
          allItemsSelectionLabel: () => 'all',
        }}
        header={
          <Header
            variant="h2"
            counter={items.length ? `(${items.length})` : undefined}
            description="Mailboxes OneBox syncs into your unified inbox"
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  disabled={!current}
                  loading={testAccount.isPending}
                  onClick={() => current && runTest(current)}
                >
                  Test connection
                </Button>
                <ButtonDropdown
                  disabled={!current}
                  items={[
                    {
                      id: 'toggle',
                      text: current?.status === 'DISABLED' ? 'Resume syncing' : 'Pause syncing',
                    },
                    { id: 'remove', text: 'Remove' },
                  ]}
                  onItemClick={({ detail }) => {
                    if (!current) return;
                    if (detail.id === 'toggle') toggle(current);
                    if (detail.id === 'remove') setConfirmRemove(true);
                  }}
                >
                  Actions
                </ButtonDropdown>
                <Button variant="primary" onClick={() => setAdding(true)}>
                  Add account
                </Button>
              </SpaceBetween>
            }
          >
            Connected accounts
          </Header>
        }
        columnDefinitions={[
          {
            id: 'email',
            header: 'Email',
            cell: (item) => (
              <>
                <Box fontWeight="bold">{item.displayName ?? item.emailAddress}</Box>
                {item.displayName && <Box color="text-body-secondary">{item.emailAddress}</Box>}
              </>
            ),
          },
          { id: 'provider', header: 'Provider', cell: (item) => PROVIDER_LABEL[item.provider] },
          { id: 'server', header: 'Server', cell: (item) => `${item.imap.host}:${item.imap.port}` },
          {
            id: 'status',
            header: 'Status',
            cell: (item) => (
              <span title={item.lastError ?? undefined}>
                <StatusIndicator type={STATUS[item.status].type}>
                  {STATUS[item.status].label}
                </StatusIndicator>
              </span>
            ),
          },
          {
            id: 'checked',
            header: 'Last checked',
            cell: (item) => formatTime(item.lastVerifiedAt),
          },
        ]}
        empty={
          <Box textAlign="center" color="inherit" padding="m">
            <SpaceBetween size="xs">
              <b>No accounts connected</b>
              <Box color="inherit">
                Connect Gmail, Outlook or any IMAP mailbox to start syncing.
              </Box>
              <Button onClick={() => setAdding(true)}>Add account</Button>
            </SpaceBetween>
          </Box>
        }
      />
      {accounts.isError && (
        <Box color="text-status-error" padding={{ top: 's' }}>
          {describeError(accounts.error)}
        </Box>
      )}

      <AddAccountModal
        visible={adding}
        onDismiss={() => setAdding(false)}
        onConnected={(account) =>
          flash({ type: 'success', content: `Connected ${account.emailAddress}.` })
        }
      />

      <Modal
        visible={confirmRemove && !!current}
        onDismiss={() => setConfirmRemove(false)}
        header="Remove account"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setConfirmRemove(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={removeAccount.isPending}
                onClick={() => current && remove(current)}
              >
                Remove
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        Remove <b>{current?.emailAddress}</b>? OneBox stops syncing it and forgets its stored
        password. Mail in the mailbox itself is not touched.
      </Modal>
    </>
  );
}
