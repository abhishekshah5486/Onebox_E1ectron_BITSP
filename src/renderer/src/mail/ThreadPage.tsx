import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  useAccountFolders,
  useThread,
  useThreadAction,
  useUpdateThread,
} from '../api/mail-queries';
import { describeError } from '../auth/errors';
import { Icon } from '../ui/Icon';
import { folderActions, moveRequest, moveTargets, type ActionSpec } from './actions';
import { viewFromPath } from './folders';
import { displayName } from './format';
import { MessageCard } from './MessageCard';
import { MoveMenu } from './MoveMenu';
import styles from './ThreadPage.module.css';
import { UnsubscribeButton } from './UnsubscribeButton';

export function ThreadPage({ basePath = '/inbox' }: { basePath?: string }) {
  const { threadId = '' } = useParams();
  const navigate = useNavigate();
  const query = useThread(threadId);
  const update = useUpdateThread();
  const act = useThreadAction();
  const markedRead = useRef(false);
  const view = viewFromPath(basePath);

  const thread = query.data?.thread;
  const folders = useAccountFolders(thread ? [thread.accountId] : [])[0]?.data?.items ?? null;
  useEffect(() => {
    if (thread && thread.unreadCount > 0 && !markedRead.current) {
      markedRead.current = true;
      update.mutate({ id: thread.id, isRead: true });
    }
  }, [thread, update]);

  const back = () => void navigate(basePath);
  // Every action here takes the conversation out of the list it was opened from.
  const run = (request: ActionSpec) => {
    if (!thread) return;
    act.mutate({ threadIds: [thread.id], ...request });
    back();
  };

  return (
    <section className={styles.panel} aria-label="Conversation">
      <div className={styles.toolbar} role="toolbar" aria-label="Conversation actions">
        <button aria-label="Back to list" title="Back" onClick={back}>
          <Icon name="back" size={20} />
        </button>
        {thread && (
          <>
            {folderActions(view).map((item) => (
              <button
                key={item.id}
                aria-label={item.label}
                title={item.label}
                onClick={() => run(item.request)}
              >
                <Icon name={item.icon} size={20} />
              </button>
            ))}
            <MoveMenu
              targets={moveTargets(view, folders)}
              onMove={(target) => run(moveRequest(view, target.target))}
            />
            <button
              aria-label="Mark as unread"
              title="Mark as unread"
              onClick={() => {
                update.mutate({ id: thread.id, isRead: false });
                back();
              }}
            >
              <Icon name="mail" size={20} />
            </button>
            <button
              className={thread.isStarred ? styles.starred : undefined}
              aria-pressed={thread.isStarred}
              aria-label={thread.isStarred ? 'Unstar' : 'Star'}
              onClick={() => update.mutate({ id: thread.id, isStarred: !thread.isStarred })}
            >
              <Icon name="star" size={20} />
            </button>
          </>
        )}
      </div>

      <div className={styles.body}>
        {query.isPending && <p className={styles.status}>Loading conversation…</p>}
        {query.isError && (
          <p role="alert" className={styles.status}>
            {describeError(query.error)}
          </p>
        )}
        {query.data && (
          <>
            <div className={styles.subjectRow}>
              <h1 className={styles.subject}>{query.data.thread.subject || '(no subject)'}</h1>
              {query.data.thread.canUnsubscribe && (
                <UnsubscribeButton
                  threadId={query.data.thread.id}
                  sender={displayName(query.data.thread.lastFrom)}
                  unsubscribed={!!query.data.thread.unsubscribedAt}
                />
              )}
            </div>
            {query.data.messages.map((message, index, all) => (
              <MessageCard
                key={message.id}
                message={message}
                defaultExpanded={index === all.length - 1 || !message.isRead}
              />
            ))}
          </>
        )}
      </div>
    </section>
  );
}
