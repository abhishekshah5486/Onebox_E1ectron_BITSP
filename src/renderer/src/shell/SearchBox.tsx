import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useMatch, useNavigate } from 'react-router';
import { isSearchMode, searchPath, type SearchMode } from '../api/search';
import {
  buildQuery,
  EMPTY_SEARCH,
  SEARCH_IN,
  SIZE_UNITS,
  WITHIN,
  type AdvancedSearch,
} from '../mail/searchQuery';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import styles from './SearchBox.module.css';

// The search a results page shows, so the box keeps it while you read.
export function useCurrentSearch(): { q: string; mode: SearchMode } {
  const match = useMatch('/search/:mode/:q/*');
  const mode = match?.params.mode;
  return { q: match?.params.q ?? '', mode: isSearchMode(mode) ? mode : 'keyword' };
}

export function SearchBox() {
  const navigate = useNavigate();
  const current = useCurrentSearch();
  const [text, setText] = useState(current.q);
  const [mode, setMode] = useState<SearchMode>(current.mode);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLFormElement>(null);

  // Opening another search (or leaving search) shows that search in the box.
  const routeKey = `${current.mode}:${current.q}`;
  const [shown, setShown] = useState(routeKey);
  if (shown !== routeKey) {
    setShown(routeKey);
    setText(current.q);
    setMode(current.mode);
  }

  // Clicking elsewhere closes the panel, as in Gmail.
  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);

  const run = (q: string, how: SearchMode) => {
    if (!q.trim()) return;
    setOpen(false);
    void navigate(searchPath(how, q));
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    run(text, mode);
  };

  return (
    <form
      ref={root}
      className={styles.search}
      role="search"
      onSubmit={submit}
      onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}
    >
      <button type="submit" className={styles.iconButton} aria-label="Search" data-tooltip="Search">
        <Icon name="search" size={24} />
      </button>
      <input
        className={styles.input}
        placeholder={mode === 'semantic' ? 'Describe the mail you want' : 'Search mail'}
        aria-label="Search mail"
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <button
        type="button"
        className={styles.modeChip}
        aria-pressed={mode === 'semantic'}
        data-tooltip={mode === 'semantic' ? 'Searching by meaning' : 'Search by meaning with AI'}
        onClick={() => setMode(mode === 'semantic' ? 'keyword' : 'semantic')}
      >
        <Icon name="bolt" size={16} /> AI
      </button>
      <button
        type="button"
        className={styles.iconButton}
        aria-label="Search options"
        aria-expanded={open}
        data-tooltip="Show search options"
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="tune" size={22} />
      </button>
      {open && <AdvancedPanel mode={mode} onSearch={run} onClose={() => setOpen(false)} />}
    </form>
  );
}

function Row({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.row}>
      <label className={styles.label} htmlFor={htmlFor}>
        {label}
      </label>
      <div className={styles.field}>{children}</div>
    </div>
  );
}

function AdvancedPanel({
  mode: initialMode,
  onSearch,
  onClose,
}: {
  mode: SearchMode;
  onSearch: (q: string, mode: SearchMode) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<AdvancedSearch>(EMPTY_SEARCH);
  const [mode, setMode] = useState(initialMode);
  const set = <K extends keyof AdvancedSearch>(key: K, value: AdvancedSearch[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const text = (key: 'from' | 'to' | 'subject' | 'hasWords' | 'doesntHave', label: string) => (
    <Row label={label} htmlFor={`adv-${key}`}>
      <input
        id={`adv-${key}`}
        className={styles.line}
        value={form[key]}
        onChange={(event) => set(key, event.target.value)}
      />
    </Row>
  );
  const query = buildQuery(form);

  return (
    <div className={styles.panel} role="dialog" aria-label="Search options">
      <button
        type="button"
        className={styles.close}
        aria-label="Close search options"
        onClick={onClose}
      >
        <Icon name="close" size={20} />
      </button>
      {text('from', 'From')}
      {text('to', 'To')}
      {text('subject', 'Subject')}
      {text('hasWords', 'Has the words')}
      {text('doesntHave', "Doesn't have")}
      <Row label="Size">
        <select
          aria-label="Size is"
          className={styles.select}
          value={form.sizeOp}
          onChange={(event) => set('sizeOp', event.target.value as AdvancedSearch['sizeOp'])}
        >
          <option value="larger">greater than</option>
          <option value="smaller">less than</option>
        </select>
        <input
          aria-label="Size"
          inputMode="decimal"
          className={`${styles.line} ${styles.short}`}
          value={form.size}
          onChange={(event) => set('size', event.target.value)}
        />
        <select
          aria-label="Size unit"
          className={styles.select}
          value={form.sizeUnit}
          onChange={(event) => set('sizeUnit', event.target.value as AdvancedSearch['sizeUnit'])}
        >
          {SIZE_UNITS.map((unit) => (
            <option key={unit}>{unit}</option>
          ))}
        </select>
      </Row>
      <Row label="Date within">
        <select
          aria-label="Date within"
          className={styles.select}
          value={form.within}
          onChange={(event) => set('within', event.target.value)}
        >
          {WITHIN.map((w) => (
            <option key={w.id} value={w.id}>
              {w.label}
            </option>
          ))}
        </select>
        <input
          type="date"
          aria-label="Of date"
          className={styles.line}
          value={form.date}
          onChange={(event) => set('date', event.target.value)}
        />
      </Row>
      <Row label="Search" htmlFor="adv-in">
        <select
          id="adv-in"
          className={`${styles.select} ${styles.wide}`}
          value={form.searchIn}
          onChange={(event) => set('searchIn', event.target.value as AdvancedSearch['searchIn'])}
        >
          {SEARCH_IN.map((place) => (
            <option key={place.id} value={place.id}>
              {place.label}
            </option>
          ))}
        </select>
      </Row>
      <div className={styles.checks}>
        <label>
          <input
            type="checkbox"
            checked={form.hasAttachment}
            onChange={(event) => set('hasAttachment', event.target.checked)}
          />
          Has attachment
        </label>
        <label>
          <input
            type="checkbox"
            checked={mode === 'semantic'}
            onChange={(event) => setMode(event.target.checked ? 'semantic' : 'keyword')}
          />
          Search by meaning (AI, uses credits)
        </label>
      </div>
      <div className={styles.footer}>
        <code className={styles.preview} aria-label="Search query">
          {query}
        </code>
        <Button disabled={!query} onClick={() => onSearch(query, mode)}>
          Search
        </Button>
      </div>
    </div>
  );
}
