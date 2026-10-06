import { ButtonLink } from '../ui/Button';
import { Icon } from '../ui/Icon';
import styles from './MailboxPage.module.css';

export function MailboxPage({ folder }: { folder: string }) {
  return (
    <section className={styles.panel} aria-label={folder}>
      <div className={styles.toolbar} role="toolbar" aria-label="Mail actions">
        <button aria-label="Select all">
          <Icon name="checkbox" size={20} />
        </button>
        <button aria-label="Refresh">
          <Icon name="refresh" size={20} />
        </button>
        <button aria-label="More">
          <Icon name="more" size={20} />
        </button>
        <span className={styles.count}>0 of 0</span>
      </div>
      <div className={styles.empty}>
        <Icon name="mail" size={64} />
        <h2>{folder === 'Inbox' ? 'Your inbox is empty' : `No conversations in ${folder}`}</h2>
        <p>Connect a Gmail, Outlook or IMAP account and new mail will show up here in real time.</p>
        <ButtonLink to="/settings">Connect an account</ButtonLink>
      </div>
    </section>
  );
}
