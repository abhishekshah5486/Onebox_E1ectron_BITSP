import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import type { Thread, ThreadFilter } from '../api/mail';
import { useThreads, useUpdateThread } from '../api/mail-queries';
import { useAccounts } from '../api/queries';
import { describeError } from '../auth/errors';
import { ButtonLink } from '../ui/Button';
import { Icon } from '../ui/Icon';
import styles from './MailboxPage.module.css';
import { ThreadRow } from './ThreadRow';

interface MailboxPageProps {
  folder: string;
  filter?: ThreadFilter | null;
  basePath?: string;
}

function EmptyState({ folder, hasAccounts }: { folder: string; hasAccounts: boolean }) {
  return (
    <div className={styles.empty}>
      <Icon name="mail" size={64} />
      {hasAccounts ? (
        <>
          <h2>{folder === 'Inbox' ? 'You are all caught up' : `No conversations in ${folder}`}</h2>
          <p>New mail from your connected accounts appears here within seconds.</p>
        </>
      ) : (
        <>
          <h2>{folder === 'Inbox' ? 'Your inbox is empty' : `No conversations in ${folder}`}</h2>
          <p>
            Connect a Gmail, Outlook or IMAP account and new mail will show up here in real time.
          </p>
          <ButtonLink to="/settings">Connect an account</ButtonLink>
        </>
      )}
    </div>
  );
}

function UnsyncedFolder({ folder }: { folder: string }) {
  return (
    <div className={styles.empty}>
      <Icon name="mail" size={64} />
      <h2>{folder} is not synced yet</h2>
      <p>OneBox syncs your inbox today. {folder} arrives in an upcoming release.</p>
    </div>
  );
}

export function MailboxPage({ folder, filter = 'all', basePath = '/inbox' }: MailboxPageProps) {
  if (filter === null) {
    return (
      <section className={styles.panel} aria-label={folder}>
        <UnsyncedFolder folder={folder} />
      </section>
    );
  }
  return <ThreadList folder={folder} filter={filter} basePath={basePath} />;
}

function ThreadList({
  folder,
  filter,
  basePath,
}: {
  folder: string;
  filter: ThreadFilter;
  basePath: string;
}) {
  const threads = useThreads(filter);
  const accounts = useAccounts();
  const update = useUpdateThread();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const items = useMemo(
    () => threads.data?.pages.flatMap((page) => page.items) ?? [],
    [threads.data],
  );
  const allSelected = items.length > 0 && items.every((thread) => selected.has(thread.id));

  const toggleSelect = (thread: Thread) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(thread.id)) next.delete(thread.id);
      else next.add(thread.id);
      return next;
    });

  const markSelected = (isRead: boolean) => {
    for (const id of selected) update.mutate({ id, isRead });
    setSelected(new Set());
  };

  return (
    <section className={styles.panel} aria-label={folder}>
      <div className={styles.toolbar} role="toolbar" aria-label="Mail actions">
        <button
          role="checkbox"
          aria-checked={allSelected}
          aria-label="Select all"
          onClick={() =>
            setSelected(allSelected ? new Set() : new Set(items.map((thread) => thread.id)))
          }
        >
          <Icon name="checkbox" size={20} />
        </button>
        {selected.size > 0 ? (
          <>
            <button
              aria-label="Mark as read"
              title="Mark as read"
              onClick={() => markSelected(true)}
            >
              <Icon name="mail" size={20} />
            </button>
            <button
              aria-label="Mark as unread"
              title="Mark as unread"
              onClick={() => markSelected(false)}
            >
              <Icon name="inbox" size={20} />
            </button>
          </>
        ) : (
          <button aria-label="Refresh" title="Refresh" onClick={() => void threads.refetch()}>
            <Icon name="refresh" size={20} />
          </button>
        )}
        <span className={styles.count}>
          {items.length > 0 ? `1–${items.length}${threads.hasNextPage ? '+' : ''}` : '0'}
        </span>
      </div>

      <div className={styles.list} role="grid" aria-label={`${folder} conversations`}>
        {threads.isPending && <p className={styles.status}>Loading conversations…</p>}
        {threads.isError && (
          <p role="alert" className={styles.status}>
            {describeError(threads.error)}
          </p>
        )}
        {items.map((thread) => (
          <ThreadRow
            key={thread.id}
            thread={thread}
            selected={selected.has(thread.id)}
            onOpen={(t) => void navigate(`${basePath}/${t.id}`)}
            onToggleSelect={toggleSelect}
            onToggleStar={(t) => update.mutate({ id: t.id, isStarred: !t.isStarred })}
          />
        ))}
        {threads.isSuccess && items.length === 0 && (
          <EmptyState folder={folder} hasAccounts={(accounts.data?.length ?? 0) > 0} />
        )}
        {threads.hasNextPage && (
          <div className={styles.more}>
            <button
              onClick={() => void threads.fetchNextPage()}
              disabled={threads.isFetchingNextPage}
            >
              {threads.isFetchingNextPage ? 'Loading…' : 'Load older conversations'}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
