import { useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import { ProviderLogo } from '../accounts/ProviderLogo';
import type { Account } from '../api/accounts';
import type { FolderCounts } from '../api/mail';
import { useAccountFolders } from '../api/mail-queries';
import { useSuggestionCount } from '../api/ai';
import { useAccounts, usePreferences } from '../api/queries';
import {
  FOLDER_ICON,
  FOLDER_LABEL,
  FOLDER_ORDER,
  categoryKey,
  DEFAULT_SIDEBAR_HIDDEN,
  folderBadge,
  folderName,
  labelKey,
  labelPath,
  MAIL_CATEGORIES,
  MAIL_CATEGORY_LABEL,
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
  const hidden = new Set(usePreferences().data?.sidebarHidden ?? DEFAULT_SIDEBAR_HIDDEN);
  const labels = folders.filter(
    (folder) => folder.role === 'label' && !hidden.has(labelKey(account.id, folder.path)),
  );
  const roles = FOLDER_ORDER.filter(
    (role) => role === 'inbox' || (byRole.has(role) && !hidden.has(role)),
  );
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
          data-tooltip={account.emailAddress}
          // Open, its folders carry the highlight; closed, the account row does.
          className={() =>
            `${styles.item} ${!expanded && pathname.startsWith(`${base}/`) ? styles.active : ''}`
          }
        >
          <span className={styles.logo}>
            <ProviderLogo provider={account.provider} size={18} />
          </span>
          {!collapsed && <span className={styles.label}>{account.emailAddress}</span>}
          {account.status !== 'CONNECTED'
            ? !collapsed && (
                <span
                  className={styles.warn}
                  aria-label="Needs attention"
                  data-tooltip="Needs attention"
                >
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
              data-tooltip={label.name}
            >
              <Icon name="labelFilled" size={18} />
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
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
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

  const preferences = usePreferences().data;
  const suggestionCount = useSuggestionCount().data?.count ?? 0;
  const hidden = new Set(preferences?.sidebarHidden ?? DEFAULT_SIDEBAR_HIDDEN);

  interface Entry {
    to: string;
    label: string;
    icon: React.ComponentProps<typeof Icon>['name'];
    role?: FolderRole;
    key: string;
  }
  const folderEntry = (role: FolderRole, label = FOLDER_LABEL[role]): Entry => ({
    to: `/${role}`,
    label,
    icon: FOLDER_ICON[role],
    role,
    key: role,
  });
  const entries: Entry[] = [
    { to: '/starred', label: 'Starred', icon: 'star', key: 'starred' },
    folderEntry('sent'),
    folderEntry('drafts'),
    ...MAIL_CATEGORIES.map((category): Entry => ({
      to: `/category/${category}`,
      label: MAIL_CATEGORY_LABEL[category],
      icon: category,
      key: categoryKey(category),
    })),
    folderEntry('archive'),
    folderEntry('spam'),
    folderEntry('trash'),
  ];
  // Like Gmail, what the user hides in Manage labels waits behind "More".
  const shown = entries.filter((entry) => !hidden.has(entry.key));
  const more = entries.filter((entry) => hidden.has(entry.key));
  const moreActive = more.some((entry) => pathname.startsWith(entry.to));
  const showMore = moreOpen || moreActive;

  const item = (entry: Entry) => {
    const count = entry.role ? unifiedBadge(entry.role) : 0;
    return (
      <NavLink
        key={entry.to}
        to={entry.to}
        data-tooltip={collapsed ? entry.label : undefined}
        aria-label={collapsed ? entry.label : undefined}
        className={({ isActive }) =>
          `${styles.item} ${isActive ? styles.active : ''} ${count > 0 ? styles.hasUnread : ''}`
        }
      >
        <Icon name={entry.icon} size={20} />
        {!collapsed && entry.label}
        {entry.role && badge(count, badgeLabel(entry.role, count, entry.label.toLowerCase()))}
      </NavLink>
    );
  };

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
        {item({ to: '/inbox', label: 'All inboxes', icon: 'inbox', role: 'inbox', key: 'inbox' })}
        <NavLink
          to="/suggestions"
          data-tooltip={collapsed ? 'Suggestions' : undefined}
          aria-label={collapsed ? 'Suggestions' : undefined}
          className={({ isActive }) =>
            `${styles.item} ${isActive ? styles.active : ''} ${suggestionCount > 0 ? styles.hasUnread : ''}`
          }
        >
          <Icon name="sparkle" size={20} />
          {!collapsed && 'Suggestions'}
          {badge(suggestionCount, `${suggestionCount} suggestions waiting`)}
        </NavLink>
        {shown.map(item)}
        {showMore && more.map(item)}
        {showMore && (
          <>
            <NavLink
              to="/settings/labels"
              className={navClass}
              aria-label={collapsed ? 'Manage labels' : undefined}
              data-tooltip={collapsed ? 'Manage labels' : undefined}
            >
              <Icon name="settings" size={20} />
              {!collapsed && 'Manage labels'}
            </NavLink>
            <NavLink
              to="/settings/labels"
              className={() => styles.item}
              aria-label={collapsed ? 'Create new label' : undefined}
              data-tooltip={collapsed ? 'Create new label' : undefined}
            >
              <Icon name="add" size={20} />
              {!collapsed && 'Create new label'}
            </NavLink>
          </>
        )}
        <button
          type="button"
          className={styles.item}
          aria-expanded={showMore}
          data-tooltip={collapsed ? (showMore ? 'Less' : 'More') : undefined}
          aria-label={collapsed ? (showMore ? 'Less' : 'More') : undefined}
          onClick={() => setMoreOpen(!showMore)}
        >
          <Icon name={showMore ? 'expandLess' : 'expand'} size={20} />
          {!collapsed && (showMore ? 'Less' : 'More')}
        </button>
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
