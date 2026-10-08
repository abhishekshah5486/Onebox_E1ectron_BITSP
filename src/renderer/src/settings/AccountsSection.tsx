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
import TextFilter from '@cloudscape-design/components/text-filter';
import { useState } from 'react';
import { ProviderLogo } from '../accounts/ProviderLogo';
import type { Account, AccountStatus } from '../api/accounts';
import { useAccounts, useRemoveAccount, useTestAccount, useUpdateAccount } from '../api/queries';
import { describeError } from '../auth/errors';
import { AddAccountModal } from './AddAccountModal';
import { LOCALE } from '../mail/format';
import { useFlash } from './flash';
import tableStyles from '../ui/DataTable.module.css';
import styles from './LabelsSection.module.css';
import { LoadError } from '../ui/LoadError';

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

const formatTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString(LOCALE, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '—';

export function AccountsSection() {
  const accounts = useAccounts();
  const testAccount = useTestAccount();
  const updateAccount = useUpdateAccount();
  const removeAccount = useRemoveAccount();
  const flash = useFlash();
  const [selected, setSelected] = useState<Account[]>([]);
  const [adding, setAdding] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [search, setSearch] = useState('');

  const all = accounts.data ?? [];
  const needle = search.trim().toLowerCase();
  const items = needle
    ? all.filter((item) =>
        `${item.emailAddress} ${item.displayName ?? ''} ${item.provider} ${item.imap.host}`
          .toLowerCase()
          .includes(needle),
      )
    : all;
  // Fresh copies of what is ticked, so statuses stay current after an action.
  const current = all.filter((item) => selected.some((picked) => picked.id === item.id));
  const many = () =>
    current.length === 1 ? current[0]!.emailAddress : `${current.length} accounts`;
  const allPaused = current.length > 0 && current.every((item) => item.status === 'DISABLED');
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

  const remove = (accounts: Account[]) => {
    for (const account of accounts) {
      removeAccount.mutate(account.id, {
        onSuccess: () => flash({ type: 'success', content: `Removed ${account.emailAddress}.` }),
        onError: fail,
      });
    }
    setSelected([]);
    setConfirmRemove(false);
  };

  return (
    <div className={tableStyles.table}>
      <Table
        variant="container"
        loading={accounts.isLoading}
        loadingText="Loading accounts"
        selectionType="multi"
        selectedItems={current}
        onSelectionChange={({ detail }) => setSelected(detail.selectedItems)}
        trackBy="id"
        items={items}
        filter={
          <TextFilter
            filteringText={search}
            filteringPlaceholder="Find an account"
            filteringAriaLabel="Find an account"
            onChange={({ detail }) => setSearch(detail.filteringText)}
          />
        }
        ariaLabels={{
          selectionGroupLabel: 'Accounts',
          itemSelectionLabel: (_, item) => item.emailAddress,
          allItemsSelectionLabel: () => 'Select all accounts',
        }}
        header={
          <Header
            variant="h2"
            counter={all.length ? `(${all.length})` : undefined}
            description="Mailboxes OneBox syncs into your unified inbox"
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  iconName="refresh"
                  ariaLabel="Reload accounts"
                  onClick={() => void accounts.refetch()}
                />
                <Button
                  disabled={current.length === 0}
                  loading={testAccount.isPending}
                  onClick={() => current.forEach(runTest)}
                >
                  Test connection
                </Button>
                <ButtonDropdown
                  disabled={current.length === 0}
                  items={[
                    { id: 'toggle', text: allPaused ? 'Resume syncing' : 'Pause syncing' },
                    { id: 'remove', text: 'Remove' },
                  ]}
                  onItemClick={({ detail }) => {
                    if (detail.id === 'toggle') {
                      current
                        .filter((item) => (item.status === 'DISABLED') === allPaused)
                        .forEach(toggle);
                    }
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
            header: 'Account',
            cell: (item) => (
              <span className={styles.account} title={item.emailAddress}>
                <ProviderLogo provider={item.provider} size={16} />
                <span>{item.emailAddress}</span>
              </span>
            ),
          },
          { id: 'name', header: 'Name', cell: (item) => item.displayName ?? '—' },
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
        <Box padding={{ top: 's' }}>
          <LoadError
            error={accounts.error}
            header="Accounts could not be loaded"
            onRetry={() => void accounts.refetch()}
          />
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
        visible={confirmRemove && current.length > 0}
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
                onClick={() => remove(current)}
              >
                Remove
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        Remove <b>{many()}</b>? OneBox stops syncing and forgets the stored password. Mail in the
        mailbox itself is not touched.
      </Modal>
    </div>
  );
}
