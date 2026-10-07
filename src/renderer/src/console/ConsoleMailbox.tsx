import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Header from '@cloudscape-design/components/header';
import Pagination from '@cloudscape-design/components/pagination';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Table, { type TableProps } from '@cloudscape-design/components/table';
import TextFilter from '@cloudscape-design/components/text-filter';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { ProviderLogo } from '../accounts/ProviderLogo';
import type { Account } from '../api/accounts';
import type { Thread, ThreadFilter } from '../api/mail';
import {
  useMailboxSummary,
  useThreadPage,
  useUpdateThread,
  type ThreadScope,
} from '../api/mail-queries';
import { useAccounts } from '../api/queries';
import { describeError } from '../auth/errors';
import { FOLDER_LABEL, isFolderRole, type FolderRole } from '../mail/folders';
import { displayName, formatUtc, middleTruncate } from '../mail/format';
import { PAGE_SIZE } from '../mail/paging';
import { useLoadPage } from '../mail/useLoadPage';
import styles from './ConsoleMailbox.module.css';

const PROBLEM: Record<string, string> = {
  AUTH_FAILED: 'The mail server rejected this account’s password.',
  UNREACHABLE: 'OneBox cannot reach this mail server right now.',
  TLS_ERROR: 'This mail server’s certificate could not be verified.',
  DISABLED: 'Syncing is paused for this account.',
};

// Below this table width the Account column shrinks to just the provider logo.
export const COMPACT_TABLE_WIDTH = 1040;

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(Infinity);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry!.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

function columns(
  accounts: Map<string, Account> | null,
  compact: boolean,
  onToggleStar: (thread: Thread) => void,
): TableProps.ColumnDefinition<Thread>[] {
  // The marker lets the stylesheet tell read rows from unread ones.
  const text = (thread: Thread, content: ReactNode) => (
    <span
      className={styles.cell}
      data-unread={thread.unreadCount > 0 || undefined}
      title={typeof content === 'string' ? content : undefined}
    >
      {content}
    </span>
  );
  return [
    {
      id: 'star',
      header: '',
      width: 64,
      cell: (thread) => (
        // Stops the click from also opening the conversation.
        <span className={styles.star} onClick={(event) => event.stopPropagation()}>
          <Button
            variant="inline-icon"
            iconName={thread.isStarred ? 'star-filled' : 'star'}
            ariaLabel={thread.isStarred ? 'Unstar' : 'Star'}
            onClick={() => onToggleStar(thread)}
          />
        </span>
      ),
    },
    ...(accounts
      ? [
          {
            id: 'account',
            header: <span className={styles.accountText}>Account</span>,
            width: compact ? 56 : 220,
            cell: (thread: Thread) => {
              const account = accounts.get(thread.accountId);
              return (
                <span className={styles.account} title={account?.emailAddress}>
                  {account && <ProviderLogo provider={account.provider} size={16} />}
                  <span
                    className={`${styles.cell} ${styles.accountText}`}
                    data-unread={thread.unreadCount > 0 || undefined}
                  >
                    {account ? middleTruncate(account.emailAddress, 24) : '—'}
                  </span>
                </span>
              );
            },
          },
        ]
      : []),
    {
      id: 'from',
      header: 'From',
      width: 200,
      cell: (thread) =>
        text(
          thread,
          `${displayName(thread.lastFrom)}${thread.messageCount > 1 ? ` (${thread.messageCount})` : ''}`,
        ),
    },
    {
      id: 'subject',
      header: 'Subject',
      cell: (thread) =>
        text(
          thread,
          <>
            {thread.subject || '(no subject)'}
            {thread.snippet && <span className={styles.snippet}> – {thread.snippet}</span>}
          </>,
        ),
    },
    {
      id: 'received',
      header: 'Received (UTC)',
      width: 170,
      cell: (thread) => text(thread, formatUtc(thread.lastMessageAt).replace(' UTC', '')),
    },
  ];
}

