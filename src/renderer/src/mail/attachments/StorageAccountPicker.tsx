import { useEffect, useId, useRef, useState } from 'react';
import type { StorageAccount } from '../../api/settings';
import { ProviderLogo } from '../../storage/ProviderLogo';
import { STORAGE_PROVIDERS } from '../../storage/providers';
import { Icon } from '../../ui/Icon';
import styles from './Attachments.module.css';

// v1's storage account field: an outlined Material dropdown with each account's logo, address
// and service, in the field and in its list.
export function StorageAccountPicker({
  accounts,
  value,
  onChange,
}: {
  accounts: StorageAccount[];
  value: StorageAccount;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() => accounts.indexOf(value));
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);

  const pick = (index: number) => {
    const chosen = accounts[index];
    if (chosen) onChange(chosen.id);
    setOpen(false);
  };
  const who = (account: StorageAccount) => (
    <>
      <ProviderLogo provider={account.provider} size={22} />
      <span className={styles.storageWho}>
        <span>{account.email}</span>
        <small>{STORAGE_PROVIDERS[account.provider].name}</small>
      </span>
    </>
  );

  return (
    <div ref={root} className={styles.picker}>
      <button
        type="button"
        className={`${styles.pickerField} ${open ? styles.pickerOpen : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`Storage account: ${value.email}, ${STORAGE_PROVIDERS[value.provider].name}`}
        onClick={() => {
          setActive(accounts.indexOf(value));
          setOpen((current) => !current);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            // Closes the list, not the whole dialog.
            event.stopPropagation();
            setOpen(false);
          } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!open) return setOpen(true);
            const step = event.key === 'ArrowDown' ? 1 : -1;
            setActive((i) => (i + step + accounts.length) % accounts.length);
          } else if ((event.key === 'Enter' || event.key === ' ') && open) {
            event.preventDefault();
            pick(active);
          }
        }}
      >
        <span className={styles.pickerLabel}>Save to</span>
        {who(value)}
        <Icon name="caret" size={20} />
      </button>
      {open && (
        <ul id={listId} role="listbox" aria-label="Storage account" className={styles.pickerList}>
          {accounts.map((account, index) => (
            <li
              key={account.id}
              role="option"
              aria-selected={account.id === value.id}
              className={index === active ? styles.pickerActive : undefined}
              onMouseEnter={() => setActive(index)}
              onClick={() => pick(index)}
            >
              {who(account)}
              {account.id === value.id && <Icon name="check" size={18} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
