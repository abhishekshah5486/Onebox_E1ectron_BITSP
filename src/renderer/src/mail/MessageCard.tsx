import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Address, Message } from '../api/mail';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { AttachmentCards } from './attachments/AttachmentCards';
import { EmailFrame } from './EmailFrame';
import { displayName, formatFullDate, formatMessageDate } from './format';
import styles from './ThreadPage.module.css';

const full = (address: Address) =>
  address.name ? (
    <>
      <b>{address.name}</b> &lt;{address.address}&gt;
    </>
  ) : (
    address.address
  );

const join = (list: Address[]) =>
  list.map((address, i) => (
    <span key={address.address}>
      {i > 0 && ', '}
      {full(address)}
    </span>
  ));

// "to me", "to Ravi, me": the account's own address reads as "me", like Gmail.
function recipients(message: Message, me: string | null) {
  const names = [...message.to, ...message.cc].map((address) =>
    me && address.address === me.toLowerCase() ? 'me' : displayName(address),
  );
  return names.length ? `to ${names.join(', ')}` : 'to undisclosed recipients';
}

function Details({ message }: { message: Message }) {
  const auth = message.authentication;
  const rows: [string, ReactNode][] = [
    ['from', message.from ? full(message.from) : '(unknown sender)'],
    ...(message.replyTo.length ? [['reply-to', join(message.replyTo)] as [string, ReactNode]] : []),
    ['to', join(message.to)],
    ...(message.cc.length ? [['cc', join(message.cc)] as [string, ReactNode]] : []),
    [
      'date',
      new Date(message.receivedAt).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }),
    ],
    ['subject', message.subject || '(no subject)'],
    ...(auth?.mailedBy ? [['mailed-by', auth.mailedBy] as [string, ReactNode]] : []),
    ...(auth?.signedBy ? [['signed-by', auth.signedBy] as [string, ReactNode]] : []),
    ...(auth?.encrypted !== null && auth?.encrypted !== undefined
      ? [
          [
            'security',
            <span className={styles.security}>
              <Icon name="lock" size={16} />
              {auth.encrypted ? 'Standard encryption (TLS)' : 'Not encrypted in transit'}
            </span>,
          ] as [string, ReactNode],
        ]
      : []),
  ];
  return (
    <table className={styles.details}>
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label}>
            <th scope="row">{label}:</th>
            <td>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function MessageCard({
  message,
  defaultExpanded,
  me,
  starred,
  onToggleStar,
  unsubscribe,
}: {
  message: Message;
  defaultExpanded: boolean;
  // The account's own address, shown as "me".
  me: string | null;
  // Set on the latest message, which carries the conversation's star like Gmail.
  starred?: boolean;
  onToggleStar?: () => void;
  unsubscribe?: ReactNode;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showImages, setShowImages] = useState(false);
  const [details, setDetails] = useState(false);
  const detailsRef = useRef<HTMLDivElement>(null);
  const files = message.attachments
    .map((attachment, index) => ({ ...attachment, messageId: message.id, index }))
    .filter((attachment) => !attachment.inline);
  const sender = displayName(message.from);

  useEffect(() => {
    if (!details) return;
    const close = (event: MouseEvent) => {
      if (!detailsRef.current?.contains(event.target as Node)) setDetails(false);
    };
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && setDetails(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [details]);

  return (
    <article className={styles.message} aria-label={`Message from ${sender}`}>
      {/* Clicking anywhere in the header toggles; the sender name is the keyboard control. */}
      <div className={styles.header} onClick={() => setExpanded((value) => !value)}>
        <span className={styles.avatar} aria-hidden="true">
          {sender.charAt(0).toUpperCase()}
        </span>
        <div className={styles.who}>
          <div className={styles.fromLine}>
            <button
              type="button"
              className={styles.toggle}
              aria-expanded={expanded}
              onClick={(event) => {
                event.stopPropagation();
                setExpanded((value) => !value);
              }}
            >
              <span className={styles.from}>{sender}</span>
              {message.from && (
                <span className={styles.address}>&lt;{message.from.address}&gt;</span>
              )}
            </button>
            {expanded && unsubscribe && (
              <span onClick={(event) => event.stopPropagation()}>{unsubscribe}</span>
            )}
          </div>
          {expanded ? (
            <div
              ref={detailsRef}
              className={styles.toLine}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className={styles.toButton}
                aria-label="Show details"
                aria-expanded={details}
                data-tooltip="Show details"
                onClick={() => setDetails((value) => !value)}
              >
                {recipients(message, me)}
                <Icon name="caret" size={18} />
              </button>
              {details && (
                <div className={styles.popover} role="dialog" aria-label="Message details">
                  <Details message={message} />
                </div>
              )}
            </div>
          ) : (
            <div className={styles.snippet}>{message.snippet}</div>
          )}
        </div>
        <div className={styles.right} onClick={(event) => event.stopPropagation()}>
          <time
            className={styles.date}
            dateTime={message.receivedAt}
            data-tooltip={formatFullDate(message.receivedAt)}
          >
            {formatMessageDate(message.receivedAt)}
          </time>
          {onToggleStar && (
            <IconButton
              icon={starred ? 'starFilled' : 'star'}
              label={starred ? 'Starred' : 'Not starred'}
              size="small"
              className={starred ? styles.starred : undefined}
              onClick={onToggleStar}
            />
          )}
        </div>
      </div>

      {expanded && (
        <div className={styles.content}>
          {message.htmlBody ? (
            <>
              {message.hasRemoteImages && !showImages && (
                <div className={styles.banner} role="note">
                  Images in this message are hidden.
                  <button type="button" onClick={() => setShowImages(true)}>
                    Show images
                  </button>
                </div>
              )}
              <EmailFrame html={message.htmlBody} allowRemoteImages={showImages} />
            </>
          ) : (
            <pre className={styles.text}>{message.textBody}</pre>
          )}
          <AttachmentCards files={files} />
        </div>
      )}
    </article>
  );
}
