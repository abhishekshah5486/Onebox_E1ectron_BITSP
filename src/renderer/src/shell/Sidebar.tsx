import { NavLink } from 'react-router';
import { accountColor, accountLabel } from '../accounts/account-color';
import { ProviderLogo } from '../accounts/ProviderLogo';
import { useMailboxSummaries } from '../api/mail-queries';
import { useAccounts } from '../api/queries';
import { Icon } from '../ui/Icon';
import styles from './Sidebar.module.css';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `${styles.item} ${isActive ? styles.active : ''}`;

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const accounts = useAccounts();
  const list = accounts.data ?? [];
  const summaries = useMailboxSummaries(list.map((account) => account.id));
  // Unread counts come from the mail servers themselves, not just what OneBox has fetched.
  const unreadById = new Map(
    list.map((account, i) => [account.id, summaries[i]?.data?.server?.unread ?? 0]),
  );
  const totalUnread = [...unreadById.values()].reduce((sum, n) => sum + n, 0);

  const badge = (count: number, label: string) =>
    !collapsed && count > 0 ? (
      <span className={styles.badge} aria-label={`${count} unread in ${label}`}>
        {count.toLocaleString()}
      </span>
    ) : null;

  return (
    <nav
      className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}
      aria-label="Mailboxes"
    >
      <button className={styles.compose} aria-label="Compose">
        <Icon name="edit" size={24} />
        {!collapsed && 'Compose'}
      </button>
      <div className={styles.nav}>
        <NavLink to="/inbox" title="All inboxes" className={navClass}>
          <Icon name="inbox" size={20} />
          {!collapsed && 'All inboxes'}
          {badge(totalUnread, 'all inboxes')}
        </NavLink>
        <NavLink to="/starred" title="Starred" className={navClass}>
          <Icon name="star" size={20} />
          {!collapsed && 'Starred'}
        </NavLink>
      </div>

      {list.length > 0 && !collapsed && <p className={styles.section}>Accounts</p>}
      <div className={styles.nav}>
        {list.map((account) => (
          <NavLink
            key={account.id}
            to={`/accounts/${account.id}`}
            title={accountLabel(account)}
            className={navClass}
          >
            <span className={styles.logo}>
              <ProviderLogo provider={account.provider} size={18} />
              <span className={styles.dot} style={{ background: accountColor(account.id) }} />
            </span>
            {!collapsed && <span className={styles.label}>{accountLabel(account)}</span>}
            {account.status !== 'CONNECTED'
              ? !collapsed && (
                  <span
                    className={styles.warn}
                    aria-label="Needs attention"
                    title="Needs attention"
                  >
                    !
                  </span>
                )
              : badge(unreadById.get(account.id) ?? 0, accountLabel(account))}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
