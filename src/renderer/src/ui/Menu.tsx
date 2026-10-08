import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from './Icon';
import { IconButton } from './IconButton';
import styles from './Menu.module.css';

export interface MenuItem {
  key: string;
  label: string;
  icon?: IconName;
}

// An icon button that opens a list of choices, closed by a choice, Escape or a click outside.
export function Menu({
  label,
  icon,
  heading,
  items,
  onSelect,
  size,
}: {
  label: string;
  icon: IconName;
  heading?: string;
  items: MenuItem[];
  onSelect: (key: string) => void;
  size?: 'small' | 'normal';
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
      <IconButton
        icon={icon}
        label={label}
        size={size}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      />
      {open && (
        <div className={styles.menu} role="menu" aria-label={label}>
          {heading && <div className={styles.heading}>{heading}</div>}
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              className={styles.item}
              onClick={() => {
                setOpen(false);
                onSelect(item.key);
              }}
            >
              {item.icon && <Icon name={item.icon} size={18} />}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
