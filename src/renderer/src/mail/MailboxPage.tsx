import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { ProviderLogo } from '../accounts/ProviderLogo';
import type { Account } from '../api/accounts';
import type { ThreadFilter } from '../api/mail';
import { useMailboxSummary, useThreadPage, type ThreadScope } from '../api/mail-queries';
import { useAccounts } from '../api/queries';
import { describeError } from '../auth/errors';
import { ButtonLink } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { FOLDER_LABEL, isFolderRole, type FolderRole } from './folders';
import styles from './MailboxPage.module.css';
import { PageControls, SkeletonRows } from './PageControls';
import { PAGE_SIZE, rangeLabel } from './paging';
import { ThreadList } from './ThreadList';
import { useLoadPage } from './useLoadPage';

function EmptyState({ title, body, connect }: { title: string; body: string; connect?: boolean }) {
  return (
    <div className={styles.empty}>
      <Icon name="mail" size={64} />
      <h2>{title}</h2>
      <p>{body}</p>
      {connect && <ButtonLink to="/settings">Connect an account</ButtonLink>}
    </div>
  );
}

const PROVIDER_NAME = {
  GMAIL: 'Gmail',
  OUTLOOK: 'Outlook',
  ICLOUD: 'iCloud',
  YAHOO: 'Yahoo',
  IMAP: 'the mail server',
} as const;

const PROBLEM: Record<string, string> = {
  AUTH_FAILED: 'The mail server rejected this account’s password.',
  UNREACHABLE: 'OneBox cannot reach this mail server right now.',
  TLS_ERROR: 'This mail server’s certificate could not be verified.',
  DISABLED: 'Syncing is paused for this account.',
};

function unifiedEmpty(filter: ThreadFilter, folder: FolderRole | null, hasAccounts: boolean) {
  const title =
    filter === 'starred'
      ? 'No starred conversations'
      : !folder || folder === 'inbox'
        ? 'Your inbox is empty'
        : `Nothing in ${FOLDER_LABEL[folder]}`;
  const body = !hasAccounts
    ? 'Connect a Gmail, Outlook or IMAP account and new mail will show up here in real time.'
    : filter === 'starred'
      ? 'Star a conversation to find it here later.'
      : !folder || folder === 'inbox'
        ? 'New mail from your connected accounts appears here within seconds.'
        : 'OneBox checks this folder on each account every couple of minutes.';
  return { title, body };
}

