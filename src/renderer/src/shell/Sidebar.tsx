import { NavLink } from 'react-router';
import type { ThreadFilter } from '../api/mail';
import { useMailStats } from '../api/mail-queries';
import { Icon, type IconName } from '../ui/Icon';
import styles from './Sidebar.module.css';

// filter null = folder not synced yet.
export const FOLDERS: {
  path: string;
  label: string;
  icon: IconName;
  filter: ThreadFilter | null;
}[] = [
  { path: '/inbox', label: 'Inbox', icon: 'inbox', filter: 'all' },
  { path: '/starred', label: 'Starred', icon: 'star', filter: 'starred' },
  { path: '/snoozed', label: 'Snoozed', icon: 'schedule', filter: null },
  { path: '/sent', label: 'Sent', icon: 'send', filter: null },
  { path: '/drafts', label: 'Drafts', icon: 'draft', filter: null },
];

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const stats = useMailStats();
  const unread = stats.data?.unreadThreads ?? 0;
  return (
    <nav
      className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}
      aria-label="Mail folders"
    >
      <button className={styles.compose} aria-label="Compose">
        <Icon name="edit" size={24} />
        {!collapsed && 'Compose'}
      </button>
      <div className={styles.nav}>
        {FOLDERS.map((folder) => (
          <NavLink
            key={folder.path}
            to={folder.path}
            title={folder.label}
            className={({ isActive }) => `${styles.item} ${isActive ? styles.active : ''}`}
          >
            <Icon name={folder.icon} size={20} />
            {!collapsed && folder.label}
            {!collapsed && folder.path === '/inbox' && unread > 0 && (
              <span className={styles.badge} aria-label={`${unread} unread`}>
                {unread.toLocaleString()}
              </span>
            )}
          </NavLink>
        ))}
      </div>
      {!collapsed && <p className={styles.section}>Labels</p>}
    </nav>
  );
}
