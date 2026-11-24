import Alert from '@cloudscape-design/components/alert';
import Badge from '@cloudscape-design/components/badge';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Cards from '@cloudscape-design/components/cards';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Container from '@cloudscape-design/components/container';
import DateInput from '@cloudscape-design/components/date-input';
import ExpandableSection from '@cloudscape-design/components/expandable-section';
import FormField from '@cloudscape-design/components/form-field';
import Header from '@cloudscape-design/components/header';
import Icon from '@cloudscape-design/components/icon';
import Input from '@cloudscape-design/components/input';
import Link from '@cloudscape-design/components/link';
import Multiselect from '@cloudscape-design/components/multiselect';
import PromptInput from '@cloudscape-design/components/prompt-input';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Steps, { type StepsProps } from '@cloudscape-design/components/steps';
import Tabs from '@cloudscape-design/components/tabs';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useKnowledgeSources, useRetrieval, type Chunk } from '../../api/knowledge';
import {
  DATE_ORIGIN,
  KIND_LABEL,
  byRecord,
  formatDay,
  locate,
  relevance,
  sourceLabel,
  terms,
  type RecordHit,
} from '../../knowledge/format';
import {
  MAX_CHARS,
  NO_SCOPE,
  STEPS,
  SUGGESTIONS,
  errorText,
  inputFor,
  type Scope,
} from '../../knowledge/SearchView';
import styles from './Knowledge.module.css';
import { Sparkle } from './Sparkle';

const MAIL = '__mail__';
const CLAMP_CHARS = 360;

interface Props {
  onSearched: (query: string) => void;
  selected: string | null;
  onPreview: (recordId: string) => void;
  onOpen: (record: Chunk['record']) => void;
}

// How far a search got; a failed one stops on the step it was at.
function useProgress(running: boolean, failed: boolean) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!running) return;
    const timers = [setTimeout(() => setStep(1), 450), setTimeout(() => setStep(2), 1400)];
    return () => timers.forEach(clearTimeout);
  }, [running]);
  return running || failed ? step : STEPS.length;
}

function Progress({
  running,
  failed,
  found,
}: {
  running: boolean;
  failed: boolean;
  found?: string;
}) {
  const reached = useProgress(running, failed);
  const steps: StepsProps.Step[] = STEPS.map((label, i) => ({
    status: i < reached ? 'success' : i === reached ? (failed ? 'error' : 'loading') : 'pending',
    header: label,
  }));
  if (!running && found) steps.push({ status: 'success', header: found });
  return (
    <div aria-live="polite">
      <Steps steps={steps} ariaLabel="Search progress" />
    </div>
  );
}

function Where({ record }: { record: Chunk['record'] }) {
  const from = record.mail?.sender ?? record.attachedTo?.mail.sender;
  return [
    sourceLabel(record.sourceType, record.sourceId),
    from && `From ${from.name || from.address}`,
    record.attachedTo && `Attached to ${record.attachedTo.name}`,
    formatDay(record.dates.created),
  ]
    .filter(Boolean)
    .join(' · ');
}

