import { useLayoutEffect, useRef, useState } from 'react';
import type { Recipient } from '../api/compose';
import { useContacts } from '../api/compose';
import { Icon } from '../ui/Icon';
import { avatarColor, parseRecipients, recipientLabel } from './model';
import styles from './RecipientField.module.css';

function Avatar({ recipient, large = false }: { recipient: Recipient; large?: boolean }) {
  return (
    <span
      className={large ? styles.avatarLarge : styles.avatar}
      style={{ background: avatarColor(recipient.address) }}
      aria-hidden="true"
    >
      {recipientLabel(recipient).charAt(0).toUpperCase()}
    </span>
  );
}

// A Gmail-style recipients line: chips for addresses, suggestions as you type.
export function RecipientField({
  label,
  value,
  onChange,
  autoFocus = false,
  trailing,
}: {
  label: string;
  value: Recipient[];
  onChange: (recipients: Recipient[]) => void;
  autoFocus?: boolean;
  // e.g. the Cc and Bcc links on the To line.
  trailing?: React.ReactNode;
}) {
  const [text, setText] = useState('');
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(false);
  const field = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  // Where the suggestions open: under the text being typed, as in Gmail.
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);
  const query = text.trim();
  const contacts = useContacts(query);
  const taken = new Set(value.map((r) => r.address));
  const suggestions =
    focused && query ? (contacts.data ?? []).filter((c) => !taken.has(c.address)) : [];

  const showing = suggestions.length > 0;
  useLayoutEffect(() => {
    if (!showing || !input.current || !field.current) return;
    const box = input.current;
    // Kept inside the field: the list is about 420px wide.
    const room = field.current.clientWidth - Math.min(420, field.current.clientWidth);
    setPlace({ left: Math.min(box.offsetLeft, room), top: box.offsetTop + box.offsetHeight + 4 });
  }, [showing, text, value.length]);

  const add = (recipients: Recipient[]) => {
    const fresh = recipients.filter((r) => !taken.has(r.address));
    if (fresh.length) onChange([...value, ...fresh]);
  };

  // Turns what was typed into chips; anything that isn't an address stays to be fixed.
  const commit = () => {
    if (!query) return;
    const { recipients, invalid } = parseRecipients(text);
    add(recipients);
    setText(invalid.join(', '));
    setActive(0);
  };

  return (
    <div ref={field} className={styles.field}>
      <span className={styles.label}>{label}</span>
      <div className={styles.chips}>
        {value.map((recipient) => (
          <span key={recipient.address} className={styles.chip} title={recipient.address}>
            <Avatar recipient={recipient} />
            <span className={styles.chipLabel}>{recipientLabel(recipient)}</span>
            <button
              type="button"
              aria-label={`Remove ${recipient.address}`}
              onClick={() => onChange(value.filter((r) => r.address !== recipient.address))}
            >
              <Icon name="close" size={14} />
            </button>
          </span>
        ))}
        <input
          ref={input}
          className={styles.input}
          aria-label={label}
          autoFocus={autoFocus}
          value={text}
          onFocus={() => setFocused(true)}
          onChange={(event) => {
            const next = event.target.value;
            // A separator typed or pasted ends an address.
            if (/[,;]\s*$/.test(next)) {
              const { recipients, invalid } = parseRecipients(next);
              add(recipients);
              setText(invalid.join(', '));
            } else {
              setText(next);
            }
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' && suggestions.length) {
              event.preventDefault();
              setActive((i) => (i + 1) % suggestions.length);
            } else if (event.key === 'ArrowUp' && suggestions.length) {
              event.preventDefault();
              setActive((i) => (i - 1 + suggestions.length) % suggestions.length);
            } else if (event.key === 'Enter' || event.key === 'Tab') {
              if (suggestions[active]) {
                event.preventDefault();
                add([suggestions[active]]);
                setText('');
              } else if (query) {
                event.preventDefault();
                commit();
              }
            } else if (event.key === 'Backspace' && !text && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => {
            setFocused(false);
            commit();
          }}
        />
      </div>
      {trailing}
      {suggestions.length > 0 && (
        <ul
          className={styles.suggestions}
          role="listbox"
          aria-label={`${label} suggestions`}
          style={place ?? undefined}
        >
          {suggestions.map((contact, index) => (
            <li
              key={contact.address}
              role="option"
              aria-selected={index === active}
              className={index === active ? styles.active : undefined}
              // Picked before the input's blur commits the half-typed text.
              onMouseDown={(event) => {
                event.preventDefault();
                add([contact]);
                setText('');
              }}
            >
              <Avatar recipient={contact} large />
              <span>
                <b>{contact.name ?? contact.address}</b>
                <small>{contact.address}</small>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
