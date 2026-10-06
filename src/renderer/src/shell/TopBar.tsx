import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth, useCurrentUser } from '../auth/AuthProvider';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Logo } from '../ui/Logo';
import { ThemeToggle } from './ThemeToggle';
import styles from './TopBar.module.css';

export function TopBar({ onToggleMenu }: { onToggleMenu: () => void }) {
  const user = useCurrentUser();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const initial = user.name.trim().charAt(0).toUpperCase() || '?';

  return (
    <header className={styles.bar}>
      <div className={styles.brand}>
        <button className={styles.iconButton} aria-label="Main menu" onClick={onToggleMenu}>
          <Icon name="menu" size={24} />
        </button>
        <Link to="/inbox" className={styles.brand} aria-label="OneBox inbox">
          <Logo size={30} />
        </Link>
      </div>

      <form className={styles.search} role="search" onSubmit={(e) => e.preventDefault()}>
        <button className={styles.iconButton} aria-label="Search">
          <Icon name="search" size={24} />
        </button>
        <input className={styles.searchInput} placeholder="Search mail" aria-label="Search mail" />
        <button type="button" className={styles.iconButton} aria-label="Search options">
          <Icon name="tune" size={22} />
        </button>
      </form>

      <div className={styles.actions}>
        <ThemeToggle className={styles.iconButton} />
        <button
          className={styles.iconButton}
          aria-label="Settings"
          onClick={() => void navigate('/settings')}
        >
          <Icon name="settings" size={22} />
        </button>
        <div className={styles.account}>
          <button
            className={styles.avatar}
            aria-label={`Account: ${user.name}`}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {initial}
          </button>
          {menuOpen && (
            <div className={styles.menu} role="dialog" aria-label="Account">
              <div className={`${styles.avatar} ${styles.avatarLarge}`}>{initial}</div>
              <p className={styles.menuName}>Hi, {user.name.split(' ')[0]}!</p>
              <p className={styles.menuEmail}>{user.email}</p>
              <Button onClick={() => void signOut()}>
                <Icon name="logout" size={18} /> Sign out
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
