import { useEffect, useRef, useState } from 'react';
import { Icon } from '../ui/Icon';
import type { MoveTarget } from './actions';
import styles from './MoveMenu.module.css';

// "Move to" menu for the toolbar: folders first, then labels.
export function MoveMenu({
  targets,
  onMove,
}: {
  targets: MoveTarget[];
  onMove: (target: MoveTarget) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return (
    <div ref={root} className={styles.root}>
      <button
        aria-label="Move to"
        title="Move to"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="move" size={20} />
      </button>
      {open && (
        <div className={styles.menu} role="menu" aria-label="Move to">
          <div className={styles.heading}>Move to:</div>
          {targets.map((target) => (
            <button
              key={target.key}
              role="menuitem"
              className={styles.item}
              onClick={() => {
                setOpen(false);
                onMove(target);
              }}
            >
              <Icon name={'label' in target.target ? 'label' : 'move'} size={18} />
              {target.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
