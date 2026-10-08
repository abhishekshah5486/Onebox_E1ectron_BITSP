import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './Dialog.module.css';

// A Gmail-style confirm dialog: title, text, then a text button and a filled one.
export function Dialog({
  title,
  children,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const confirm = useRef<HTMLButtonElement>(null);
  const cancel = useRef(onCancel);
  useEffect(() => {
    cancel.current = onCancel;
  });

  // Once per opening: focus the main button, close on Escape, give focus back afterwards.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    confirm.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && cancel.current();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, []);

  return createPortal(
    // React passes events from a portal up to its React parent (e.g. a list row); stop them here.
    <div
      className={styles.backdrop}
      onMouseDown={onCancel}
      onClick={(event) => event.stopPropagation()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={styles.dialog}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <div className={styles.body}>{children}</div>
        <div className={styles.actions}>
          <button className={styles.text} onClick={onCancel}>
            Cancel
          </button>
          <button ref={confirm} className={styles.filled} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
