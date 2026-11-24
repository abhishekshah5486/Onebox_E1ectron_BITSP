import { useState, type ReactNode } from 'react';
import { ApiError } from '../api/client';
import { useRagSettings, useSaveRagSettings, type RagSettings } from '../api/knowledge';
import { useNotify } from '../ui/useNotify';
import { Sparkles } from './parts';
import styles from './Knowledge.module.css';

function Field({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <div>
        <div className={styles.fieldLabel}>{label}</div>
        <div className={styles.fieldHint}>{hint}</div>
      </div>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string; disabled?: boolean }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className={styles.segmented} role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          disabled={option.disabled}
          className={`${styles.segment} ${value === option.value ? styles.segmentOn : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`${styles.switch} ${on ? styles.switchOn : ''}`}
      onClick={() => onChange(!on)}
    />
  );
}

// Keeps what is typed; passes a number up, or nothing for an optional field left empty.
function NumberInput({
  value,
  min,
  max,
  onChange,
  label,
  placeholder,
  optional = false,
}: {
  value: number | null;
  min: number;
  max: number;
  onChange: (value: number | null) => void;
  label: string;
  placeholder?: string;
  optional?: boolean;
}) {
  const [text, setText] = useState(value?.toString() ?? '');
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setText(value?.toString() ?? '');
  }
  return (
    <input
      type="number"
      className={styles.number}
      aria-label={label}
      aria-invalid={!optional && text === ''}
      min={min}
      max={max}
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        setText(e.target.value);
        const next = e.target.value === '' ? null : Number(e.target.value);
        if (next === null && !optional) return;
        setSeen(next);
        onChange(next);
      }}
    />
  );
}

function problems(s: RagSettings) {
  const out: string[] = [];
  if (s.search.results < 1 || s.search.results > 50)
    out.push('Passages per search must be 1 to 50.');
  if (s.search.maxPerRecord !== null && (s.search.maxPerRecord < 1 || s.search.maxPerRecord > 50))
    out.push('Passages per record must be 1 to 50, or empty.');
  if (s.indexing.windowChars < 200 || s.indexing.windowChars > 8000)
    out.push('Window length must be 200 to 8000.');
  if (s.indexing.windowOverlap < 0 || s.indexing.windowOverlap > 1000)
    out.push('Overlap must be 0 to 1000.');
  if (s.indexing.windowOverlap >= s.indexing.windowChars)
    out.push('The overlap must be shorter than the window.');
  return out;
}

export function SettingsView() {
  const notify = useNotify();
  const settings = useRagSettings();
  const save = useSaveRagSettings();
  // Unsaved edits; none means the saved settings.
  const [edited, setEdited] = useState<RagSettings | null>(null);
  // Bumped when edits are dropped, so the fields show the saved values again.
  const [version, setVersion] = useState(0);
  const setDraft = (next: RagSettings | null) => {
    setEdited(next);
    if (next === null) setVersion((v) => v + 1);
  };

  if (settings.isError) return <div className={styles.error}>Settings couldn't be loaded.</div>;
  if (!settings.data) return <div className={styles.shimmer} />;
  const draft = edited ?? settings.data.settings;

  const { defaults, summariesAvailable } = settings.data;
  const search = (patch: Partial<RagSettings['search']>) =>
    setDraft({ ...draft, search: { ...draft.search, ...patch } });
  const indexing = (patch: Partial<RagSettings['indexing']>) =>
    setDraft({ ...draft, indexing: { ...draft.indexing, ...patch } });
  const issues = problems(draft);
  const changed = JSON.stringify(draft) !== JSON.stringify(settings.data.settings);
  const custom = JSON.stringify(settings.data.settings) !== JSON.stringify(defaults);

  const submit = (next: RagSettings | null) =>
    save.mutate(next, {
      onSuccess: () => {
        setDraft(null);
        notify({ type: 'success', content: next ? 'Settings saved.' : 'Back to the defaults.' });
      },
      onError: (error) =>
        notify({
          type: 'error',
          content: error instanceof ApiError ? error.message : 'Settings were not saved.',
        }),
    });

  return (
    <div className={styles.settings} key={version}>
      <div>
        <h2 className={styles.viewTitle}>Settings</h2>
        <p className={styles.viewText}>
          How your searches return passages, and how your files are read.
        </p>
      </div>

      <section className={styles.panel}>
        <h3 className={styles.panelTitle}>Search</h3>
        <p className={styles.panelText}>Used by every search, here and when drafting replies.</p>
        <Field
          label="Passages per search"
          hint={`How many passages a search returns. Default ${defaults.search.results}.`}
        >
          <NumberInput
            label="Passages per search"
            min={1}
            max={50}
            value={draft.search.results}
            onChange={(v) => search({ results: v! })}
          />
        </Field>
        <Field
          label="Passages per record"
          hint="At most this many from one file or email, so others get room. Empty: no limit."
        >
          <NumberInput
            label="Passages per record"
            min={1}
            max={50}
            placeholder="No limit"
            value={draft.search.maxPerRecord}
            optional
            onChange={(v) => search({ maxPerRecord: v })}
          />
        </Field>
        <Field
          label="Show matches outside your dates"
          hint="A search with dates also lists the best matches its dates left out, in case the dates were off."
        >
          <Toggle
            label="Show matches outside your dates"
            on={draft.search.dateSafetyNet}
            onChange={(on) => search({ dateSafetyNet: on })}
          />
        </Field>
      </section>

      <section className={styles.panel}>
        <h3 className={styles.panelTitle}>
          <Sparkles size={16} />
          Reading your files
        </h3>
        <p className={styles.panelText}>
          Applies to files read from now on. Re-index a file under All records to apply it there.
        </p>
        <Field
          label="Summaries"
          hint={
            summariesAvailable
              ? 'A model summarizes and classifies each file, and the summary is searchable. Uses AI credits.'
              : 'Summaries are switched off on this server.'
          }
        >
          <Segmented
            label="Summaries"
            value={draft.indexing.summaries}
            onChange={(summaries) => indexing({ summaries })}
            options={[
              { value: 'on', label: 'Right away', disabled: !summariesAvailable },
              { value: 'first_use', label: 'On first search', disabled: !summariesAvailable },
              { value: 'off', label: 'Off' },
            ]}
          />
        </Field>
        <Field
          label="Dates from the document"
          hint="An upload takes the date its header states (e.g. Date: 3 March 2024) in place of when it was uploaded, or also in place of the file's last change."
        >
          <Segmented
            label="Dates from the document"
            value={draft.indexing.headerDates}
            onChange={(headerDates) => indexing({ headerDates })}
            options={[
              { value: 'off', label: 'Off' },
              { value: 'true', label: 'Over upload time' },
              { value: 'all', label: 'Over both' },
            ]}
          />
        </Field>
        <Field
          label="Window length"
          hint={`A passage too long to search whole is cut into windows this many characters long. Default ${defaults.indexing.windowChars}.`}
        >
          <NumberInput
            label="Window length"
            min={200}
            max={8000}
            value={draft.indexing.windowChars}
            onChange={(v) => indexing({ windowChars: v! })}
          />
        </Field>
        <Field
          label="Window overlap"
          hint={`Characters each window shares with the next, so nothing is cut mid-thought. Default ${defaults.indexing.windowOverlap}.`}
        >
          <NumberInput
            label="Window overlap"
            min={0}
            max={1000}
            value={draft.indexing.windowOverlap}
            onChange={(v) => indexing({ windowOverlap: v! })}
          />
        </Field>
      </section>

      {issues.length > 0 && (
        <div className={styles.error}>
          {issues.map((issue) => (
            <div key={issue}>{issue}</div>
          ))}
        </div>
      )}
      <div className={styles.actions}>
        {custom && (
          <button
            type="button"
            className={styles.secondary}
            onClick={() => submit(null)}
            disabled={save.isPending}
          >
            Use the defaults
          </button>
        )}
        <button
          type="button"
          className={styles.secondary}
          disabled={!changed}
          onClick={() => setDraft(null)}
        >
          Discard
        </button>
        <button
          type="button"
          className={styles.primary}
          disabled={!changed || issues.length > 0 || save.isPending}
          onClick={() => submit(draft)}
        >
          Save
        </button>
      </div>
    </div>
  );
}
