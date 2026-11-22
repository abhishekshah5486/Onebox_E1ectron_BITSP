import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Checkbox from '@cloudscape-design/components/checkbox';
import DatePicker from '@cloudscape-design/components/date-picker';
import Input from '@cloudscape-design/components/input';
import Modal from '@cloudscape-design/components/modal';
import SegmentedControl from '@cloudscape-design/components/segmented-control';
import Select from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { isSearchMode, searchPath, type SearchMode } from '../api/search';
import {
  buildQuery,
  EMPTY_SEARCH,
  SEARCH_IN,
  SIZE_UNITS,
  WITHIN,
  type AdvancedSearch,
} from '../mail/searchQuery';
import { useCurrentSearch } from '../shell/SearchBox';
import styles from './ConsoleSearchBox.module.css';

const option = (value: string, label = value) => ({ value, label });
const SIZE_OPS = [option('larger', 'greater than'), option('smaller', 'less than')];
const MODES = [
  { id: 'keyword', text: 'Keyword' },
  { id: 'semantic', text: 'Semantic' },
];

// Runs a search from anywhere in the console, closing the options once it starts.
function useRunSearch(onStart?: () => void) {
  const navigate = useNavigate();
  return (q: string, how: SearchMode) => {
    if (!q.trim()) return;
    onStart?.();
    void navigate(searchPath(how, q));
  };
}

export function ConsoleSearchBox() {
  const current = useCurrentSearch();
  const [text, setText] = useState(current.q);
  const [mode, setMode] = useState<SearchMode>(current.mode);
  const [advanced, setAdvanced] = useState(false);
  const run = useRunSearch(() => setAdvanced(false));

  // Opening another search (or leaving search) shows that search in the box.
  const routeKey = `${current.mode}:${current.q}`;
  const [shown, setShown] = useState(routeKey);
  if (shown !== routeKey) {
    setShown(routeKey);
    setText(current.q);
    setMode(current.mode);
  }

  return (
    <div className={styles.bar}>
      <div className={styles.input} role="search">
        <Input
          type="search"
          value={text}
          placeholder={mode === 'semantic' ? 'Describe the mail you want' : 'Search mail'}
          ariaLabel="Search mail"
          onChange={({ detail }) => setText(detail.value)}
          onKeyDown={({ detail }) => detail.key === 'Enter' && run(text, mode)}
        />
      </div>
      <SegmentedControl
        label="Search type"
        selectedId={mode}
        options={MODES}
        onChange={({ detail }) => isSearchMode(detail.selectedId) && setMode(detail.selectedId)}
      />
      <Button
        variant="icon"
        iconName="filter"
        ariaLabel="Search options"
        onClick={() => setAdvanced(true)}
      />
      {advanced && (
        <SearchOptionsModal mode={mode} onSearch={run} onDismiss={() => setAdvanced(false)} />
      )}
    </div>
  );
}

// The same options from a mailbox's own filter bar, for searching beyond the page.
export function SearchAllMailButton() {
  const [open, setOpen] = useState(false);
  const run = useRunSearch(() => setOpen(false));
  return (
    <>
      <Button iconName="filter" onClick={() => setOpen(true)}>
        Advanced search
      </Button>
      {open && (
        <SearchOptionsModal mode="keyword" onSearch={run} onDismiss={() => setOpen(false)} />
      )}
    </>
  );
}

// A label beside its field, as in Gmail's search options.
function Row({
  label,
  controlId,
  children,
}: {
  label: string;
  controlId?: string;
  children: ReactNode;
}) {
  return (
    <>
      <Box variant="awsui-key-label">
        <label htmlFor={controlId} className={styles.label}>
          {label}
        </label>
      </Box>
      <div className={styles.field}>{children}</div>
    </>
  );
}

