import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Icon } from './Icon';
import styles from './Snackbar.module.css';

export interface SnackbarMessage {
  text: string;
  // A small logo before the text, e.g. the storage service a file went to.
  icon?: string;
  action?: { label: string; onClick: () => void };
}

const SHOW_MS = 6000;

const SnackbarContext = createContext<(message: SnackbarMessage) => void>(() => {});

export const useSnackbar = () => useContext(SnackbarContext);

// Gmail's bottom-left notice ("Conversation archived. Undo"); a new one replaces the last.
export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<(SnackbarMessage & { id: number }) | null>(null);
  const show = useCallback(
    (message: SnackbarMessage) => setCurrent({ ...message, id: Date.now() }),
    [],
  );

  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(() => setCurrent(null), SHOW_MS);
    return () => clearTimeout(timer);
  }, [current]);

  const value = useMemo(() => show, [show]);
  return (
    <SnackbarContext.Provider value={value}>
      {children}
      <div className={styles.region} role="status" aria-live="polite">
        {current && (
          <div key={current.id} className={styles.snackbar}>
            {current.icon && <img className={styles.icon} src={current.icon} alt="" />}
            <span>{current.text}</span>
            {current.action && (
              <button
                className={styles.action}
                onClick={() => {
                  current.action!.onClick();
                  setCurrent(null);
                }}
              >
                {current.action.label}
              </button>
            )}
            <button className={styles.close} aria-label="Dismiss" onClick={() => setCurrent(null)}>
              <Icon name="close" size={18} />
            </button>
          </div>
        )}
      </div>
    </SnackbarContext.Provider>
  );
}
