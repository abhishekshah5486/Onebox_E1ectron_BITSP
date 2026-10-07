import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useThread, useUpdateThread } from '../api/mail-queries';
import { describeError } from '../auth/errors';
import { Icon } from '../ui/Icon';
import { MessageCard } from './MessageCard';
import styles from './ThreadPage.module.css';

export function ThreadPage({ basePath = '/inbox' }: { basePath?: string }) {
  const { threadId = '' } = useParams();
  const navigate = useNavigate();
  const query = useThread(threadId);
  const update = useUpdateThread();
  const markedRead = useRef(false);

  const thread = query.data?.thread;
  useEffect(() => {
    if (thread && thread.unreadCount > 0 && !markedRead.current) {
      markedRead.current = true;
      update.mutate({ id: thread.id, isRead: true });
    }
  }, [thread, update]);

  const back = () => void navigate(basePath);

  return (
    <section className={styles.panel} aria-label="Conversation">
      <div className={styles.toolbar} role="toolbar" aria-label="Conversation actions">
        <button aria-label="Back to list" title="Back" onClick={back}>
          <Icon name="back" size={20} />
        </button>
        {thread && (
          <>
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
            <h1 className={styles.subject}>{query.data.thread.subject || '(no subject)'}</h1>
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
