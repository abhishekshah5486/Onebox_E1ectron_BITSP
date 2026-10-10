import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAccounts, usePreferences } from '../api/queries';
import { formatBytes } from '../mail/format';
import { Icon, type IconName } from '../ui/Icon';
import styles from './ComposeForm.module.css';
import { recipientLabel, signatureHtml } from './model';
import { LargeFilesDialog } from './LargeFilesDialog';
import { RecipientField } from './RecipientField';
import { RichEditor, type EditorHandle } from './RichEditor';
import type { CompositionState } from './useComposition';

const EmojiPanel = lazy(() => import('./EmojiPanel'));

// Gmail's quick choices for a scheduled send, worked out from now.
function scheduleOptions(now = new Date()) {
  const at = (days: number, hour: number) => {
    const date = new Date(now);
    date.setDate(date.getDate() + days);
    date.setHours(hour, 0, 0, 0);
    return date;
  };
  const toMonday = (8 - now.getDay()) % 7 || 7;
  const label = (date: Date) =>
    date.toLocaleString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });
  return [
    { label: 'Tomorrow morning', at: at(1, 8) },
    { label: 'Tomorrow afternoon', at: at(1, 13) },
    { label: 'Monday morning', at: at(toMonday, 8) },
  ].map((option) => ({ ...option, when: label(option.at) }));
}

// A footer button with a popup above it (emoji, schedule send).
function Popup({
  label,
  trigger,
  className,
  children,
}: {
  label: string;
  trigger: (props: { onClick: () => void; 'aria-expanded': boolean }) => ReactNode;
  className: string | undefined;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <span ref={root} className={styles.popupRoot}>
      {trigger({ onClick: () => setOpen((value) => !value), 'aria-expanded': open })}
      {open && (
        <div className={className} role="menu" aria-label={label}>
          {children(() => setOpen(false))}
        </div>
      )}
    </span>
  );
}

function FooterButton({
  icon,
  label,
  pressed,
  onClick,
  ...rest
}: {
  icon: IconName;
  label: string;
  pressed?: boolean;
  onClick: () => void;
  'aria-expanded'?: boolean;
}) {
  return (
    <button
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
  const senders = accounts.data ?? [];
  const sender = senders.find((account) => account.id === composition.accountId);
  const everyone = [...composition.to, ...composition.cc, ...composition.bcc];
  const signature = preferences.data?.signature;

  const send = async (sendAt?: Date) => {
    if (await state.send(sendAt)) onDone();
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
            {everyone.length ? everyone.map(recipientLabel).join(', ') : 'Recipients'}
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
      />

      {(composition.attachments.length > 0 || state.uploads.length > 0) && (
        <ul className={styles.attachments} aria-label="Attachments">
          {composition.attachments.map((attachment) => (
            <li key={attachment.blobKey}>
              <span className={styles.name}>{attachment.filename}</span>
              <small>({formatBytes(attachment.sizeBytes)})</small>
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
              <span className={styles.name}>{upload.filename}</span>
              <small>({formatBytes(upload.sizeBytes)})</small>
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
      )}

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
          <Popup
            label="Schedule send"
            className={styles.schedule}
            trigger={(props) => (
              <button
                type="button"
                className={styles.sendMore}
                aria-label="More send options"
                aria-haspopup="menu"
                disabled={state.sending}
                {...props}
              >
                <Icon name="caret" size={20} />
              </button>
            )}
          >
            {(close) => (
              <>
                <p>Schedule send</p>
                {scheduleOptions().map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      close();
                      void send(option.at);
                    }}
                  >
                    <span>{option.label}</span>
                    <small>{option.when}</small>
                  </button>
                ))}
              </>
            )}
          </Popup>
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
        <FooterButton icon="link" label="Insert link" onClick={() => editor.current?.startLink()} />
        <Popup
          label="Insert emoji"
          className={styles.emoji}
          trigger={(props) => <FooterButton icon="emoji" label="Insert emoji" {...props} />}
        >
          {(close) => (
            <Suspense fallback={<span className={styles.emojiLoading}>Loading emoji…</span>}>
              <EmojiPanel
                onPick={(emoji) => {
                  editor.current?.insertText(emoji);
                  close();
                }}
              />
            </Suspense>
          )}
        </Popup>
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
