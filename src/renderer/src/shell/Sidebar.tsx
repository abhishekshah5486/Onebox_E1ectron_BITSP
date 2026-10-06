import { NavLink } from 'react-router';
import { Icon, type IconName } from '../ui/Icon';
import styles from './Sidebar.module.css';

export const FOLDERS: { path: string; label: string; icon: IconName }[] = [
  { path: '/inbox', label: 'Inbox', icon: 'inbox' },
  { path: '/starred', label: 'Starred', icon: 'star' },
  { path: '/snoozed', label: 'Snoozed', icon: 'schedule' },
  { path: '/sent', label: 'Sent', icon: 'send' },
  { path: '/drafts', label: 'Drafts', icon: 'draft' },
];

export function Sidebar({ collapsed }: { collapsed: boolean }) {
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
          </NavLink>
        ))}
      </div>
      {!collapsed && <p className={styles.section}>Labels</p>}
    </nav>
  );
}
