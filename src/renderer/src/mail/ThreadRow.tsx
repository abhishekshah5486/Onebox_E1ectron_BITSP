import type { KeyboardEvent, MouseEvent } from 'react';
import { ProviderLogo } from '../accounts/ProviderLogo';
import type { Account } from '../api/accounts';
import type { Thread } from '../api/mail';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import type { ActionItem, ActionSpec } from './actions';
import { displayName, formatFullDate, formatListDate } from './format';
import styles from './ThreadRow.module.css';
import { AttachmentChips } from './attachments/AttachmentChips';
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
  // Label chips before the subject, like Gmail's "Inbox" in Starred.
  chips?: string[];
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
  chips = [],
}: ThreadRowProps) {
  const unread = thread.unreadCount > 0;
  const subject = thread.subject || '(no subject)';
  const stop = (handler: () => void) => (event: MouseEvent) => {
    event.stopPropagation();
    handler();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && event.target === event.currentTarget) onOpen(thread);
  };

  return (
    <div
      role="row"
      tabIndex={0}
      aria-selected={selected}
      aria-label={`${unread ? 'Unread, ' : ''}${displayName(thread.lastFrom)}, ${subject}`}
      className={[
        styles.row,
        thread.attachments.length > 0 ? styles.withFiles : '',
        unread ? styles.unread : styles.read,
        selected ? styles.selected : '',
      ].join(' ')}
      onClick={() => onOpen(thread)}
      onKeyDown={onKeyDown}
    >
      <button
        type="button"
        className={styles.check}
        role="checkbox"
        aria-checked={selected}
        aria-label="Select conversation"
        data-tooltip="Select"
        onClick={stop(() => onToggleSelect(thread))}
      >
        <Icon name={selected ? 'checkboxChecked' : 'checkbox'} size={20} />
      </button>
      <button
        type="button"
        className={`${styles.star} ${thread.isStarred ? styles.starred : ''}`}
        aria-pressed={thread.isStarred}
        aria-label={thread.isStarred ? 'Starred' : 'Not starred'}
        data-tooltip={thread.isStarred ? 'Starred' : 'Not starred'}
        onClick={stop(() => onToggleStar(thread))}
      >
        <Icon name={thread.isStarred ? 'starFilled' : 'star'} size={20} />
      </button>
      <span className={styles.sender}>
        {account && (
          <span
            className={styles.chip}
            role="img"
            aria-label={account.emailAddress}
            data-tooltip={account.emailAddress}
          >
            <ProviderLogo provider={account.provider} size={14} />
          </span>
        )}
        <span className={styles.senderName}>{displayName(thread.lastFrom)}</span>
        {thread.messageCount > 1 && <span className={styles.count}>{thread.messageCount}</span>}
      </span>
      <span className={styles.summary}>
        {chips.map((chip) => (
          <span key={chip} className={styles.label}>
            {chip}
          </span>
        ))}
        <span className={styles.subject}>{subject}</span>
        {thread.snippet && <span className={styles.snippet}> - {thread.snippet}</span>}
      </span>
      {thread.attachments.length > 0 && (
        <span className={styles.files}>
          <AttachmentChips files={thread.attachments} />
        </span>
      )}
      <span className={styles.end}>
        <span className={styles.date} data-tooltip={formatFullDate(thread.lastMessageAt)}>
          {formatListDate(thread.lastMessageAt)}
        </span>
        {onAction && (
          <span className={styles.hoverActions}>
            {thread.canUnsubscribe && (
              <UnsubscribeButton
                threadId={thread.id}
                sender={displayName(thread.lastFrom)}
                unsubscribed={!!thread.unsubscribedAt}
              />
            )}
            {[
              ...hoverActions,
              {
                id: 'read',
                label: unread ? 'Mark as read' : 'Mark as unread',
                icon: unread ? ('markRead' as const) : ('markUnread' as const),
                request: { action: unread ? ('read' as const) : ('unread' as const) },
              },
            ].map((item) => (
              <IconButton
                key={item.id}
                size="small"
                icon={item.icon}
                label={`${item.label}: ${subject}`}
                tooltip={item.label}
                onClick={stop(() => onAction(thread, item.request))}
              />
            ))}
          </span>
        )}
      </span>
    </div>
  );
}
