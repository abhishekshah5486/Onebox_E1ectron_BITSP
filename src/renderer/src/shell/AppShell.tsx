import { useState } from 'react';
import { Outlet } from 'react-router';
import styles from './AppShell.module.css';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className={styles.shell}>
      <TopBar onToggleMenu={() => setCollapsed((value) => !value)} />
      <div className={styles.body}>
        <Sidebar collapsed={collapsed} />
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