// The question's words: bold, underlined in blue on a light green tint.
function Highlight({ text, words }: { text: string; words: string[] }) {
  if (words.length === 0) return <>{text}</>;
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(${escaped.join('|')})`, 'giu');
  return (
    <>
      {text.split(pattern).map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className={styles.match}>
            {part}
          </strong>
        ) : (
          part
        ),
      )}
    </>
  );
}

// A small link that opens or folds something, at the size of the text around it.
function Toggle({
  open,
  onToggle,
  more,
  less,
}: {
  open: boolean;
  onToggle: (open: boolean) => void;
  more: string;
  less: string;
}) {
  return (
    <Link
      variant="secondary"
      fontSize="body-s"
      href="#"
      onFollow={(e) => {
        e.preventDefault();
        onToggle(!open);
      }}
    >
      <Icon name={open ? 'caret-down-filled' : 'caret-right-filled'} size="small" />{' '}
      {open ? less : more}
    </Link>
  );
}

function RecordIcon({ record }: { record: Chunk['record'] }) {
  return <Icon name={record.mail && !record.attachedTo ? 'envelope' : 'file'} />;
}

function Passage({
  chunk,
  refNumber,
  words,
  top,
}: {
  chunk: Chunk;
  refNumber: number;
  words: string[];
  top: number;
}) {
  const [open, setOpen] = useState(false);
  // Long passages (a whole table, a summary) show their first lines until opened.
  const long = chunk.text.length > CLAMP_CHARS;
  return (
    <div className={styles.passage}>
      <span className={styles.ref} aria-label={`Passage ${refNumber}`}>
        {refNumber}
      </span>
      <SpaceBetween size="s">
        <div className={long && !open ? styles.clamp : undefined}>
          <Box variant="p" padding="n" margin="n">
            <Highlight text={chunk.text} words={words} />
          </Box>
        </div>
        {long && (
          <Button variant="inline-link" onClick={() => setOpen(!open)}>
            {open ? 'Show less' : 'Show more'}
          </Button>
        )}
        <div className={styles.tags}>
          <Box fontSize="body-s" color="text-body-secondary">
            {relevance(chunk.score, top)}% match
          </Box>
          {[...locate(chunk), ...(chunk.kind !== 'block' ? [KIND_LABEL[chunk.kind]] : [])].map(
            (tag) => (
              <Badge key={tag} color="blue">
                {tag}
              </Badge>
            ),
          )}
        </div>
      </SpaceBetween>
    </div>
  );
}

function RecordResult({
  hit,
  words,
  top,
  selected,
  onPreview,
  onOpen,
}: {
  hit: RecordHit;
  words: string[];
  top: number;
  selected: boolean;
  onPreview: (recordId: string) => void;
  onOpen: (record: Chunk['record']) => void;
}) {
  const [first, ...rest] = hit.chunks as [RecordHit['chunks'][number], ...RecordHit['chunks']];
  const [more, setMore] = useState(false);
  const passage = ({ chunk, ref }: RecordHit['chunks'][number]) => (
    <Passage key={chunk.id} chunk={chunk} refNumber={ref} words={words} top={top} />
  );
  return (
    <Container
      header={
        <Header
          variant="h3"
          description={
            <span title={`Dated ${DATE_ORIGIN[hit.record.dates.origin]}`}>
              <Where record={hit.record} />
            </span>
          }
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button onClick={() => onOpen(hit.record)}>
                {hit.record.mail?.threadId ? 'Open email' : 'Download'}
              </Button>
              <Button
                variant={selected ? 'primary' : 'normal'}
                onClick={() => onPreview(hit.recordId)}
              >
                Preview
              </Button>
            </SpaceBetween>
          }
        >
          <span className={styles.title}>
            <RecordIcon record={hit.record} />
            {hit.record.name}
          </span>
        </Header>
      }
    >
      <SpaceBetween size="m">
        {passage(first)}
        {more && rest.map(passage)}
        {rest.length > 0 && (
          // In line with the passages' text, past their numbers.
          <div className={styles.passage}>
            <span className={styles.refSpace} />
            <button
              type="button"
              className={styles.toggle}
              aria-expanded={more}
              onClick={() => setMore(!more)}
            >
              <Icon name={more ? 'caret-down-filled' : 'caret-right-filled'} size="small" />
              {more
                ? 'Show fewer citations'
                : `Show ${rest.length} more ${rest.length === 1 ? 'citation' : 'citations'}`}
            </button>
          </div>
        )}
      </SpaceBetween>
    </Container>
  );
}

// Asking across collections and mail, built from the console's own parts.
export function SearchPage({ onSearched, selected, onPreview, onOpen }: Props) {
  const [params, setParams] = useSearchParams();
  const asked = params.get('q') ?? '';
  const recordIds = useMemo(
    () => params.get('records')?.split(',').filter(Boolean) ?? [],
    [params],
  );
  const [draft, setDraft] = useState(asked);
  const [scope, setScope] = useState<Scope>(NO_SCOPE);
  const [applied, setApplied] = useState<Scope>(NO_SCOPE);
  const [tab, setTab] = useState('results');
  const [options, setOptions] = useState(false);
  const sources = useKnowledgeSources();
  const collections = (sources.data ?? []).filter((s) => s.sourceType === 'upload');
  const mailIds = (sources.data ?? [])
    .filter((s) => s.sourceType === 'mail')
    .map((s) => s.sourceId);

  // A question asked elsewhere (a recent search) becomes the draft.
  const [seen, setSeen] = useState(asked);
  if (seen !== asked) {
    setSeen(asked);
    setDraft(asked);
  }

  const input = asked ? inputFor(asked, applied, recordIds, mailIds) : null;
  const retrieval = useRetrieval(input);
  const words = useMemo(() => terms(asked), [asked]);
  const data = retrieval.data;
  const hits = useMemo(() => byRecord(data?.chunks ?? []), [data]);
  const top = Math.max(0, ...(data?.chunks ?? []).map((c) => c.score));
  const outsideTop = Math.max(0, ...(data?.outsideDates?.chunks ?? []).map((c) => c.score));

  const submit = (text = draft) => {
    const query = text.trim();
    if (!query) return;
    setApplied(scope);
    setTab('results');
    onSearched(query);
    const next = new URLSearchParams(params);
    next.set('q', query);
    setParams(next);
  };

  const sourceOptions = [
    ...collections.map((c) => ({ value: c.sourceId, label: sourceLabel('upload', c.sourceId) })),
    { value: MAIL, label: 'Mail', iconName: 'envelope' as const },
  ];
  const chosen = sourceOptions.filter((o) =>
    o.value === MAIL ? scope.mail && scope.sourceIds.length > 0 : scope.sourceIds.includes(o.value),
  );
  const scoped =
    scope.sourceIds.length > 0 ||
    !scope.mail ||
    scope.createdAfter ||
    scope.createdBefore ||
    scope.limit;

  const composer = (
    <SpaceBetween size="xs">
      {recordIds.length > 0 && (
        <Alert
          type="info"
          action={
            <Button
              onClick={() => {
                const next = new URLSearchParams(params);
                next.delete('records');
                setParams(next);
              }}
            >
              Search everything
            </Button>
          }
        >
          Searching within {recordIds.length} selected{' '}
          {recordIds.length === 1 ? 'record' : 'records'}.
        </Alert>
      )}
      <PromptInput
        value={draft}
        onChange={({ detail }) => setDraft(detail.value.slice(0, MAX_CHARS))}
        onAction={() => submit()}
        placeholder="Ask about your files and mail, e.g. 'What did the supplier send last month?'"
        ariaLabel="Question"
        actionButtonIconName="send"
        actionButtonAriaLabel="Search"
        disableActionButton={!draft.trim()}
        minRows={2}
        maxRows={8}
        secondaryActions={
          <Box padding={{ left: 'xxs', top: 'xxs' }}>
            <Multiselect
              selectedOptions={chosen}
              options={sourceOptions}
              placeholder="All sources"
              hideTokens
              expandToViewport
              ariaLabel="Sources"
              onChange={({ detail }) => {
                const ids = detail.selectedOptions.map((o) => o.value!);
                const picked = ids.filter((id) => id !== MAIL);
                // Mail alone searches only mail; nothing picked searches everything.
                setScope({
                  ...scope,
                  sourceIds: picked.length > 0 ? picked : ids.includes(MAIL) ? mailIds : [],
                  mail: picked.length === 0 || ids.includes(MAIL),
                });
              }}
            />
          </Box>
        }
      />
      <SpaceBetween direction="horizontal" size="s" alignItems="center">
        <Box fontSize="body-s" color="text-body-secondary">
          Max {MAX_CHARS.toLocaleString()} characters
        </Box>
        <Toggle
          open={options}
          onToggle={setOptions}
          more={scoped ? 'Search options (on)' : 'Search options'}
          less="Hide search options"
        />
      </SpaceBetween>
      {options && (
        <Container>
          <ColumnLayout columns={3}>
            <FormField label="Written from">
              <DateInput
                value={scope.createdAfter}
                placeholder="YYYY/MM/DD"
                onChange={({ detail }) => setScope({ ...scope, createdAfter: detail.value })}
              />
            </FormField>
            <FormField label="Written to">
              <DateInput
                value={scope.createdBefore}
                placeholder="YYYY/MM/DD"
                onChange={({ detail }) => setScope({ ...scope, createdBefore: detail.value })}
              />
            </FormField>
            <FormField label="Passages" description="Leave empty for your setting">
              <Input
                type="number"
                inputMode="numeric"
                value={scope.limit}
                onChange={({ detail }) => setScope({ ...scope, limit: detail.value })}
              />
            </FormField>
          </ColumnLayout>
          {scoped && (
            <Box margin={{ top: 's' }}>
              <Button variant="inline-link" onClick={() => setScope(NO_SCOPE)}>
                Clear options
              </Button>
            </Box>
          )}
        </Container>
      )}
    </SpaceBetween>
  );

  if (!asked) {
    return (
      <div className={styles.searchColumn}>
        <SpaceBetween size="l">
          <Box textAlign="center" padding={{ top: 'xxxl' }}>
            <Sparkle size={48} />
            <Box variant="h1" padding={{ top: 's' }}>
              How can I help you today?
            </Box>
            <Box color="text-body-secondary">
              Ask in your own words; you get the passages from your files and mail that answer it.
            </Box>
          </Box>
          {composer}
          <Cards
            items={SUGGESTIONS}
            trackBy="title"
            cardsPerRow={[{ cards: 1 }, { minWidth: 560, cards: 2 }]}
            cardDefinition={{
              header: (s) => (
                <Link
                  href="#"
                  fontSize="heading-s"
                  onFollow={(e) => {
                    e.preventDefault();
                    setDraft(s.title);
                    submit(s.title);
                  }}
                >
                  {s.title}
                </Link>
              ),
              sections: [
                { id: 'text', content: (s) => s.text },
                { id: 'chip', content: (s) => <Badge color="blue">{s.chip}</Badge> },
              ],
            }}
          />
        </SpaceBetween>
      </div>
    );
  }

  const found = data
    ? data.chunks.length === 0
      ? 'Nothing matched'
      : `${data.chunks.length} ${data.chunks.length === 1 ? 'passage' : 'passages'} from ${hits.length} ${hits.length === 1 ? 'record' : 'records'}`
    : undefined;
  const citations = (chunks: Chunk[], best: number, offset = 0) =>
    chunks.map((chunk, i) => (
      <Container
        key={chunk.id}
        header={
          <Header
            variant="h3"
            description={<Where record={chunk.record} />}
            actions={<Button onClick={() => onPreview(chunk.record.recordId)}>Preview</Button>}
          >
            <span className={styles.title}>
              <RecordIcon record={chunk.record} />
              {chunk.record.name}
            </span>
          </Header>
        }
      >
        <Passage chunk={chunk} refNumber={offset + i + 1} words={words} top={best} />
      </Container>
    ));

  return (
    <div className={styles.searchColumn}>
      <SpaceBetween size="l">
        <Header variant="h2">{asked}</Header>
        {(retrieval.isFetching || data || retrieval.isError) && (
          <Progress
            key={JSON.stringify(input)}
            running={retrieval.isFetching}
            failed={retrieval.isError && !retrieval.isFetching}
            found={found}
          />
        )}
        {retrieval.isError && <Alert type="error">{errorText(retrieval.error)}</Alert>}
        {data && !retrieval.isFetching && (
          <SpaceBetween size="l">
            {(data.notices ?? []).map((n) => (
              <Alert key={n.code} type="info">
                {n.message}
              </Alert>
            ))}
            {data.incomplete && <Alert type="warning">{data.incomplete}</Alert>}
            {data.chunks.length === 0 ? (
              <Alert type="info" header="No passage matched">
                Try other words or a wider scope, or check that your files are searchable under All
                records.
              </Alert>
            ) : (
              <Tabs
                activeTabId={tab}
                onChange={({ detail }) => setTab(detail.activeTabId)}
                tabs={[
                  {
                    id: 'results',
                    label: `Results (${hits.length})`,
                    content: (
                      <SpaceBetween size="m">
                        {hits.map((hit) => (
                          <RecordResult
                            key={hit.recordId}
                            hit={hit}
                            words={words}
                            top={top}
                            selected={selected === hit.recordId}
                            onPreview={onPreview}
                            onOpen={onOpen}
                          />
                        ))}
                      </SpaceBetween>
                    ),
                  },
                  {
                    id: 'citations',
                    label: `Citations (${data.chunks.length})`,
                    content: <SpaceBetween size="m">{citations(data.chunks, top)}</SpaceBetween>,
                  },
                ]}
              />
            )}
            {data.outsideDates && data.outsideDates.chunks.length > 0 && (
              <ExpandableSection
                variant="container"
                headerText="Outside your dates"
                headerDescription={data.outsideDates.note}
              >
                <SpaceBetween size="m">
                  {citations(data.outsideDates.chunks, outsideTop, data.chunks.length)}
                </SpaceBetween>
              </ExpandableSection>
            )}
            {data.unindexed.length > 0 && (
              <Container
                header={<Header variant="h3">Named like your question, not searchable yet</Header>}
              >
                <SpaceBetween size="xs">
                  {data.unindexed.map((item) => (
                    <SpaceBetween key={item.recordId} direction="horizontal" size="xs">
                      <Link
                        href="#"
                        onFollow={(e) => {
                          e.preventDefault();
                          onPreview(item.recordId);
                        }}
                      >
                        {item.name}
                      </Link>
                      <Box color="text-body-secondary">{item.reason ?? item.status}</Box>
                    </SpaceBetween>
                  ))}
                </SpaceBetween>
              </Container>
            )}
          </SpaceBetween>
        )}
      </SpaceBetween>
      {/* Outside SpaceBetween, whose wrapper would keep it from sticking. */}
      <div className={styles.dock}>{composer}</div>
    </div>
  );
}
