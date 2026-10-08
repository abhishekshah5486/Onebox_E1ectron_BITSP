import Alert from '@cloudscape-design/components/alert';
import Icon from '@cloudscape-design/components/icon';
import Button from '@cloudscape-design/components/button';
import Popover from '@cloudscape-design/components/popover';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Spinner from '@cloudscape-design/components/spinner';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { Address, Message } from '../api/mail';
import { useAccountFolders, useThread, useUpdateThread } from '../api/mail-queries';
import { describeError } from '../auth/errors';
import { AttachmentCards } from '../mail/attachments/AttachmentCards';
import { EmailFrame } from '../mail/EmailFrame';
import type { ActionSpec } from '../mail/actions';
import { viewFromPath } from '../mail/folders';
import { useMailAction } from '../mail/useMailAction';
import { useFlash } from '../settings/flash';
import { displayName, formatMessageDate, formatUtc } from '../mail/format';
import { ConsoleActions } from './ConsoleActions';
import styles from './ConsoleThread.module.css';
import { useUnsubscribeFlow } from './UnsubscribeFlow';

const full = (address: Address) =>
  address.name ? `${address.name} <${address.address}>` : address.address;
const names = (list: Address[]) => list.map(displayName).join(', ');

function Details({ message }: { message: Message }) {
  const rows: [string, string][] = [
    ['from', message.from ? full(message.from) : '(unknown sender)'],
    ...(message.replyTo.length
      ? [['reply-to', message.replyTo.map(full).join(', ')] as [string, string]]
      : []),
    ['to', message.to.map(full).join(', ') || 'undisclosed recipients'],
    ...(message.cc.length ? [['cc', message.cc.map(full).join(', ')] as [string, string]] : []),
    ['date', `${new Date(message.receivedAt).toLocaleString()} (${formatUtc(message.receivedAt)})`],
    ['subject', message.subject || '(no subject)'],
  ];
  return (
    <dl className={styles.details}>
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}:</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ThreadMessage({
  message,
  defaultExpanded,
}: {
  message: Message;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showImages, setShowImages] = useState(false);
  const files = message.attachments
    .map((attachment, index) => ({ ...attachment, messageId: message.id, index }))
    .filter((attachment) => !attachment.inline);
  const sender = displayName(message.from);

  return (
    <article className={styles.message} aria-label={`Message from ${sender}`}>
      {/* Clicking anywhere in the header toggles; the sender line is the keyboard-reachable control. */}
      <header className={styles.header} onClick={() => setExpanded((value) => !value)}>
        <span className={styles.avatar} aria-hidden="true">
          {sender.charAt(0).toUpperCase()}
        </span>
        <div className={styles.who}>
          <button
            type="button"
            className={styles.toggle}
            aria-expanded={expanded}
            onClick={(event) => {
              event.stopPropagation();
              setExpanded((value) => !value);
            }}
          >
            <span className={styles.sender}>{sender}</span>
            {message.from && (
              <span className={styles.address}> &lt;{message.from.address}&gt;</span>
            )}
          </button>
          {expanded ? (
            // Opening the details must not also collapse the message.
            <div className={styles.to} onClick={(event) => event.stopPropagation()}>
              to {names(message.to) || 'undisclosed recipients'}
              <Popover
                triggerType="custom"
                size="large"
                position="bottom"
                dismissAriaLabel="Close details"
                content={<Details message={message} />}
              >
                <Button
                  variant="inline-icon"
                  iconName="caret-down-filled"
                  ariaLabel="Show details"
                />
              </Popover>
            </div>
          ) : (
            <div className={styles.snippet}>{message.snippet}</div>
          )}
        </div>
        <time
          className={styles.date}
          dateTime={message.receivedAt}
          title={formatUtc(message.receivedAt)}
        >
          {formatMessageDate(message.receivedAt)}
        </time>
      </header>

      {expanded && (
        <div className={styles.body}>
          {message.htmlBody ? (
            <>
              {message.hasRemoteImages && !showImages && (
                // Styled by hand: the pane is white in both themes, Cloudscape alerts are not.
                <div className={styles.notice} role="note">
                  <span className={styles.noticeText}>
                    <Icon name="status-info" variant="link" />
                    Images are hidden to protect your privacy.
                  </span>
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

// A fixed-height reading pane like Gmail's: the toolbar stays put and only the mail scrolls.
export function ConsoleThread({ basePath }: { basePath: string }) {
  const { threadId = '' } = useParams();
  const navigate = useNavigate();
  const query = useThread(threadId);
  const update = useUpdateThread();
  const act = useMailAction();
  const flash = useFlash();
  const unsubscribe = useUnsubscribeFlow();
  const markedRead = useRef(false);
  const thread = query.data?.thread;
  const view = viewFromPath(basePath);
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
    act([thread.id], request);
    back();
  };

  return (
    <section className={styles.reader} aria-label="Conversation">
      <div className={styles.toolbar} role="toolbar" aria-label="Conversation actions">
        <SpaceBetween direction="horizontal" size="xs">
          <Button iconName="arrow-left" onClick={back}>
            Back
          </Button>
          {/* Separate children, not a fragment, so SpaceBetween spaces each button. */}
          {thread && (
            <ConsoleActions
              view={view}
              folders={folders}
              selected={[thread]}
              onAction={run}
              extraFlags={false}
            />
          )}
          {thread && (
            <Button
              onClick={() => {
                update.mutate(
                  { id: thread.id, isRead: false },
                  {
                    onSuccess: () =>
                      flash({ type: 'success', content: 'Conversation marked as unread.' }),
                    onError: (error) => flash({ type: 'error', content: describeError(error) }),
                  },
                );
                back();
              }}
            >
              Mark as unread
            </Button>
          )}
          {thread && (
            <Button
              iconName={thread.isStarred ? 'star-filled' : 'star'}
              onClick={() =>
                update.mutate(
                  { id: thread.id, isStarred: !thread.isStarred },
                  {
                    onSuccess: () =>
                      flash({
                        type: 'success',
                        content: `Conversation ${thread.isStarred ? 'unstarred' : 'starred'}.`,
                      }),
                    onError: (error) => flash({ type: 'error', content: describeError(error) }),
                  },
                )
              }
            >
              {thread.isStarred ? 'Unstar' : 'Star'}
            </Button>
          )}
        </SpaceBetween>
        {query.data && (
          <span className={styles.count}>
            {query.data.messages.length} {query.data.messages.length === 1 ? 'message' : 'messages'}
          </span>
        )}
      </div>

      {unsubscribe.modal}
      <div className={styles.pane}>
        {query.isPending && <Spinner size="large" />}
        {query.isError && <Alert type="error">{describeError(query.error)}</Alert>}
        {query.data && (
          <>
            <div className={styles.subjectRow}>
              <h1 className={styles.subject}>{query.data.thread.subject || '(no subject)'}</h1>
              {query.data.thread.canUnsubscribe &&
                (query.data.thread.unsubscribedAt ? (
                  <span className={styles.unsubscribed}>Unsubscribed</span>
                ) : (
                  // Styled by hand: the pane is white in both themes, Cloudscape buttons are not.
                  <button
                    type="button"
                    className={styles.unsubscribe}
                    disabled={unsubscribe.pending}
                    onClick={() => unsubscribe.ask(query.data.thread)}
                  >
                    Unsubscribe
                  </button>
                ))}
            </div>
            {query.data.messages.map((message, index, all) => (
              <ThreadMessage
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