function MailTable({
  scope,
  title,
  description,
  counter,
  basePath,
  accounts,
  page,
  pagesCount,
  openEnd,
  onPageChange,
  loading,
  loadingText,
  alerts,
  empty,
  onRefresh,
}: {
  scope: ThreadScope;
  title: string;
  description: string;
  counter: string | undefined;
  basePath: string;
  accounts: Map<string, Account> | null;
  page: number;
  pagesCount: number;
  openEnd: boolean;
  onPageChange: (page: number) => void;
  loading: boolean;
  loadingText: string;
  alerts: ReactNode;
  empty: ReactNode;
  onRefresh: () => void;
}) {
  const navigate = useNavigate();
  const [tableRef, tableWidth] = useWidth<HTMLDivElement>();
  const compact = tableWidth < COMPACT_TABLE_WIDTH;
  const query = useThreadPage(scope, page);
  const update = useUpdateThread();
  // Selection belongs to the page it was made on, so paging clears it.
  const [selection, setSelection] = useState<{ page: number; items: Thread[] }>({
    page,
    items: [],
  });
  const selected = selection.page === page ? selection.items : [];
  const setSelected = (items: Thread[]) => setSelection({ page, items });
  const [filter, setFilter] = useState('');

  const items = useMemo(() => {
    const all = query.data?.items ?? [];
    const needle = filter.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((thread) =>
      [thread.subject, thread.snippet, displayName(thread.lastFrom), thread.lastFrom?.address]
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  }, [query.data, filter]);

  const bulk = (changes: { isRead?: boolean; isStarred?: boolean }) => {
    for (const thread of selected) update.mutate({ id: thread.id, ...changes });
    setSelected([]);
  };

  return (
    <SpaceBetween size="m">
      {alerts}
      <div ref={tableRef} className={styles.table} data-compact={compact || undefined}>
        <Table
          variant="full-page"
          stickyHeader
          trackBy="id"
          selectionType="multi"
          selectedItems={selected}
          onSelectionChange={({ detail }) => setSelected(detail.selectedItems)}
          ariaLabels={{
            selectionGroupLabel: 'Conversation selection',
            allItemsSelectionLabel: () => 'Select all conversations on this page',
            itemSelectionLabel: (_, thread) => `Select ${thread.subject || '(no subject)'}`,
            tableLabel: `${title} conversations`,
          }}
          columnDefinitions={columns(accounts, compact, (thread) =>
            update.mutate({ id: thread.id, isStarred: !thread.isStarred }),
          )}
          items={loading ? [] : items}
          loading={loading || query.isPending}
          loadingText={loading ? loadingText : 'Loading conversations'}
          onRowClick={({ detail }) => void navigate(`${basePath}/${detail.item.id}`)}
          empty={
            query.isError ? (
              <Box textAlign="center" color="text-status-error">
                {describeError(query.error)}
              </Box>
            ) : (
              empty
            )
          }
          header={
            <Header
              variant="awsui-h1-sticky"
              counter={counter}
              description={description}
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button iconName="refresh" ariaLabel="Refresh" onClick={onRefresh} />
                  <Button disabled={selected.length === 0} onClick={() => bulk({ isRead: true })}>
                    Mark as read
                  </Button>
                  <Button disabled={selected.length === 0} onClick={() => bulk({ isRead: false })}>
                    Mark as unread
                  </Button>
                  <Button
                    disabled={selected.length === 0}
                    onClick={() => bulk({ isStarred: true })}
                  >
                    Star
                  </Button>
                </SpaceBetween>
              }
            >
              {title}
            </Header>
          }
          filter={
            <TextFilter
              filteringText={filter}
              filteringPlaceholder="Filter conversations on this page"
              filteringAriaLabel="Filter conversations on this page"
              onChange={({ detail }) => setFilter(detail.filteringText)}
              countText={filter ? `${items.length} matches` : undefined}
            />
          }
          pagination={
            <Pagination
              currentPageIndex={page}
              pagesCount={Math.max(1, pagesCount)}
              openEnd={openEnd}
              disabled={loading}
              ariaLabels={{
                nextPageLabel: 'Older',
                previousPageLabel: 'Newer',
                pageLabel: (n) => `Page ${n}`,
              }}
              onChange={({ detail }) => onPageChange(detail.currentPageIndex)}
            />
          }
        />
      </div>
    </SpaceBetween>
  );
}

function EmptyMessage({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <Box textAlign="center" color="inherit">
      <SpaceBetween size="xxs">
        <b>{title}</b>
        <Box variant="p" color="inherit">
          {body}
        </Box>
        {action}
      </SpaceBetween>
    </Box>
  );
}

