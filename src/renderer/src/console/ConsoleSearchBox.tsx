import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Checkbox from '@cloudscape-design/components/checkbox';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import DatePicker from '@cloudscape-design/components/date-picker';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Modal from '@cloudscape-design/components/modal';
import Select from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import ToggleButton from '@cloudscape-design/components/toggle-button';
import { colorTextAccent } from '@cloudscape-design/design-tokens';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { searchPath, type SearchMode } from '../api/search';
import {
  buildQuery,
  EMPTY_SEARCH,
  SEARCH_IN,
  SIZE_UNITS,
  WITHIN,
  type AdvancedSearch,
} from '../mail/searchQuery';
import { useCurrentSearch } from '../shell/SearchBox';
import { Icon } from '../ui/Icon';

const option = (value: string, label = value) => ({ value, label });
const SIZE_OPS = [option('larger', 'greater than'), option('smaller', 'less than')];

export function ConsoleSearchBox() {
  const navigate = useNavigate();
  const current = useCurrentSearch();
  const [text, setText] = useState(current.q);
  const [mode, setMode] = useState<SearchMode>(current.mode);
  const [advanced, setAdvanced] = useState(false);

  // Opening another search (or leaving search) shows that search in the box.
  const routeKey = `${current.mode}:${current.q}`;
  const [shown, setShown] = useState(routeKey);
  if (shown !== routeKey) {
    setShown(routeKey);
    setText(current.q);
    setMode(current.mode);
  }

  const run = (q: string, how: SearchMode) => {
    if (!q.trim()) return;
    setAdvanced(false);
    void navigate(searchPath(how, q));
  };

  return (
    <div
      style={{ flex: 1, minWidth: 0, maxWidth: 720, display: 'flex', alignItems: 'center', gap: 8 }}
    >
      <div style={{ flex: 1, minWidth: 160 }} role="search">
        <Input
          type="search"
          value={text}
          placeholder={mode === 'semantic' ? 'Search by meaning' : 'Search mail'}
          ariaLabel="Search mail"
          onChange={({ detail }) => setText(detail.value)}
          onKeyDown={({ detail }) => detail.key === 'Enter' && run(text, mode)}
        />
      </div>
      {/* Cloudscape keeps the top bar's search narrow, so the mode is an icon: filled means AI. */}
      <div style={{ flexShrink: 0 }}>
        <ToggleButton
          variant="icon"
          iconName="gen-ai"
          pressedIconSvg={
            <span style={{ display: 'flex', color: colorTextAccent }}>
              <Icon name="sparkle" size={16} />
            </span>
          }
          pressed={mode === 'semantic'}
          ariaLabel="Search by meaning (AI)"
          onChange={({ detail }) => setMode(detail.pressed ? 'semantic' : 'keyword')}
        />
      </div>
      <div style={{ flexShrink: 0 }}>
        <Button
          variant="icon"
          iconName="filter"
          ariaLabel="Search options"
          onClick={() => setAdvanced(true)}
        />
      </div>
      {advanced && (
        <AdvancedModal mode={mode} onSearch={run} onDismiss={() => setAdvanced(false)} />
      )}
    </div>
  );
}

function AdvancedModal({
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
  const text = (key: 'from' | 'to' | 'subject' | 'hasWords' | 'doesntHave', label: string) => (
    <FormField label={label}>
      <Input
        value={form[key]}
        ariaLabel={label}
        onChange={({ detail }) => set(key, detail.value)}
      />
    </FormField>
  );
  const within = WITHIN.map((w) => option(w.id, w.label));
  const places = SEARCH_IN.map((p) => option(p.id, p.label));

  return (
    <Modal
      visible
      size="large"
      header="Search options"
      onDismiss={onDismiss}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={() => setForm(EMPTY_SEARCH)}>
              Clear
            </Button>
            <Button variant="primary" disabled={!query} onClick={() => onSearch(query, mode)}>
              Search
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="l">
        <ColumnLayout columns={2}>
          {text('from', 'From')}
          {text('to', 'To')}
          {text('subject', 'Subject')}
          {text('hasWords', 'Has the words')}
          {text('doesntHave', "Doesn't have")}
          <FormField label="Search in">
            <Select
              selectedOption={places.find((p) => p.value === form.searchIn) ?? null}
              options={places}
              onChange={({ detail }) =>
                set('searchIn', detail.selectedOption.value as AdvancedSearch['searchIn'])
              }
            />
          </FormField>
          <FormField label="Size">
            <SpaceBetween direction="horizontal" size="xs">
              <Select
                selectedOption={SIZE_OPS.find((o) => o.value === form.sizeOp) ?? null}
                options={SIZE_OPS}
                onChange={({ detail }) =>
                  set('sizeOp', detail.selectedOption.value as AdvancedSearch['sizeOp'])
                }
              />
              <Input
                value={form.size}
                inputMode="decimal"
                ariaLabel="Size"
                onChange={({ detail }) => set('size', detail.value)}
              />
              <Select
                selectedOption={option(form.sizeUnit)}
                options={SIZE_UNITS.map((unit) => option(unit))}
                onChange={({ detail }) =>
                  set('sizeUnit', detail.selectedOption.value as AdvancedSearch['sizeUnit'])
                }
              />
            </SpaceBetween>
          </FormField>
          <FormField label="Date within">
            <SpaceBetween direction="horizontal" size="xs">
              <Select
                selectedOption={within.find((w) => w.value === form.within) ?? null}
                options={within}
                onChange={({ detail }) => set('within', detail.selectedOption.value ?? '1d')}
              />
              <DatePicker
                value={form.date}
                placeholder="YYYY/MM/DD"
                openCalendarAriaLabel={(date) => `Choose date${date ? `, selected ${date}` : ''}`}
                onChange={({ detail }) => set('date', detail.value)}
              />
            </SpaceBetween>
          </FormField>
        </ColumnLayout>
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
            Search by meaning (AI)
          </Checkbox>
        </SpaceBetween>
        <Box variant="code" color="text-body-secondary">
          {query || 'Fill in a field to build the search'}
        </Box>
      </SpaceBetween>
    </Modal>
  );
}
