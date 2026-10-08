import type { KeyboardEvent, MouseEvent } from 'react';
import { ProviderLogo } from '../accounts/ProviderLogo';
import type { Account } from '../api/accounts';
import type { Thread } from '../api/mail';
import { Icon } from '../ui/Icon';
import type { ActionItem, ActionSpec } from './actions';
import { displayName, formatListDate } from './format';
import styles from './ThreadRow.module.css';
import { UnsubscribeButton } from './UnsubscribeButton';

interface ThreadRowProps {
  thread: Thread;
  // Set in unified views so each row shows which mailbox it came from.
  account?: Account | undefined;
  selected: boolean;
  onOpen: (thread: Thread) => void;
  onToggleSelect: (thread: Thread) => void;
  onToggleStar: (thread: Thread) => void;
  // Shown in place of the date while the row is hovered, like Gmail.
  hoverActions?: ActionItem[];
  onAction?: (thread: Thread, action: ActionSpec) => void;
}

export function ThreadRow({
  thread,
  account,
  selected,
  onOpen,
  onToggleSelect,
  onToggleStar,
  hoverActions = [],
  onAction,
}: ThreadRowProps) {
  const unread = thread.unreadCount > 0;
  const stop = (handler: () => void) => (event: MouseEvent) => {
    event.stopPropagation();
    handler();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') onOpen(thread);
  };

  return (
    <div
      role="row"
      tabIndex={0}
      aria-label={`${unread ? 'Unread, ' : ''}${displayName(thread.lastFrom)}, ${thread.subject || '(no subject)'}`}
      className={[
        styles.row,
        unread ? styles.unread : styles.read,
        selected ? styles.selected : '',
      ].join(' ')}
      onClick={() => onOpen(thread)}
      onKeyDown={onKeyDown}
    >
      <button
        className={styles.iconButton}
        role="checkbox"
        aria-checked={selected}
        aria-label="Select conversation"
        onClick={stop(() => onToggleSelect(thread))}
      >
        <Icon name="checkbox" size={18} />
      </button>
      <button
        className={`${styles.iconButton} ${thread.isStarred ? styles.starred : ''}`}
        aria-pressed={thread.isStarred}
        aria-label={thread.isStarred ? 'Starred' : 'Not starred'}
        onClick={stop(() => onToggleStar(thread))}
      >
        <Icon name="star" size={18} />
      </button>
      <span className={styles.sender}>
        {account && (
          <span className={styles.chip} title={account.emailAddress}>
            <ProviderLogo provider={account.provider} size={14} />
          </span>
        )}
        {displayName(thread.lastFrom)}
        {thread.messageCount > 1 && <span className={styles.count}>{thread.messageCount}</span>}
      </span>
      <span className={styles.summary}>
        {thread.subject || '(no subject)'}
        {thread.snippet && <span className={styles.snippet}> - {thread.snippet}</span>}
      </span>
      <span
        className={styles.attachment}
        aria-label={thread.hasAttachments ? 'Has attachments' : undefined}
      >
        {thread.canUnsubscribe && (
          <span className={styles.unsubscribe}>
            <UnsubscribeButton
              threadId={thread.id}
              sender={displayName(thread.lastFrom)}
              unsubscribed={!!thread.unsubscribedAt}
              size="small"
            />
          </span>
        )}
        {thread.hasAttachments && <Icon name="draft" size={16} />}
      </span>
      <span className={styles.end}>
        <span className={styles.date}>{formatListDate(thread.lastMessageAt)}</span>
        {onAction && (
          <span className={styles.hoverActions}>
            {[
              ...hoverActions,
              {
                id: 'read',
                label: unread ? 'Mark as read' : 'Mark as unread',
                icon: unread ? ('markRead' as const) : ('mail' as const),
                request: { action: unread ? ('read' as const) : ('unread' as const) },
              },
            ].map((item) => (
              <button
                key={item.id}
                className={styles.iconButton}
                aria-label={`${item.label}: ${thread.subject || '(no subject)'}`}
                title={item.label}
                onClick={stop(() => onAction(thread, item.request))}
              >
                <Icon name={item.icon} size={18} />
              </button>
            ))}
          </span>
        )}
      </span>
    </div>
  );
}
