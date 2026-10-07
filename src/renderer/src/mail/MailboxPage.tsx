import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { accountColor, accountLabel } from '../accounts/account-color';
import { ProviderLogo } from '../accounts/ProviderLogo';
import type { Account } from '../api/accounts';
import type { ThreadFilter } from '../api/mail';
import {
  useMailboxSummary,
  useRequestHistory,
  useThreadPage,
  type ThreadScope,
} from '../api/mail-queries';
import { useAccounts } from '../api/queries';
import { describeError } from '../auth/errors';
import { ButtonLink } from '../ui/Button';
import { Icon } from '../ui/Icon';
import styles from './MailboxPage.module.css';
import { PageControls, SkeletonRows } from './PageControls';
import { rangeLabel, usePaging } from './paging';
import { ThreadList } from './ThreadList';

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

// Shows a banner when newer mail arrives while the user is on a later page.
function useNewMailNotice(scope: ThreadScope, index: number) {
  const top = useThreadPage(scope, { cursor: null, direction: 'next' });
  const newestId = top.data?.items[0]?.id;
  const [seen, setSeen] = useState(newestId);
  // Re-baseline while on the first page (adjusting state during render, not in an effect).
  if ((index === 0 || seen === undefined) && newestId !== seen) setSeen(newestId);
  return index > 0 && !!newestId && !!seen && newestId !== seen;
}

const PROBLEM: Record<string, string> = {
  AUTH_FAILED: 'The mail server rejected this account’s password.',
  UNREACHABLE: 'OneBox cannot reach this mail server right now.',
  TLS_ERROR: 'This mail server’s certificate could not be verified.',
  DISABLED: 'Syncing is paused for this account.',
};

