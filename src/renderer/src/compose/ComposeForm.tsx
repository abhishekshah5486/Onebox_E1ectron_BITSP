import { lazy, Suspense, useRef, useState, type Ref } from 'react';
import { composeApi } from '../api/compose';
import { useAccounts, usePreferences } from '../api/queries';
import { useAuth } from '../auth/AuthProvider';
import { saveBlob } from '../mail/attachments/useAttachment';
import { Icon, type IconName } from '../ui/Icon';
import styles from './ComposeForm.module.css';
import { gmailSize, recipientLabel, signatureHtml } from './model';
import { Floating } from './Floating';
import { LargeFilesDialog } from './LargeFilesDialog';
import { RecipientField } from './RecipientField';
import { RichEditor, type EditorHandle } from './RichEditor';
import type { CompositionState } from './useComposition';

const EmojiPanel = lazy(() => import('./EmojiPanel'));

function FooterButton({
  icon,
  label,
  pressed,
  onClick,
  ref,
  ...rest
}: {
  icon: IconName;
  label: string;
  pressed?: boolean;
  onClick: () => void;
  'aria-expanded'?: boolean;
  // Marks the button that opens and closes the link card.
  'data-link-toggle'?: boolean;
  ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={ref}
      type="button"
      className={styles.footerButton}
      aria-label={label}
      data-tooltip={label}
      {...(pressed !== undefined && { 'aria-pressed': pressed })}
      // Keeps the editor's caret where it was.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      {...rest}
    >
      <Icon name={icon} size={20} />
    </button>
  );
}

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
  const { api } = useAuth();
  const accounts = useAccounts();
  const preferences = usePreferences();
  const editor = useRef<EditorHandle>(null);
  const files = useRef<HTMLInputElement>(null);
  const recipientsBox = useRef<HTMLDivElement>(null);
  // A new message starts with the To line open; a reply shows who it goes to in one line.
  const [recipientsOpen, setRecipientsOpen] = useState(
    !composition.replyTo && composition.to.length === 0,
  );
  const [showCc, setShowCc] = useState(composition.cc.length > 0);
  const [showBcc, setShowBcc] = useState(composition.bcc.length > 0);
  const [formatting, setFormatting] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const emojiButton = useRef<HTMLButtonElement>(null);
  const senders = accounts.data ?? [];
  const sender = senders.find((account) => account.id === composition.accountId);
  const everyone = [...composition.to, ...composition.cc, ...composition.bcc];
  const signature = preferences.data?.signature;

  const send = async () => {
    if (await state.send()) onDone();
  };

  // Cc and Bcc links sit on the last recipients line, until each is opened.
  const links = (
    <span className={styles.copyLinks}>
      {!showCc && (
        <button type="button" onClick={() => setShowCc(true)}>
          Cc
        </button>
      )}
      {!showBcc && (
        <button type="button" onClick={() => setShowBcc(true)}>
          Bcc
        </button>
      )}
    </span>
  );
  const lastRow = showBcc ? 'bcc' : showCc ? 'cc' : 'to';

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
      <div
        ref={recipientsBox}
        className={styles.recipients}
        onBlur={(event) => {
          // Folds back into one line once focus leaves the recipients altogether.
          const next = event.relatedTarget as Node | null;
          if (!recipientsBox.current?.contains(next) && everyone.length) setRecipientsOpen(false);
        }}
      >
        {recipientsOpen ? (
          <>
            {senders.length > 1 && (
              <label className={styles.from}>
                <span className={styles.label}>From</span>
                <span className={styles.fromValue}>
                  <select
                    aria-label="From"
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
                  <Icon name="caret" size={20} />
                </span>
              </label>
            )}
            <RecipientField
              label="To"
              value={composition.to}
              onChange={(to) => update({ to })}
              autoFocus
              trailing={lastRow === 'to' && links}
            />
            {showCc && (
              <RecipientField
                label="Cc"
                value={composition.cc}
                onChange={(cc) => update({ cc })}
                autoFocus={composition.cc.length === 0}
                trailing={lastRow === 'cc' && links}
              />
            )}
            {showBcc && (
              <RecipientField
                label="Bcc"
                value={composition.bcc}
                onChange={(bcc) => update({ bcc })}
                autoFocus={composition.bcc.length === 0}
              />
            )}
          </>
        ) : (
          <button
            type="button"
            className={`${styles.summary} ${everyone.length ? '' : styles.placeholder}`}
            onClick={() => setRecipientsOpen(true)}
          >
            <span className={styles.summaryText}>
              {everyone.length ? everyone.map(recipientLabel).join(', ') : 'Recipients'}
            </span>
            {sender && senders.length > 1 && <small>from {sender.emailAddress}</small>}
          </button>
        )}
      </div>
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
        ref={editor}
        initialHtml={composition.html}
        onChange={(html, text) => update({ html, text })}
        showToolbar={formatting}
        placeholder=""
        autoFocus={
          composition.replyTo?.mode === 'reply' || composition.replyTo?.mode === 'replyAll'
        }
        attachments={
          (composition.attachments.length > 0 || state.uploads.length > 0) && (
            <ul className={styles.attachments} aria-label="Attachments">
              {composition.attachments.map((attachment) => (
                <li key={attachment.blobKey}>
                  <button
                    type="button"
                    className={styles.name}
                    title={`Download ${attachment.filename}`}
                    onClick={() =>
                      void composeApi
                        .downloadAttachment(api, attachment)
                        .then((blob) => saveBlob(blob, attachment.filename))
                        .catch(() => undefined)
                    }
                  >
                    {attachment.filename}
                  </button>
                  <span className={styles.size}>({gmailSize(attachment.sizeBytes)})</span>
                  <button
                    type="button"
                    aria-label={`Remove ${attachment.filename}`}
                    onClick={() => state.removeAttachment(attachment.blobKey)}
                  >
                    <Icon name="close" size={16} />
                  </button>
                </li>
              ))}
              {state.uploads.map((upload) => (
                <li key={upload.id}>
                  <span className={styles.uploadingName}>{upload.filename}</span>
                  <span className={styles.size}>({gmailSize(upload.sizeBytes)})</span>
                  <span
                    className={styles.progress}
                    role="progressbar"
                    aria-label={`Uploading ${upload.filename}`}
                    aria-valuenow={Math.round(upload.progress * 100)}
                  >
                    <span style={{ width: `${Math.round(upload.progress * 100)}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          )
        }
      />

      {state.tooLarge.length > 0 && (
        <LargeFilesDialog
          files={state.tooLarge}
          onCancel={state.keepSmallOnly}
          onConfirm={(accountId) =>
            void state.shareTooLarge(accountId, (html) => editor.current?.insertHtml(html))
          }
        />
      )}

      <div className={styles.footer}>
        <span className={styles.sendGroup}>
          <button type="submit" className={styles.send} disabled={state.sending}>
            {state.sending ? 'Sending…' : 'Send'}
          </button>
          {/* Schedule send lives here; it's switched off for now. */}
          <button
            type="button"
            className={styles.sendMore}
            aria-label="More send options"
            data-tooltip="Scheduled sending is coming soon"
            aria-disabled="true"
          >
            <Icon name="caret" size={20} />
          </button>
        </span>
        <FooterButton
          icon="formatText"
          label="Formatting options"
          pressed={formatting}
          onClick={() => setFormatting((value) => !value)}
        />
        <FooterButton
          icon="attachment"
          label="Attach files"
          onClick={() => files.current?.click()}
        />
        <FooterButton
          icon="link"
          label="Insert link"
          data-link-toggle
          onClick={() => editor.current?.toggleLink()}
        />
        <FooterButton
          ref={emojiButton}
          icon="emoji"
          label="Insert emoji"
          pressed={emojiOpen}
          onClick={() => setEmojiOpen((value) => !value)}
        />
        {emojiOpen && (
          <Floating
            anchor={emojiButton}
            label="Insert emoji"
            className={styles.emoji}
            onClose={() => setEmojiOpen(false)}
          >
            <Suspense fallback={<span className={styles.emojiLoading}>Loading emoji…</span>}>
              <EmojiPanel onPick={(emoji) => editor.current?.insertText(emoji)} />
            </Suspense>
          </Floating>
        )}
        {signature && (
          <FooterButton
            icon="signature"
            label="Insert signature"
            onClick={() => editor.current?.insertHtml(signatureHtml(signature))}
          />
        )}
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
        <FooterButton
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
