import { useState } from 'react';
import type { Address, Message } from '../api/mail';
import { Icon } from '../ui/Icon';
import { EmailFrame } from './EmailFrame';
import { displayName, formatBytes } from './format';
import styles from './ThreadPage.module.css';

const recipients = (list: Address[]) => list.map(displayName).join(', ');

export function MessageCard({
  message,
  defaultExpanded,
}: {
  message: Message;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showImages, setShowImages] = useState(false);
  const files = message.attachments.filter((attachment) => !attachment.inline);

  return (
    <article className={styles.message} aria-label={`Message from ${displayName(message.from)}`}>
      <div
        className={styles.header}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        onKeyDown={(event) => event.key === 'Enter' && setExpanded((value) => !value)}
      >
        <span className={styles.avatar} aria-hidden="true">
          {displayName(message.from).charAt(0).toUpperCase()}
        </span>
        <div>
          <span className={styles.from}>{displayName(message.from)}</span>
          {message.from && <span className={styles.address}>&lt;{message.from.address}&gt;</span>}
          <div className={expanded ? styles.meta : styles.collapsedSnippet}>
            {expanded
              ? `to ${recipients(message.to) || 'undisclosed recipients'}`
              : message.snippet}
          </div>
        </div>
        <span className={styles.meta}>{new Date(message.receivedAt).toLocaleString()}</span>
      </div>

      {expanded && (
        <div className={styles.content}>
          {message.htmlBody ? (
            <>
              {message.hasRemoteImages && !showImages && (
                <div className={styles.banner} role="note">
                  Images are hidden to protect your privacy.
                  <button onClick={() => setShowImages(true)}>Show images</button>
                </div>
              )}
              <EmailFrame html={message.htmlBody} allowRemoteImages={showImages} />
            </>
          ) : (
            <pre className={styles.text}>{message.textBody}</pre>
          )}
          {files.length > 0 && (
            <div className={styles.attachments} aria-label="Attachments">
              {files.map((file) => (
                <span key={file.filename} className={styles.attachment}>
                  <Icon name="draft" size={16} />
                  {file.filename} · {formatBytes(file.sizeBytes)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
