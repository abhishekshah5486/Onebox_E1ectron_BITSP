import { useRef, useState } from 'react';
import { useAccounts } from '../api/queries';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { formatBytes } from '../mail/format';
import styles from './ComposeForm.module.css';
import { RecipientField } from './RecipientField';
import { RichEditor } from './RichEditor';
import type { CompositionState } from './useComposition';

// The body of a v1 compose window or inline reply: Gmail's fields, editor and footer.
export function ComposeForm({
  state,
  inline = false,
  onDone,
}: {
  state: CompositionState;
  // An inline reply hides the subject (it follows the conversation).
  inline?: boolean;
  // After sending or discarding.
  onDone: () => void;
}) {
  const { composition, update } = state;
  const accounts = useAccounts();
  const [copies, setCopies] = useState(composition.cc.length > 0 || composition.bcc.length > 0);
  const [formatting, setFormatting] = useState(true);
  const [dragging, setDragging] = useState(false);
  const files = useRef<HTMLInputElement>(null);
  const senders = accounts.data ?? [];

  const send = async () => {
    if (await state.send()) onDone();
  };

  return (
    <form
      className={`${styles.form} ${dragging ? styles.dragging : ''}`}
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
      onKeyDown={(event) => {
        // Ctrl/Cmd+Enter sends, as in Gmail.
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          void send();
        }
      }}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('Files')) {
          event.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        if (!event.dataTransfer.files.length) return;
        event.preventDefault();
        setDragging(false);
        void state.addFiles([...event.dataTransfer.files]);
      }}
    >
      {senders.length > 1 && (
        <label className={styles.from}>
          <span>From</span>
          <select
            value={composition.accountId ?? ''}
            onChange={(event) => update({ accountId: event.target.value })}
          >
            {senders.map((account) => (
              <option key={account.id} value={account.id}>
                {account.displayName
                  ? `${account.displayName} <${account.emailAddress}>`
                  : account.emailAddress}
              </option>
            ))}
          </select>
        </label>
      )}
      <RecipientField
        label="To"
        value={composition.to}
        onChange={(to) => update({ to })}
        autoFocus={composition.to.length === 0 && composition.replyTo?.mode !== 'reply'}
        trailing={
          !copies && (
            <button type="button" className={styles.link} onClick={() => setCopies(true)}>
              Cc Bcc
            </button>
          )
        }
      />
      {copies && (
        <>
          <RecipientField label="Cc" value={composition.cc} onChange={(cc) => update({ cc })} />
          <RecipientField label="Bcc" value={composition.bcc} onChange={(bcc) => update({ bcc })} />
        </>
      )}
      {!inline && (
        <input
          className={styles.subject}
          aria-label="Subject"
          placeholder="Subject"
          value={composition.subject}
          onChange={(event) => update({ subject: event.target.value })}
        />
      )}

      <RichEditor
        initialHtml={composition.html}
        onChange={(html, text) => update({ html, text })}
        showToolbar={formatting}
        autoFocus={
          composition.replyTo?.mode === 'reply' || composition.replyTo?.mode === 'replyAll'
        }
      />

      {(composition.attachments.length > 0 || state.uploads.length > 0) && (
        <ul className={styles.attachments} aria-label="Attachments">
          {composition.attachments.map((attachment) => (
            <li key={attachment.blobKey}>
              <Icon name="attachment" size={16} />
              <span className={styles.name}>{attachment.filename}</span>
              <small>{formatBytes(attachment.sizeBytes)}</small>
              <IconButton
                icon="close"
                label={`Remove ${attachment.filename}`}
                onClick={() => state.removeAttachment(attachment.blobKey)}
              />
            </li>
          ))}
          {state.uploads.map((upload) => (
            <li key={upload.id} className={styles.uploading}>
              <span className={styles.spinner} aria-hidden="true" />
              <span className={styles.name}>{upload.filename}</span>
              <small>Uploading…</small>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.footer}>
        <button type="submit" className={styles.send} disabled={state.sending}>
          {state.sending ? 'Sending…' : 'Send'}
        </button>
        <IconButton
          icon="formatText"
          label={formatting ? 'Hide formatting options' : 'Formatting options'}
          aria-pressed={formatting}
          onClick={() => setFormatting((value) => !value)}
        />
        <IconButton icon="attachment" label="Attach files" onClick={() => files.current?.click()} />
        <input
          ref={files}
          type="file"
          multiple
          hidden
          aria-label="Files to attach"
          onChange={(event) => {
            void state.addFiles([...(event.target.files ?? [])]);
            event.target.value = '';
          }}
        />
        <span className={styles.status} aria-live="polite">
          {state.saveState === 'saving'
            ? 'Saving…'
            : state.saveState === 'saved'
              ? 'Draft saved'
              : state.saveState === 'error'
                ? "Couldn't save draft"
                : ''}
        </span>
        <IconButton
          icon="delete"
          label="Discard draft"
          onClick={() => {
            void state.discard();
            onDone();
          }}
        />
      </div>
    </form>
  );
}