function SearchOptionsModal({
  mode: initialMode,
  onSearch,
  onDismiss,
}: {
  mode: SearchMode;
  onSearch: (q: string, mode: SearchMode) => void;
  onDismiss: () => void;
}) {
  const [form, setForm] = useState<AdvancedSearch>(EMPTY_SEARCH);
  const [mode, setMode] = useState(initialMode);
  const set = <K extends keyof AdvancedSearch>(key: K, value: AdvancedSearch[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const query = buildQuery(form);
  // Like Gmail, searching with nothing filled in just closes the options.
  const submit = () => (query ? onSearch(query, mode) : onDismiss());
  const text = (key: 'from' | 'to' | 'subject' | 'hasWords' | 'doesntHave', label: string) => (
    <Row label={label} controlId={`search-${key}`}>
      <Input
        controlId={`search-${key}`}
        value={form[key]}
        onChange={({ detail }) => set(key, detail.value)}
        onKeyDown={({ detail }) => detail.key === 'Enter' && submit()}
      />
    </Row>
  );
  const within = WITHIN.map((w) => option(w.id, w.label));
  const places = SEARCH_IN.map((p) => option(p.id, p.label));

  return (
    <Modal
      visible
      size="medium"
      header="Search options"
      onDismiss={onDismiss}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={() => setForm(EMPTY_SEARCH)}>
              Clear
            </Button>
            <Button variant="primary" onClick={submit}>
              Search
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="l">
        <div className={styles.form}>
          {text('from', 'From')}
          {text('to', 'To')}
          {text('subject', 'Subject')}
          {text('hasWords', 'Has the words')}
          {text('doesntHave', "Doesn't have")}
          <Row label="Size">
            <div className={styles.fixed}>
              <Select
                ariaLabel="Size is"
                selectedOption={SIZE_OPS.find((o) => o.value === form.sizeOp) ?? null}
                options={SIZE_OPS}
                onChange={({ detail }) =>
                  set('sizeOp', detail.selectedOption.value as AdvancedSearch['sizeOp'])
                }
              />
            </div>
            <div className={styles.grow}>
              <Input
                value={form.size}
                inputMode="decimal"
                ariaLabel="Size"
                onChange={({ detail }) => set('size', detail.value)}
              />
            </div>
            <div className={styles.fixed}>
              <Select
                ariaLabel="Size unit"
                selectedOption={option(form.sizeUnit)}
                options={SIZE_UNITS.map((unit) => option(unit))}
                onChange={({ detail }) =>
                  set('sizeUnit', detail.selectedOption.value as AdvancedSearch['sizeUnit'])
                }
              />
            </div>
          </Row>
          <Row label="Date within">
            <div className={styles.fixed}>
              <Select
                ariaLabel="Date within"
                selectedOption={within.find((w) => w.value === form.within) ?? null}
                options={within}
                onChange={({ detail }) => set('within', detail.selectedOption.value ?? '1d')}
              />
            </div>
            <div className={styles.grow}>
              <DatePicker
                value={form.date}
                placeholder="YYYY/MM/DD"
                ariaLabel="Of date"
                openCalendarAriaLabel={(date) => `Choose date${date ? `, selected ${date}` : ''}`}
                onChange={({ detail }) => set('date', detail.value)}
              />
            </div>
          </Row>
          <Row label="Search in">
            <div className={styles.grow}>
              <Select
                ariaLabel="Search in"
                selectedOption={places.find((p) => p.value === form.searchIn) ?? null}
                options={places}
                onChange={({ detail }) =>
                  set('searchIn', detail.selectedOption.value as AdvancedSearch['searchIn'])
                }
              />
            </div>
          </Row>
        </div>
        <SpaceBetween direction="horizontal" size="l">
          <Checkbox
            checked={form.hasAttachment}
            onChange={({ detail }) => set('hasAttachment', detail.checked)}
          >
            Has attachment
          </Checkbox>
          <Checkbox
            checked={mode === 'semantic'}
            onChange={({ detail }) => setMode(detail.checked ? 'semantic' : 'keyword')}
          >
            Semantic search (match by meaning)
          </Checkbox>
        </SpaceBetween>
      </SpaceBetween>
    </Modal>
  );
}
