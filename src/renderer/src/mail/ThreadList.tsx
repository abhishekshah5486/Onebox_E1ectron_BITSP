import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import type { Account } from '../api/accounts';
import type { FolderCounts, Thread } from '../api/mail';
import { useAccountFolders } from '../api/mail-queries';
import { usePreferences } from '../api/queries';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { Menu } from '../ui/Menu';
import { folderActions, moveRequest, moveTargets, type ActionSpec } from './actions';
import { labelKey, type MailboxView } from './folders';
import { rememberList } from './listContext';
import styles from './MailboxPage.module.css';
import { ThreadRow } from './ThreadRow';
import { useMailAction } from './useMailAction';

interface ThreadListProps {
  label: string;
  items: Thread[];
  basePath: string;
  controls: ReactNode;
  // The folder or label shown; null for views spanning folders, like Starred.
  view: MailboxView | null;
  // The account's folders and labels, for "Move to"; null in views spanning accounts.
  folders: FolderCounts[] | null;
  // Where this page sits in the whole list, for "3 of 120" in the reading view.
  position: { offset: number; total: number | null };
  accounts?: Map<string, Account>;
  banner?: ReactNode;
  tabs?: ReactNode;
  children?: ReactNode;
  onRefresh: () => void;
}

const SELECT_BY: { key: string; label: string; test: (thread: Thread) => boolean }[] = [
  { key: 'all', label: 'All', test: () => true },
  { key: 'none', label: 'None', test: () => false },
  { key: 'read', label: 'Read', test: (t) => t.unreadCount === 0 },
  { key: 'unread', label: 'Unread', test: (t) => t.unreadCount > 0 },
  { key: 'starred', label: 'Starred', test: (t) => t.isStarred },
  { key: 'unstarred', label: 'Unstarred', test: (t) => !t.isStarred },
];

export function ThreadList({
  label,
  items,
  basePath,
  controls,
  view,
  folders,
  position,
  accounts,
  banner,
  tabs,
  children,
  onRefresh,
}: ThreadListProps) {
  const run = useMailAction();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const selectedThreads = items.filter((thread) => selected.has(thread.id));
  const allSelected = items.length > 0 && selectedThreads.length === items.length;
  const actions = folderActions(view);
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
  const targets = moveTargets(view, folders ?? soleFolders);
  const chipsHidden = new Set(usePreferences().data?.chipsHidden ?? []);
  // Like Gmail: "Inbox" outside the inbox, then each label not hidden in Manage labels.
  const chipsFor = (thread: Thread) => [
    ...(thread.folders.includes('inbox') && !(view && 'role' in view && view.role === 'inbox')
      ? ['Inbox']
      : []),
    ...thread.labels.filter(
      (path) =>
        !chipsHidden.has(labelKey(thread.accountId, path)) &&
        !(view && 'label' in view && view.label === path),
    ),
  ];

  const ids = items.map((thread) => thread.id).join(',');
  useEffect(() => {
    rememberList({
      basePath,
      ids: ids ? ids.split(',') : [],
      offset: position.offset,
      total: position.total,
    });
  }, [basePath, ids, position.offset, position.total]);

  const apply = (threadIds: string[], request: ActionSpec, targetName?: string) => {
    run(threadIds, request, targetName);
    if (request.action !== 'star' && request.action !== 'unstar') {
      setSelected((current) => new Set([...current].filter((id) => !threadIds.includes(id))));
    }
  };
  const onSelected = (request: ActionSpec, targetName?: string) =>
    apply([...selected], request, targetName);

  return (
    <>
      <div className={styles.toolbar} role="toolbar" aria-label="Mail actions">
        <div className={styles.selectAll}>
          <button
            type="button"
            role="checkbox"
            aria-checked={allSelected ? true : selected.size > 0 ? 'mixed' : false}
            aria-label="Select all"
            data-tooltip="Select"
            className={styles.selectBox}
            onClick={() =>
              setSelected(selected.size > 0 ? new Set() : new Set(items.map((t) => t.id)))
            }
          >
            <Icon
              name={
                allSelected ? 'checkboxChecked' : selected.size > 0 ? 'checkboxSome' : 'checkbox'
              }
              size={20}
            />
          </button>
          <Menu
            label="Select by"
            icon="caret"
            size="small"
            items={SELECT_BY.map(({ key, label: text }) => ({ key, label: text }))}
            onSelect={(key) => {
              const rule = SELECT_BY.find((item) => item.key === key)!;
              setSelected(new Set(items.filter(rule.test).map((t) => t.id)));
            }}
          />
        </div>
        {selected.size > 0 ? (
          <>
            {actions.map((item) => (
              <IconButton
                key={item.id}
                icon={item.icon}
                label={item.label}
                onClick={() => onSelected(item.request)}
              />
            ))}
            <span className={styles.divider} aria-hidden="true" />
            <IconButton
              icon={anyUnread ? 'markRead' : 'markUnread'}
              label={anyUnread ? 'Mark as read' : 'Mark as unread'}
              onClick={() => onSelected({ action: anyUnread ? 'read' : 'unread' })}
            />
            <Menu
              label="Move to"
              icon="move"
              heading="Move to:"
              items={targets.map((target) => ({
                key: target.key,
                label: target.label,
                icon: 'label' in target.target ? 'labelFilled' : 'move',
              }))}
              onSelect={(key) => {
                const target = targets.find((item) => item.key === key)!;
                onSelected(moveRequest(view, target.target), target.label);
              }}
            />
            <IconButton
              icon={allStarred ? 'starFilled' : 'star'}
              label={allStarred ? 'Remove star' : 'Add star'}
              onClick={() => onSelected({ action: allStarred ? 'unstar' : 'star' })}
            />
          </>
        ) : (
          <IconButton icon="refresh" label="Refresh" onClick={onRefresh} />
        )}
        {controls}
      </div>
      {tabs}
      {banner}
      <div className={styles.list} role="grid" aria-label={label} aria-multiselectable="true">
        {items.map((thread) => (
          <ThreadRow
            key={thread.id}
            thread={thread}
            account={accounts?.get(thread.accountId)}
            selected={selected.has(thread.id)}
            onOpen={(t) => void navigate(`${basePath}/${t.id}`)}
            onToggleSelect={(t) =>
              setSelected((current) => {
                const next = new Set(current);
                if (next.has(t.id)) next.delete(t.id);
                else next.add(t.id);
                return next;
              })
            }
            onToggleStar={(t) => apply([t.id], { action: t.isStarred ? 'unstar' : 'star' })}
            hoverActions={actions.slice(0, 2)}
            chips={chipsFor(thread)}
            onAction={(t, request) => apply([t.id], request)}
          />
        ))}
        {children}
      </div>
    </>
  );
}
