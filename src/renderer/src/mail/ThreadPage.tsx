import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useAccountFolders, useThread, useUpdateThread } from '../api/mail-queries';
import { useAccounts } from '../api/queries';
import { describeError } from '../auth/errors';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { Menu } from '../ui/Menu';
import { folderActions, moveRequest, moveTargets, type ActionSpec } from './actions';
import { FOLDER_LABEL, folderName, viewFromPath } from './folders';
import { displayName } from './format';
import { positionIn } from './listContext';
import { MessageCard } from './MessageCard';
import styles from './ThreadPage.module.css';
import { UnsubscribeButton } from './UnsubscribeButton';
import { useMailAction } from './useMailAction';

export function ThreadPage({ basePath = '/inbox' }: { basePath?: string }) {
  const { threadId = '' } = useParams();
  const navigate = useNavigate();
  const query = useThread(threadId);
  const update = useUpdateThread();
  const run = useMailAction();
  const markedRead = useRef<string | null>(null);
  const view = viewFromPath(basePath);
  const accounts = useAccounts();

  const thread = query.data?.thread;
  const folders = useAccountFolders(thread ? [thread.accountId] : [])[0]?.data?.items ?? null;
  const me = accounts.data?.find((account) => account.id === thread?.accountId)?.emailAddress;
  const place = positionIn(basePath, threadId);

  useEffect(() => {
    if (thread && thread.unreadCount > 0 && markedRead.current !== thread.id) {
      markedRead.current = thread.id;
      update.mutate({ id: thread.id, isRead: true });
    }
  }, [thread, update]);

  const back = () => void navigate(basePath);
  const open = (id: string) => void navigate(`${basePath}/${id}`);
  // Every action here takes the conversation out of the list it was opened from.
  const act = (request: ActionSpec, targetName?: string) => {
    if (!thread) return;
    run([thread.id], request, targetName);
    back();
  };
  const targets = moveTargets(view, folders);
  const labelName = (path: string) =>
    folders?.find((folder) => folder.role === 'label' && folder.path === path)?.name ?? path;

  return (
    <section className={styles.panel} aria-label="Conversation">
      <div className={styles.toolbar} role="toolbar" aria-label="Conversation actions">
        <IconButton icon="back" label="Back to list" tooltip="Back" onClick={back} />
        {thread && (
          <>
            <span className={styles.gap} />
            {folderActions(view).map((item) => (
              <IconButton
                key={item.id}
                icon={item.icon}
                label={item.label}
                onClick={() => act(item.request)}
              />
            ))}
            <span className={styles.divider} aria-hidden="true" />
            <IconButton
              icon="markUnread"
              label="Mark as unread"
              onClick={() => {
                update.mutate({ id: thread.id, isRead: false });
                back();
              }}
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
                act(moveRequest(view, target.target), target.label);
              }}
            />
          </>
        )}
        {place && (
          <div className={styles.position}>
            <span>
              {place.position.toLocaleString()} of{' '}
              {(place.total ?? place.position).toLocaleString()}
            </span>
            <IconButton
              icon="chevronLeft"
              label="Newer"
              disabled={!place.newer}
              onClick={() => place.newer && open(place.newer)}
            />
            <IconButton
              icon="chevron"
              label="Older"
              disabled={!place.older}
              onClick={() => place.older && open(place.older)}
            />
          </div>
        )}
      </div>

      <div className={styles.body}>
        {query.isPending && <p className={styles.status}>Loading conversation…</p>}
        {query.isError && (
          <p role="alert" className={styles.status}>
            {describeError(query.error)}
          </p>
        )}
        {query.data && thread && (
          <>
            <div className={styles.subjectRow}>
              <h1 className={styles.subject}>{thread.subject || '(no subject)'}</h1>
              {thread.folders.includes('inbox') && (
                <span className={styles.chip}>
                  {FOLDER_LABEL.inbox}
                  <button
                    type="button"
                    aria-label="Remove label Inbox"
                    data-tooltip="Remove this label"
                    onClick={() => act({ action: 'archive' })}
                  >
                    <Icon name="close" size={14} />
                  </button>
                </span>
              )}
              {(['spam', 'trash'] as const)
                .filter((role) => thread.folders.includes(role))
                .map((role) => (
                  <span key={role} className={styles.chip}>
                    {folderName(role)}
                  </span>
                ))}
              {thread.labels.map((path) => (
                <span key={path} className={styles.chip}>
                  {labelName(path)}
                  <button
                    type="button"
                    aria-label={`Remove label ${labelName(path)}`}
                    data-tooltip="Remove this label"
                    onClick={() =>
                      act(
                        { action: 'move', from: { label: path }, to: { role: 'archive' } },
                        folderName('archive', folders?.find((f) => f.role === 'archive')?.name),
                      )
                    }
                  >
                    <Icon name="close" size={14} />
                  </button>
                </span>
              ))}
            </div>
            {query.data.messages.map((message, index, all) => {
              const latest = index === all.length - 1;
              return (
                <MessageCard
                  key={message.id}
                  message={message}
                  me={me ?? null}
                  defaultExpanded={latest || !message.isRead}
                  {...(latest && {
                    starred: thread.isStarred,
                    onToggleStar: () =>
                      update.mutate({ id: thread.id, isStarred: !thread.isStarred }),
                  })}
                  unsubscribe={
                    thread.canUnsubscribe && latest ? (
                      <UnsubscribeButton
                        threadId={thread.id}
                        sender={displayName(thread.lastFrom)}
                        unsubscribed={!!thread.unsubscribedAt}
                        variant="header"
                      />
                    ) : undefined
                  }
                />
              );
            })}
          </>
        )}
      </div>
    </section>
  );
}
