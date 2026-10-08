import { useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import { ProviderLogo } from '../accounts/ProviderLogo';
import type { Account } from '../api/accounts';
import type { FolderCounts } from '../api/mail';
import { useAccountFolders } from '../api/mail-queries';
import { useAccounts } from '../api/queries';
import {
  FOLDER_ICON,
  FOLDER_LABEL,
  FOLDER_ORDER,
  folderBadge,
  folderName,
  labelPath,
  type FolderRole,
} from '../mail/folders';
import { Icon } from '../ui/Icon';
import styles from './Sidebar.module.css';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `${styles.item} ${isActive ? styles.active : ''}`;

type Badge = (count: number, label: string) => React.ReactNode;

// Drafts are badged by how many exist, every other folder by unread mail.
const badgeLabel = (role: FolderRole, count: number, where: string) =>
  role === 'drafts' ? `${count} drafts in ${where}` : `${count} unread in ${where}`;

function AccountItem({
  account,
  folders,
  collapsed,
  badge,
}: {
  account: Account;
  folders: FolderCounts[];
  collapsed: boolean;
  badge: Badge;
}) {
  const { pathname } = useLocation();
  const base = `/accounts/${account.id}`;
  const [open, setOpen] = useState<boolean | null>(null);
  // Expanded while one of its folders is open, until the user toggles it themselves.
  const expanded = open ?? pathname.startsWith(`${base}/`);
  const byRole = new Map(
    folders.flatMap((folder) => (folder.role === 'label' ? [] : [[folder.role, folder] as const])),
  );
  const labels = folders.filter((folder) => folder.role === 'label');
  const roles = FOLDER_ORDER.filter((role) => role === 'inbox' || byRole.has(role));
  const countOf = (role: FolderRole) => {
    const counts = byRole.get(role);
    return counts ? folderBadge(role, counts) : 0;
  };

  return (
    <>
      <div className={styles.accountRow}>
        {!collapsed && (
          <button
            className={`${styles.toggle} ${expanded ? styles.open : ''}`}
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Hide' : 'Show'} folders for ${account.emailAddress}`}
            onClick={() => setOpen(!expanded)}
          >
            <Icon name="chevron" size={18} />
          </button>
        )}
        <NavLink
          to={`${base}/inbox`}
          end
          title={
            account.displayName
              ? `${account.emailAddress} · ${account.displayName}`
              : account.emailAddress
          }
          className={navClass}
        >
          <span className={styles.logo}>
            <ProviderLogo provider={account.provider} size={18} />
          </span>
          {!collapsed && <span className={styles.label}>{account.emailAddress}</span>}
          {account.status !== 'CONNECTED'
            ? !collapsed && (
                <span className={styles.warn} aria-label="Needs attention" title="Needs attention">
                  !
                </span>
              )
            : badge(countOf('inbox'), badgeLabel('inbox', countOf('inbox'), account.emailAddress))}
        </NavLink>
      </div>
      {expanded && !collapsed && (
        <div className={styles.folders} role="group" aria-label={`${account.emailAddress} folders`}>
          {roles.map((role) => (
            <NavLink key={role} to={`${base}/${role}`} className={navClass}>
              <Icon name={FOLDER_ICON[role]} size={18} />
              {folderName(role, byRole.get(role)?.name)}
              {badge(
                countOf(role),
                badgeLabel(role, countOf(role), `${account.emailAddress} ${FOLDER_LABEL[role]}`),
              )}
            </NavLink>
          ))}
          {labels.length > 0 && <p className={styles.labelsHeading}>Labels</p>}
          {labels.map((label) => (
            <NavLink
              key={label.path}
              to={labelPath(account.id, label.path)}
              className={navClass}
              title={label.name}
            >
              <Icon name="label" size={18} />
              <span className={styles.label}>{label.name}</span>
              {badge(label.unread, `${label.unread} unread in ${label.name}`)}
            </NavLink>
          ))}
        </div>
      )}
    </>
  );
}

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const accounts = useAccounts();
  const list = accounts.data ?? [];
  // Counts come from the mail servers themselves, not just what OneBox has fetched.
  const folderQueries = useAccountFolders(list.map((account) => account.id));
  const foldersOf = (i: number) => folderQueries[i]?.data?.items ?? [];
  const unifiedBadge = (role: FolderRole) =>
    list.reduce(
      (sum, _, i) =>
        sum + foldersOf(i).reduce((n, f) => n + (f.role === role ? folderBadge(role, f) : 0), 0),
      0,
    );

  const badge: Badge = (count, label) =>
    !collapsed && count > 0 ? (
      <span className={styles.badge} aria-label={label}>
        {count.toLocaleString()}
      </span>
    ) : null;

  const unified: {
    to: string;
    label: string;
    icon: React.ComponentProps<typeof Icon>['name'];
    role?: FolderRole;
  }[] = [
    { to: '/inbox', label: 'All inboxes', icon: 'inbox', role: 'inbox' },
    { to: '/starred', label: 'Starred', icon: 'star' },
    ...(['sent', 'drafts', 'archive', 'spam', 'trash'] as const).map((role) => ({
      to: `/${role}`,
      label: FOLDER_LABEL[role],
      icon: FOLDER_ICON[role],
      role,
    })),
  ];

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
        {unified.map((item) => (
          <NavLink key={item.to} to={item.to} title={item.label} className={navClass}>
            <Icon name={item.icon} size={20} />
            {!collapsed && item.label}
            {item.role &&
              badge(
                unifiedBadge(item.role),
                badgeLabel(item.role, unifiedBadge(item.role), item.label.toLowerCase()),
              )}
          </NavLink>
        ))}
      </div>

      {list.length > 0 && !collapsed && <p className={styles.section}>Accounts</p>}
      <div className={styles.nav}>
        {list.map((account, i) => (
          <AccountItem
            key={account.id}
            account={account}
            folders={foldersOf(i)}
            collapsed={collapsed}
            badge={badge}
          />
        ))}
      </div>
    </nav>
  );
}
