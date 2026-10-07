import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import type { Account } from '../api/accounts';
import type { Thread } from '../api/mail';
import { useUpdateThread } from '../api/mail-queries';
import { Icon } from '../ui/Icon';
import styles from './MailboxPage.module.css';
import { ThreadRow } from './ThreadRow';

interface ThreadListProps {
  label: string;
  items: Thread[];
  basePath: string;
  controls: ReactNode;
  accounts?: Map<string, Account>;
  banner?: ReactNode;
  children?: ReactNode;
  onRefresh: () => void;
}

export function ThreadList({
  label,
  items,
  basePath,
  controls,
  accounts,
  banner,
  children,
  onRefresh,
}: ThreadListProps) {
  const update = useUpdateThread();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Set<string>>(new Set());
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
    <>
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
          <button aria-label="Refresh" title="Refresh" onClick={onRefresh}>
            <Icon name="refresh" size={20} />
          </button>
        )}
        {controls}
      </div>
      {banner}
      <div className={styles.list} role="grid" aria-label={label}>
        {items.map((thread) => (
          <ThreadRow
            key={thread.id}
            thread={thread}
            account={accounts?.get(thread.accountId)}
            selected={selected.has(thread.id)}
            onOpen={(t) => void navigate(`${basePath}/${t.id}`)}
            onToggleSelect={toggleSelect}
            onToggleStar={(t) => update.mutate({ id: t.id, isStarred: !t.isStarred })}
          />
        ))}
        {children}
      </div>
    </>
  );
}