export function ConsoleUnifiedMailbox({
  filter,
  folder = null,
  title,
  basePath,
}: {
  filter: ThreadFilter;
  folder?: FolderRole | null;
  title: string;
  basePath: string;
}) {
  const navigate = useNavigate();
  const accounts = useAccounts();
  const scope = useMemo<ThreadScope>(() => ({ kind: 'unified', filter, folder }), [filter, folder]);
  const [page, setPage] = useState(1);
  const query = useThreadPage(scope, page);
  const byId = useMemo(() => new Map((accounts.data ?? []).map((a) => [a.id, a])), [accounts.data]);
  const total = query.data?.total ?? 0;
  const hasAccounts = (accounts.data?.length ?? 0) > 0;

  return (
    <MailTable
      scope={scope}
      title={title}
      description="Mail OneBox has fetched from every connected account. Open an account to load older mail."
      counter={query.data ? `(${total.toLocaleString()})` : undefined}
      basePath={basePath}
      accounts={byId}
      page={page}
      pagesCount={Math.ceil(total / PAGE_SIZE)}
      openEnd={false}
      onPageChange={setPage}
      loading={false}
      loadingText=""
      alerts={null}
      onRefresh={() => void query.refetch()}
      empty={
        <EmptyMessage
          title={
            filter === 'starred'
              ? 'No starred conversations'
              : folder && folder !== 'inbox'
                ? `Nothing in ${FOLDER_LABEL[folder]}`
                : 'Your inbox is empty'
          }
          body={
            hasAccounts
              ? 'New mail from your connected accounts appears here automatically.'
              : 'Connect a Gmail, Outlook or IMAP account to get started.'
          }
          action={
            !hasAccounts && (
              <Button onClick={() => void navigate('/settings')}>Connect an account</Button>
            )
          }
        />
      }
    />
  );
}

export function ConsoleAccountMailbox() {
  const { accountId = '', folder } = useParams();
  if (!isFolderRole(folder)) return <Navigate to={`/accounts/${accountId}/inbox`} replace />;
  return <AccountTable key={`${accountId}/${folder}`} accountId={accountId} folder={folder} />;
}

function AccountTable({ accountId, folder }: { accountId: string; folder: FolderRole }) {
  const navigate = useNavigate();
  const accounts = useAccounts();
  const account = accounts.data?.find((a) => a.id === accountId);
  const scope = useMemo<ThreadScope>(
    () => ({ kind: 'account', accountId, folder }),
    [accountId, folder],
  );
  const [page, setPage] = useState(1);
  const query = useThreadPage(scope, page);
  const summary = useMailboxSummary(accountId, folder);
  const loader = useLoadPage(accountId, folder, setPage);
  const { cancel } = loader;
  useEffect(() => cancel, [cancel]);

  if (accounts.isSuccess && !account) {
    return (
      <Alert type="info" header="Account not found">
        It may have been removed in Settings.
      </Alert>
    );
  }

  const stored = query.data?.total ?? 0;
  const server = summary.data?.server;
  const hasMore = !!summary.data?.hasMoreOnServer;
  const problem = account && account.status !== 'CONNECTED' ? PROBLEM[account.status] : null;
  const label = FOLDER_LABEL[folder];

  return (
    <MailTable
      scope={scope}
      title={label}
      description={account?.emailAddress ?? ''}
      counter={
        server
          ? `(${server.total.toLocaleString()}${server.unread ? `, ${server.unread.toLocaleString()} unread` : ''})`
          : undefined
      }
      basePath={`/accounts/${accountId}/${folder}`}
      accounts={null}
      page={page}
      pagesCount={Math.max(page, Math.ceil(stored / PAGE_SIZE))}
      openEnd={hasMore}
      onPageChange={(target) => (target <= page ? setPage(target) : void loader.load(target))}
      loading={loader.loading}
      loadingText={`Loading older mail from ${label}…`}
      onRefresh={() => {
        void query.refetch();
        void summary.refetch();
      }}
      alerts={
        <>
          {problem && (
            <Alert
              type="warning"
              action={<Button onClick={() => void navigate('/settings')}>Fix in Settings</Button>}
            >
              {problem}
            </Alert>
          )}
          {loader.failedPage !== null && (
            <Alert
              type="error"
              action={
                <Button onClick={() => void loader.load(loader.failedPage!)}>Try again</Button>
              }
            >
              Something went wrong while loading older mail.
            </Alert>
          )}
        </>
      }
      empty={
        <EmptyMessage
          title={folder === 'inbox' ? 'No mail yet' : `Nothing in ${label}`}
          body={
            folder === 'inbox'
              ? 'OneBox is syncing the newest messages from this account.'
              : server === null
                ? 'OneBox has not found this folder on the server yet. It checks every couple of minutes.'
                : 'This folder is empty.'
          }
        />
      }
    />
  );
}
