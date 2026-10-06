import type { FormEvent, ReactNode } from 'react';
import { Logo } from '../ui/Logo';
import styles from './AuthCard.module.css';

interface AuthCardProps {
  title: string;
  subtitle: string;
  error?: string | null;
  onSubmit: () => void;
  actions: ReactNode;
  children: ReactNode;
}

export function AuthCard({ title, subtitle, error, onSubmit, actions, children }: AuthCardProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div>
          <Logo size={40} withWordmark={false} />
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>
        <form className={styles.form} onSubmit={submit} noValidate>
          {error && (
            <p role="alert" className={styles.alert}>
              {error}
            </p>
          )}
          {children}
          <div className={styles.actions}>{actions}</div>
        </form>
      </div>
    </main>
  );
}