export function UnifiedMailbox({
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
  const accounts = useAccounts();
  const scope = useMemo<ThreadScope>(() => ({ kind: 'unified', filter, folder }), [filter, folder]);
  const [page, setPage] = useState(1);
  const query = useThreadPage(scope, page);
  const byId = useMemo(() => new Map((accounts.data ?? []).map((a) => [a.id, a])), [accounts.data]);
  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const hasAccounts = (accounts.data?.length ?? 0) > 0;
  const empty = unifiedEmpty(filter, folder, hasAccounts);

  return (
    <section className={styles.panel} aria-label={title}>
      <ThreadList
        label={`${title} conversations`}
        items={items}
        basePath={basePath}
        accounts={byId}
        onRefresh={() => void query.refetch()}
        controls={
          <PageControls
            label={rangeLabel(page, items.length, total || null)}
            canPrev={page > 1}
            canNext={page * PAGE_SIZE < total}
            onPrev={() => setPage((p) => p - 1)}
            onNext={() => setPage((p) => p + 1)}
            busy={query.isFetching && query.isPlaceholderData}
          />
        }
      >
        {query.isPending && <SkeletonRows label="Loading conversations" />}
        {query.isError && (
          <p role="alert" className={styles.status}>
            {describeError(query.error)}
          </p>
        )}
        {query.isSuccess && total === 0 && (
          <EmptyState title={empty.title} body={empty.body} connect={!hasAccounts} />
        )}
        {query.isSuccess && total > 0 && page * PAGE_SIZE >= total && (
          <p className={styles.endNote}>
            That is all the mail OneBox has fetched so far. Open an account to load older mail.
          </p>
        )}
      </ThreadList>
    </section>
  );
}

function AccountHeader({ account, folder }: { account: Account; folder: FolderRole }) {
  return (
    <div className={styles.header}>
      <ProviderLogo provider={account.provider} size={28} />
      <div>
        <h1>{account.emailAddress}</h1>
        <div className={styles.email}>
          {FOLDER_LABEL[folder]}
          {account.displayName && ` · ${account.displayName}`}
        </div>
      </div>
    </div>
  );
}

function accountEmpty(folder: FolderRole, notFound: boolean) {
  if (folder === 'inbox') {
    return {
      title: 'No mail yet',
      body: 'OneBox is syncing the newest messages from this account.',
    };
  }
  return {
    title: `Nothing in ${FOLDER_LABEL[folder]}`,
    body: notFound
      ? 'OneBox has not found this folder on the server yet. It checks every couple of minutes.'
      : 'This folder is empty.',
  };
}

export function AccountMailbox() {
  const { accountId = '', folder } = useParams();
  if (!isFolderRole(folder)) return <Navigate to={`/accounts/${accountId}/inbox`} replace />;
  return (
    <AccountMailboxView key={`${accountId}/${folder}`} accountId={accountId} folder={folder} />
  );
}

function AccountMailboxView({ accountId, folder }: { accountId: string; folder: FolderRole }) {
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
      <section className={styles.panel} aria-label="Account">
        <EmptyState title="Account not found" body="It may have been removed in Settings." />
      </section>
    );
  }

  const items = query.data?.items ?? [];
  const stored = query.data?.total ?? 0;
  const canNext = page * PAGE_SIZE < stored || !!summary.data?.hasMoreOnServer;
  const provider = account ? PROVIDER_NAME[account.provider] : 'the mail server';
  const problem = account && account.status !== 'CONNECTED' ? PROBLEM[account.status] : null;

  return (
    <section className={styles.panel} aria-label={account?.emailAddress ?? 'Account'}>
      {account && <AccountHeader account={account} folder={folder} />}
      <ThreadList
        label={`${account?.emailAddress ?? 'Account'} ${FOLDER_LABEL[folder]} conversations`}
        items={loader.loading ? [] : items}
        basePath={`/accounts/${accountId}/${folder}`}
        onRefresh={() => {
          void query.refetch();
          void summary.refetch();
        }}
        banner={
          <>
            {problem && (
              <div className={`${styles.banner} ${styles.warning}`} role="alert">
                {problem}
                <Link to="/settings">Fix in Settings</Link>
              </div>
            )}
            {loader.failedPage !== null && (
              <div className={`${styles.banner} ${styles.warning}`} role="alert">
                Something went wrong while loading older mail.
                <button onClick={() => void loader.load(loader.failedPage!)}>Try again</button>
              </div>
            )}
          </>
        }
        controls={
          <PageControls
            label={rangeLabel(page, items.length, summary.data?.server?.total)}
            canPrev={page > 1}
            canNext={canNext}
            onPrev={() => setPage((p) => p - 1)}
            onNext={() => void loader.load(page + 1)}
            busy={loader.loading || (query.isFetching && query.isPlaceholderData)}
          />
        }
      >
        {loader.loading && <SkeletonRows label={`Loading older mail from ${provider}…`} />}
        {!loader.loading && query.isPending && <SkeletonRows label="Loading conversations" />}
        {query.isError && (
          <p role="alert" className={styles.status}>
            {describeError(query.error)}
          </p>
        )}
        {!loader.loading && query.isSuccess && stored === 0 && (
          <EmptyState {...accountEmpty(folder, summary.data?.server === null)} />
        )}
        {!loader.loading && query.isSuccess && items.length > 0 && !canNext && (
          <p className={styles.endNote}>You have reached the oldest email in this folder.</p>
        )}
      </ThreadList>
    </section>
  );
}
