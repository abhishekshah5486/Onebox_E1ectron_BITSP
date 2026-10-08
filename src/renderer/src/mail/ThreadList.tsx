import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import type { Account } from '../api/accounts';
import type { FolderCounts, Thread } from '../api/mail';
import { useAccountFolders, useThreadAction } from '../api/mail-queries';
import { describeError } from '../auth/errors';
import { Icon } from '../ui/Icon';
import { folderActions, moveRequest, moveTargets, type ActionSpec } from './actions';
import type { MailboxView } from './folders';
import styles from './MailboxPage.module.css';
import { MoveMenu } from './MoveMenu';
import { ThreadRow } from './ThreadRow';

interface ThreadListProps {
  label: string;
  items: Thread[];
  basePath: string;
  controls: ReactNode;
  // The folder or label shown; null for views spanning folders, like Starred.
  view: MailboxView | null;
  // The account's folders and labels, for "Move to"; null in views spanning accounts.
  folders: FolderCounts[] | null;
  accounts?: Map<string, Account>;
  banner?: ReactNode;
  tabs?: ReactNode;
  children?: ReactNode;
  onRefresh: () => void;
}

export function ThreadList({
  label,
  items,
  basePath,
  controls,
  view,
  folders,
  accounts,
  banner,
  tabs,
  children,
  onRefresh,
}: ThreadListProps) {
  const act = useThreadAction();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allSelected = items.length > 0 && items.every((thread) => selected.has(thread.id));
  const actions = folderActions(view);
  const selectedThreads = items.filter((thread) => selected.has(thread.id));
  const anyUnread = selectedThreads.some((thread) => thread.unreadCount > 0);
  const allStarred = selectedThreads.length > 0 && selectedThreads.every((t) => t.isStarred);
  // Views spanning accounts can still offer labels when everything selected is from one.
  const soleAccount =
    folders === null &&
    selectedThreads.length > 0 &&
    selectedThreads.every((t) => t.accountId === selectedThreads[0]!.accountId)
      ? selectedThreads[0]!.accountId
      : null;
  const soleFolders = useAccountFolders(soleAccount ? [soleAccount] : [])[0]?.data?.items ?? null;

  const toggleSelect = (thread: Thread) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(thread.id)) next.delete(thread.id);
      else next.add(thread.id);
      return next;
    });

  const run = (threadIds: string[], request: ActionSpec) => {
    act.mutate({ threadIds, ...request });
    if (request.action !== 'star' && request.action !== 'unstar') {
      setSelected((current) => new Set([...current].filter((id) => !threadIds.includes(id))));
    }
  };
  const onSelected = (request: ActionSpec) => run([...selected], request);

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
            {actions.map((item) => (
              <button
                key={item.id}
                aria-label={item.label}
                title={item.label}
                onClick={() => onSelected(item.request)}
              >
                <Icon name={item.icon} size={20} />
              </button>
            ))}
            <MoveMenu
              targets={moveTargets(view, folders ?? soleFolders)}
              onMove={(target) => onSelected(moveRequest(view, target.target))}
            />
            <span className={styles.divider} aria-hidden="true" />
            <button
              aria-label={anyUnread ? 'Mark as read' : 'Mark as unread'}
              title={anyUnread ? 'Mark as read' : 'Mark as unread'}
              onClick={() => onSelected({ action: anyUnread ? 'read' : 'unread' })}
            >
              <Icon name={anyUnread ? 'markRead' : 'mail'} size={20} />
            </button>
            <button
              aria-label={allStarred ? 'Remove star' : 'Add star'}
              title={allStarred ? 'Remove star' : 'Add star'}
              onClick={() => onSelected({ action: allStarred ? 'unstar' : 'star' })}
            >
              <Icon name="star" size={20} />
            </button>
          </>
        ) : (
          <button aria-label="Refresh" title="Refresh" onClick={onRefresh}>
            <Icon name="refresh" size={20} />
          </button>
        )}
        {controls}
      </div>
      {tabs}
      {act.isError && (
        <div className={`${styles.banner} ${styles.warning}`} role="alert">
          {describeError(act.error)}
        </div>
      )}
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
            onToggleStar={(t) => run([t.id], { action: t.isStarred ? 'unstar' : 'star' })}
            hoverActions={actions.slice(0, 2)}
            onAction={(t, request) => run([t.id], request)}
          />
        ))}
        {children}
      </div>
    </>
  );
}