export function UnifiedMailbox({
  filter,
  title,
  basePath,
}: {
  filter: ThreadFilter;
  title: string;
  basePath: string;
}) {
  const accounts = useAccounts();
  const scope = useMemo<ThreadScope>(() => ({ kind: 'unified', filter }), [filter]);
  const paging = usePaging();
  const query = useThreadPage(scope, paging.page);
  const newMail = useNewMailNotice(scope, paging.index);
  const byId = useMemo(() => new Map((accounts.data ?? []).map((a) => [a.id, a])), [accounts.data]);
  const items = query.data?.items ?? [];
  const atEnd = query.isSuccess && !query.data.nextCursor && items.length > 0;

  return (
    <section className={styles.panel} aria-label={title}>
      <ThreadList
        label={`${title} conversations`}
        items={items}
        basePath={basePath}
        accounts={byId}
        onRefresh={() => void query.refetch()}
        banner={
          newMail && (
            <div className={styles.banner} role="status">
              New mail arrived.
              <button onClick={paging.first}>Back to newest</button>
            </div>
          )
        }
        controls={
          <PageControls
            label={rangeLabel(paging.index, items.length)}
            canPrev={paging.index > 0}
            canNext={!!query.data?.nextCursor}
            onPrev={() => paging.prev(query.data?.prevCursor ?? null)}
            onNext={() => query.data?.nextCursor && paging.next(query.data.nextCursor)}
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
        {query.isSuccess && items.length === 0 && (
          <EmptyState
            title={filter === 'starred' ? 'No starred conversations' : 'Your inbox is empty'}
            body={
              (accounts.data?.length ?? 0) > 0
                ? 'New mail from your connected accounts appears here within seconds.'
                : 'Connect a Gmail, Outlook or IMAP account and new mail will show up here in real time.'
            }
            connect={(accounts.data?.length ?? 0) === 0}
          />
        )}
        {atEnd && (
          <p className={styles.endNote}>
            That is all the mail OneBox has fetched so far. Open an account to load older mail.
          </p>
        )}
      </ThreadList>
    </section>
  );
}

function AccountHeader({ account }: { account: Account }) {
  return (
    <div className={styles.header}>
      <ProviderLogo provider={account.provider} size={28} />
      <span
        className={styles.dot}
        style={{ background: accountColor(account.id) }}
        aria-hidden="true"
      />
      <div>
        <h1>{accountLabel(account)}</h1>
        {account.displayName && <div className={styles.email}>{account.emailAddress}</div>}
      </div>
    </div>
  );
}

export function AccountMailbox() {
  const { accountId = '' } = useParams();
  return <AccountMailboxView key={accountId} accountId={accountId} />;
}

function AccountMailboxView({ accountId }: { accountId: string }) {
  const accounts = useAccounts();
  const account = accounts.data?.find((a) => a.id === accountId);
  const scope = useMemo<ThreadScope>(() => ({ kind: 'account', accountId }), [accountId]);
  const paging = usePaging();
  const query = useThreadPage(scope, paging.page);
  const summary = useMailboxSummary(accountId);
  const history = useRequestHistory(accountId);
  const newMail = useNewMailNotice(scope, paging.index);
  // Set while older mail is being fetched for the page after this one; `accepted` flips once the
  // server has queued the fetch, because before that the status still describes the previous one.
  const [waiting, setWaiting] = useState<{ anchor: string; accepted: boolean } | null>(null);

  const items = query.data?.items ?? [];
  const status = summary.data?.history.status;
  const providerName = account
    ? {
        GMAIL: 'Gmail',
        OUTLOOK: 'Outlook',
        ICLOUD: 'iCloud',
        YAHOO: 'Yahoo',
        IMAP: 'the mail server',
      }[account.provider]
    : 'the mail server';

  if (waiting?.accepted && (status === 'idle' || status === 'complete')) {
    setWaiting(null);
    paging.next(waiting.anchor);
  }

  if (accounts.isSuccess && !account) {
    return (
      <section className={styles.panel} aria-label="Account">
        <EmptyState title="Account not found" body="It may have been removed in Settings." />
      </section>
    );
  }

  const fetching = waiting !== null || history.isPending;
  const canNext =
    !!query.data?.nextCursor || (!!summary.data?.hasMoreOnServer && !!query.data?.endCursor);

  const onNext = () => {
    if (query.data?.nextCursor) {
      paging.next(query.data.nextCursor);
      return;
    }
    const anchor = query.data?.endCursor;
    if (!anchor) return;
    setWaiting({ anchor, accepted: false });
    history.mutate(undefined, {
      onSuccess: () => setWaiting({ anchor, accepted: true }),
      onError: () => setWaiting(null),
    });
  };

  const problem = account && account.status !== 'CONNECTED' ? PROBLEM[account.status] : null;

  return (
    <section className={styles.panel} aria-label={account ? accountLabel(account) : 'Account'}>
      {account && <AccountHeader account={account} />}
      <ThreadList
        label={`${account ? accountLabel(account) : 'Account'} conversations`}
        items={fetching ? [] : items}
        basePath={`/accounts/${accountId}`}
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
            {status === 'error' && !fetching && (
              <div className={`${styles.banner} ${styles.warning}`} role="alert">
                {summary.data?.history.error ?? 'Could not fetch older mail.'}
                <button onClick={onNext}>Try again</button>
              </div>
            )}
            {newMail && (
              <div className={styles.banner} role="status">
                New mail arrived.
                <button onClick={paging.first}>Back to newest</button>
              </div>
            )}
          </>
        }
        controls={
          <PageControls
            label={rangeLabel(paging.index, items.length, summary.data?.server?.total)}
            canPrev={paging.index > 0}
            canNext={canNext}
            onPrev={() => paging.prev(query.data?.prevCursor ?? null)}
            onNext={onNext}
            busy={fetching || (query.isFetching && query.isPlaceholderData)}
          />
        }
      >
        {fetching && <SkeletonRows label={`Fetching older mail from ${providerName}…`} />}
        {!fetching && query.isPending && <SkeletonRows label="Loading conversations" />}
        {query.isError && (
          <p role="alert" className={styles.status}>
            {describeError(query.error)}
          </p>
        )}
        {!fetching && query.isSuccess && items.length === 0 && (
          <EmptyState
            title="No mail yet"
            body="OneBox is syncing the newest messages from this account."
          />
        )}
        {!fetching && query.isSuccess && items.length > 0 && !canNext && status === 'complete' && (
          <p className={styles.endNote}>You have reached the oldest message in this inbox.</p>
        )}
      </ThreadList>
    </section>
  );
}
