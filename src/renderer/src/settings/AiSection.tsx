import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ButtonDropdown from '@cloudscape-design/components/button-dropdown';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Container from '@cloudscape-design/components/container';
import FormField from '@cloudscape-design/components/form-field';
import Header from '@cloudscape-design/components/header';
import Icon from '@cloudscape-design/components/icon';
import KeyValuePairs from '@cloudscape-design/components/key-value-pairs';
import Modal from '@cloudscape-design/components/modal';
import Pagination from '@cloudscape-design/components/pagination';
import Popover from '@cloudscape-design/components/popover';
import ProgressBar from '@cloudscape-design/components/progress-bar';
import Select, { type SelectProps } from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Table, { type TableProps } from '@cloudscape-design/components/table';
import Tiles from '@cloudscape-design/components/tiles';
import TextFilter from '@cloudscape-design/components/text-filter';
import { formatDistanceStrict } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import {
  AUTO_MODEL,
  useChooseEmbedding,
  useChooseModel,
  useEmbeddingEstimate,
  useEmbeddings,
  useModels,
  useSemanticStatus,
  useUsage,
  type EmbeddingOption,
  type ModelOption,
  type ModelProvider,
  type ModelPurpose,
  type UsageCall,
} from '../api/ai';
import { describeError } from '../auth/errors';
import { formatUtc } from '../mail/format';
import tableStyles from '../ui/DataTable.module.css';
import styles from './AiSection.module.css';
import { useFlash } from './flash';
import { ModelLogo } from './ModelLogo';
import { IndexingStorageSection } from './IndexingStorageSection';
import { ModelProvidersSection } from './ModelProvidersSection';
import { OWN_PREFIX, useUserModels, type UserModel } from '../api/providers';
import { LoadError } from '../ui/LoadError';
import { PlanGate } from '../billing/PlanGate';
import { TableActions } from '../ui/TableActions';

const PURPOSE: Record<ModelPurpose, { label: string; description: string }> = {
  classify: {
    label: 'Sorting mail into labels',
    description: 'Runs on every new email; a fast model is plenty.',
  },
  extract: {
    label: 'Pulling out details',
    description: 'Amounts, dates and other fields from emails.',
  },
  summarize: { label: 'Summaries', description: 'Short overviews of long conversations.' },
  draft: { label: 'Writing replies', description: 'Drafts in your voice; a stronger model helps.' },
};

const PROVIDER: Record<ModelProvider, string> = {
  OPENAI: 'OpenAI',
  GEMINI: 'Google Gemini',
  ANTHROPIC: 'Anthropic',
  PERPLEXITY: 'Perplexity',
};

// Auto's own mark; every model shows its maker's logo.
const autoMark = (
  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path
      d="M8 1.5l1.6 3.9 3.9 1.6-3.9 1.6L8 12.5 6.4 8.6 2.5 7l3.9-1.6zM13 11l.7 1.3 1.3.7-1.3.7L13 15l-.7-1.3-1.3-.7 1.3-.7z"
      fill="#539fe5"
    />
  </svg>
);

function optionsFor(models: ModelOption[], own: UserModel[]): SelectProps.Options {
  const groups = (Object.keys(PROVIDER) as ModelProvider[]).map((provider) => ({
    label: PROVIDER[provider],
    options: models
      .filter((model) => model.provider === provider)
      .map((model) => ({
        value: model.id,
        label: model.name,
        description: model.available ? model.description : `${model.description} · not set up`,
        disabled: !model.available,
        iconSvg: <ModelLogo model={model.id} provider={provider} />,
      })),
  }));
  return [
    {
      value: AUTO_MODEL,
      label: 'Auto',
      labelTag: 'Recommended',
      description: 'Always picks the best available model',
      iconSvg: autoMark,
    },
    ...(own.length
      ? [
          {
            label: 'Your models',
            options: own.map((model) => ({
              value: `${OWN_PREFIX}${model.id}`,
              label: model.name,
              description: `${model.providerName}, your own key`,
              iconUrl: model.logoUrl ?? undefined,
              iconAlt: '',
            })),
          },
        ]
      : []),
    ...groups.filter((group) => group.options.length > 0),
  ];
}

// The field shows just the logo and name; descriptions stay in the list.
const inField = (option: SelectProps.Option | undefined): SelectProps.Option | null =>
  option ? { ...option, description: undefined, labelTag: undefined } : null;

const flat = (options: SelectProps.Options) =>
  options.flatMap((option) => ('options' in option ? option.options : [option]));

// Which model does each job, and every AI call with what it took and cost.
export function AiSection() {
  const models = useModels();
  const choose = useChooseModel();
  const flash = useFlash();
  const userModels = useUserModels();
  const options = optionsFor(
    models.data?.items ?? [],
    (userModels.data?.items ?? []).filter((model) => model.kind === 'llm'),
  );

  return (
    <SpaceBetween size="l">
      <PlanGate
        needs="STANDARD"
        title="Models"
        description="Choose the AI model for each task, such as a stronger one for writing replies. Free uses Auto's picks."
      >
        <Container
          header={
            <Header
              variant="h2"
              description="If a model is down or fails, OneBox moves to the next one from the same provider, then to Auto's picks."
            >
              Models
            </Header>
          }
        >
          <SpaceBetween size="l">
            {models.isPending && <StatusIndicator type="loading">Loading models</StatusIndicator>}
            {models.isError && (
              <LoadError
                error={models.error}
                header="Models could not be loaded"
                onRetry={() => void models.refetch()}
              />
            )}
            <ColumnLayout columns={2}>
              {(models.data?.purposes ?? []).map((purpose) => {
                const chosen = models.data?.choices[purpose] ?? AUTO_MODEL;
                return (
                  <FormField
                    key={purpose}
                    label={PURPOSE[purpose].label}
                    description={PURPOSE[purpose].description}
                  >
                    <Select
                      selectedOption={inField(
                        flat(options).find((option) => option.value === chosen),
                      )}
                      options={options}
                      // Shows the chosen model with its maker's logo, not just its name.
                      triggerVariant="option"
                      ariaLabel={`Model for ${PURPOSE[purpose].label.toLowerCase()}`}
                      onChange={({ detail }) => {
                        const modelId = detail.selectedOption.value ?? AUTO_MODEL;
                        choose.mutate(
                          { purpose, modelId },
                          {
                            onSuccess: () =>
                              flash({
                                type: 'success',
                                content: `${PURPOSE[purpose].label} now uses ${detail.selectedOption.label ?? 'Auto'}.`,
                              }),
                            onError: (error) =>
                              flash({ type: 'error', content: describeError(error) }),
                          },
                        );
                      }}
                    />
                  </FormField>
                );
              })}
            </ColumnLayout>
          </SpaceBetween>
        </Container>
      </PlanGate>
      <ModelProvidersSection kind="llm" />
      <SemanticSearchSection />
      <ModelProvidersSection kind="embedding" />
      <IndexingStorageSection />
      <UsageTable />
    </SpaceBetween>
  );
}

const EMBEDDING_PROVIDER: Record<string, string> = {
  ollama: 'OneBox hosted',
  openai: 'OpenAI',
  gemini: 'Google Gemini',
};

const perMillion = (usd: number) => `$${usd} per 1M tokens`;

// Every way a model differs that matters when picking one.
const providerName = (model: EmbeddingOption) =>
  EMBEDDING_PROVIDER[model.provider] ?? model.provider;

const dimensions = (model: EmbeddingOption) => `${model.dimensions.toLocaleString()} dimensions`;
const context = (model: EmbeddingOption) =>
  model.contextTokens ? `${model.contextTokens.toLocaleString()} token context` : null;

// The gist on the tile, in two lines; the rest is behind its info icon.
function embeddingSummary(model: EmbeddingOption) {
  if (model.own)
    return [model.description, dimensions(model), context(model)].filter(Boolean).join(' · ');
  if (!model.available) return `Needs a working ${providerName(model)} API key on the server`;
  const who = model.local
    ? `${providerName(model)}, free`
    : `${providerName(model)}, ${perMillion(model.usdPerMillionTokens)}`;
  return [who, dimensions(model), context(model)].filter(Boolean).join(' · ');
}

function EmbeddingDetails({ model }: { model: EmbeddingOption }) {
  return (
    <KeyValuePairs
      columns={1}
      items={[
        {
          label: 'Runs on',
          value: model.local
            ? "OneBox's own servers; your mail isn't sent to another company"
            : providerName(model),
        },
        {
          label: 'Cost',
          value: model.local
            ? 'Free for now'
            : `${perMillion(model.usdPerMillionTokens)}, charged per search`,
        },
        { label: 'Vector size', value: dimensions(model) },
        ...(model.contextTokens
          ? [
              {
                label: 'Reads up to',
                value: `${model.contextTokens.toLocaleString()} tokens of each email`,
              },
            ]
          : []),
        ...(model.description ? [{ label: 'About', value: model.description }] : []),
        ...(model.available
          ? []
          : [
              {
                label: 'Unavailable',
                value: `The server needs a working ${providerName(model)} API key.`,
              },
            ]),
      ]}
    />
  );
}

const duration = (seconds: number) =>
  seconds < 60
    ? 'under a minute'
    : `about ${formatDistanceStrict(0, seconds * 1000, { roundingMethod: 'ceil' })}`;

// Time left from the pace so far.
function timeLeft({ done, total, startedAt }: { done: number; total: number; startedAt: string }) {
  const elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000;
  if (done === 0 || elapsed <= 0) return 'working out the time left';
  return `${duration(((total - done) * elapsed) / done)} left`;
}

// Which model semantic search embeds the user's mail with. Switching embeds all of it again, so
// it is confirmed with a measured estimate first; progress and the result show as banners, and
// searches keep the old model until the new one has everything.
function SemanticSearchSection() {
  const embeddings = useEmbeddings();
  // The model a switch was just confirmed for, until its rebuild shows up (or is already done).
  const [starting, setStarting] = useState<string | null>(null);
  const status = useSemanticStatus({ starting: starting !== null });
  const choose = useChooseEmbedding();
  const flash = useFlash();
  const [picked, setPicked] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const chosen = embeddings.data?.chosen;
  const value = picked ?? chosen ?? null;
  const items = embeddings.data?.items ?? [];
  const nameOf = (id: string) => items.find((item) => item.id === id)?.name ?? id;
  const rebuild = status.data?.rebuild ?? null;
  const active = status.data?.active;

  // A started switch shows a progress banner until searches have moved to the new model.
  const [watching, setWatching] = useState<string | null>(null);
  if (rebuild && watching !== rebuild.modelId) setWatching(rebuild.modelId);
  if (starting && rebuild) setStarting(null);
  const target = watching ?? starting;
  const finished = target !== null && !rebuild && active?.id === target;
  if (finished) {
    setWatching(null);
    setStarting(null);
  }
  const progressKey = rebuild ? `${rebuild.modelId}:${rebuild.done}` : null;
  useEffect(() => {
    if (!rebuild) return;
    flash({
      id: 'reembed',
      type: 'info',
      loading: true,
      header: `Re-embedding your mail with ${nameOf(rebuild.modelId)}`,
      content: (
        <ProgressBar
          variant="flash"
          value={rebuild.total ? Math.round((rebuild.done / rebuild.total) * 100) : 0}
          additionalInfo={`${rebuild.done.toLocaleString()} of ${rebuild.total.toLocaleString()} emails, ${timeLeft(rebuild)}. Searches use ${active?.name ?? 'the current model'} until then.`}
        />
      ),
    });
    // Only a change in progress needs a new banner.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressKey]);
  const [announced, setAnnounced] = useState<string | null>(null);
  if (finished && active && announced !== active.id) setAnnounced(active.id);
  useEffect(() => {
    if (!announced) return;
    flash({
      id: 'reembed',
      type: 'success',
      header: 'Semantic search is ready',
      content: `All your mail is embedded with ${nameOf(announced)}, and searches now use it.`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [announced]);

  const apply = () => {
    if (!value) return;
    choose.mutate(value, {
      onSuccess: () => {
        setPicked(null);
        setConfirming(false);
        setStarting(value);
        setAnnounced(null);
      },
      onError: (error) => {
        setConfirming(false);
        flash({ type: 'error', content: describeError(error) });
      },
    });
  };

  return (
    <Container
      header={
        <Header
          variant="h2"
          description="The embedding model turns each email into a vector so semantic search can find mail by meaning. OneBox-hosted models are free for now; Google Gemini and OpenAI models charge credits per search."
          actions={
            <Button
              variant="primary"
              disabled={!value || value === chosen || Boolean(rebuild)}
              onClick={() => setConfirming(true)}
            >
              Use this model
            </Button>
          }
        >
          Semantic search
        </Header>
      }
    >
      <SpaceBetween size="l">
        {embeddings.isPending && (
          <StatusIndicator type="loading">Loading embedding models</StatusIndicator>
        )}
        {embeddings.isError && (
          <LoadError
            error={embeddings.error}
            header="Embedding models could not be loaded"
            onRetry={() => void embeddings.refetch()}
          />
        )}
        {rebuild ? (
          <StatusIndicator type="in-progress">
            Moving to {nameOf(rebuild.modelId)}: {rebuild.done.toLocaleString()} of{' '}
            {rebuild.total.toLocaleString()} emails embedded
          </StatusIndicator>
        ) : (
          active && <StatusIndicator type="success">Searching with {active.name}</StatusIndicator>
        )}
        {items.length > 0 && (
          <Tiles
            ariaLabel="Embedding model"
            columns={3}
            value={value}
            onChange={({ detail }) => setPicked(detail.value)}
            items={items.map((model) => ({
              value: model.id,
              disabled: !model.available,
              label: (
                <span className={styles.modelName}>
                  <ModelLogo
                    model={model.id.split('/')[1]}
                    provider={model.provider.toUpperCase()}
                  />
                  {model.name}
                  {model.id === embeddings.data?.default && ' (default)'}
                  {/* Opening the details shouldn't pick the tile. */}
                  <span
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                  >
                    <Popover
                      header={model.name}
                      size="medium"
                      triggerType="custom"
                      content={<EmbeddingDetails model={model} />}
                    >
                      <Button
                        variant="inline-icon"
                        iconName="status-info"
                        ariaLabel={`About ${model.name}`}
                      />
                    </Popover>
                  </span>
                </span>
              ),
              description: embeddingSummary(model),
            }))}
          />
        )}
      </SpaceBetween>
      {confirming && value && (
        <SwitchEmbeddingModal
          model={items.find((item) => item.id === value) ?? null}
          modelId={value}
          applying={choose.isPending}
          onConfirm={apply}
          onDismiss={() => setConfirming(false)}
        />
      )}
    </Container>
  );
}

// Warns that switching re-embeds every email, with the time it would take measured on the
// user's own mail.
function SwitchEmbeddingModal({
  model,
  modelId,
  applying,
  onConfirm,
  onDismiss,
}: {
  model: EmbeddingOption | null;
  modelId: string;
  applying: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const estimate = useEmbeddingEstimate(modelId);
  const name = model?.name ?? modelId;
  return (
    <Modal
      visible
      header={`Switch semantic search to ${name}?`}
      onDismiss={onDismiss}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss}>
              Cancel
            </Button>
            <Button variant="primary" loading={applying} onClick={onConfirm}>
              Re-embed all mail
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="m">
        <Alert type="warning" header="All your mail will be embedded again">
          {estimate.isPending ? (
            <StatusIndicator type="loading">Timing {name} on a sample of your mail</StatusIndicator>
          ) : estimate.data ? (
            <>
              {estimate.data.emails.toLocaleString()} emails will be embedded with {name}. Expected
              time: <strong>{duration(estimate.data.seconds)}</strong>, measured on your own mail.
            </>
          ) : (
            `Every email will be embedded with ${name}. The time could not be measured: ${describeError(estimate.error)}`
          )}
        </Alert>
        <Box variant="p">
          Searches keep using the current model in the meantime, and you&apos;ll get a notification
          once it&apos;s finished.
          {model &&
            !model.local &&
            ` ${name} runs at ${providerName(model)}: each search will use credits (${perMillion(model.usdPerMillionTokens)}).`}
        </Box>
      </SpaceBetween>
    </Modal>
  );
}

// A model id with its maker's logo, as in the model picker.
function ModelName({ model, suffix = '' }: { model: string; suffix?: string }) {
  return (
    <span className={styles.modelName}>
      {model === AUTO_MODEL ? autoMark : <ModelLogo model={model} />}
      {model === AUTO_MODEL ? 'Auto' : model}
      {suffix}
    </span>
  );
}

const usd = (value: number) =>
  value === 0 ? '$0' : value < 0.01 ? `$${value.toFixed(6)}` : `$${value.toFixed(4)}`;
const num = (value: number) => value.toLocaleString();
const purposeLabel = (purpose: string) => PURPOSE[purpose as ModelPurpose]?.label ?? purpose;

type GroupBy = 'none' | 'model' | 'purpose' | 'day' | 'status';
const GROUP_LABEL: Record<GroupBy, string> = {
  none: 'Calls',
  model: 'Model',
  purpose: 'Task',
  day: 'Day',
  status: 'Result',
};
const keyOf: Record<Exclude<GroupBy, 'none'>, (call: UsageCall) => string> = {
  model: (call) => call.modelUsed ?? 'No model',
  purpose: (call) => purposeLabel(call.purpose),
  day: (call) => call.createdAt.slice(0, 10),
  status: (call) => (call.status === 'ok' ? 'OK' : 'Failed'),
};

interface Group {
  key: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
  latencyMs: number;
  failures: number;
}

function groupCalls(calls: UsageCall[], by: Exclude<GroupBy, 'none'>): Group[] {
  const groups = new Map<string, Group>();
  for (const call of calls) {
    const key = keyOf[by](call);
    const group = groups.get(key) ?? {
      key,
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      costUsd: 0,
      latencyMs: 0,
      failures: 0,
    };
    group.calls += 1;
    group.inputTokens += call.inputTokens;
    group.outputTokens += call.outputTokens;
    group.cacheReadTokens += call.cacheReadTokens;
    group.cacheWriteTokens += call.cacheWriteTokens;
    group.costUsd += call.costUsd;
    group.latencyMs += call.latencyMs;
    if (call.status !== 'ok') group.failures += 1;
    groups.set(key, group);
  }
  return [...groups.values()];
}

const PAGE = 10;

const PERIODS = [
  { id: '1', text: 'Today' },
  { id: '7', text: 'Last 7 days' },
  { id: '30', text: 'Last 30 days' },
  { id: '90', text: 'Last 90 days' },
];

// Columns shared by single calls and groups of them, with how to sort each.
const tokenColumns = <T extends Group | UsageCall>(): TableProps.ColumnDefinition<T>[] => [
  {
    id: 'inputTokens',
    header: 'Input',
    sortingField: 'inputTokens',
    cell: (row) => num(row.inputTokens),
  },
  {
    id: 'cacheReadTokens',
    header: 'Cache read / write',
    sortingField: 'cacheReadTokens',
    cell: (row) => `${num(row.cacheReadTokens)} / ${num(row.cacheWriteTokens)}`,
  },
  {
    id: 'outputTokens',
    header: 'Output',
    sortingField: 'outputTokens',
    cell: (row) => num(row.outputTokens),
  },
  { id: 'costUsd', header: 'Cost (USD)', sortingField: 'costUsd', cell: (row) => usd(row.costUsd) },
];

const CALL_COLUMNS: TableProps.ColumnDefinition<UsageCall>[] = [
  {
    id: 'createdAt',
    header: 'Time (UTC)',
    sortingField: 'createdAt',
    cell: (row) => formatUtc(row.createdAt).replace(' UTC', ''),
  },
  {
    id: 'purpose',
    header: 'Task',
    sortingField: 'purpose',
    cell: (row) => purposeLabel(row.purpose),
  },
  {
    id: 'requestedModel',
    header: 'Selected model',
    sortingField: 'requestedModel',
    cell: (row) => <ModelName model={row.requestedModel} />,
  },
  {
    id: 'model',
    header: 'Used model',
    sortingField: 'modelUsed',
    cell: (row) =>
      row.modelUsed ? (
        <ModelName model={row.modelUsed} suffix={row.cacheHit ? ' (from cache)' : ''} />
      ) : (
        '—'
      ),
  },
  {
    id: 'fallbacks',
    header: 'Fallback',
    sortingField: 'fellBack',
    cell: (row) => String(row.fellBack),
  },
  ...tokenColumns<UsageCall>(),
  {
    id: 'latencyMs',
    header: 'Latency',
    sortingField: 'latencyMs',
    cell: (row) => `${(row.latencyMs / 1000).toFixed(1)} s`,
  },
  {
    id: 'status',
    header: 'Result',
    sortingField: 'status',
    cell: (row) =>
      row.status === 'ok' ? (
        <StatusIndicator type="success">OK</StatusIndicator>
      ) : (
        <StatusIndicator type="error">{row.errorCode ?? 'Failed'}</StatusIndicator>
      ),
  },
];

const groupColumns = (by: GroupBy): TableProps.ColumnDefinition<Group>[] => [
  {
    id: 'key',
    header: GROUP_LABEL[by],
    sortingField: 'key',
    cell: (row) =>
      by === 'model' && row.key !== 'No model' ? <ModelName model={row.key} /> : row.key,
  },
  { id: 'calls', header: 'Calls', sortingField: 'calls', cell: (row) => num(row.calls) },
  ...tokenColumns<Group>(),
  {
    id: 'latencyMs',
    header: 'Avg latency',
    sortingField: 'latencyMs',
    cell: (row) => `${(row.latencyMs / row.calls / 1000).toFixed(1)} s`,
  },
  { id: 'failures', header: 'Failed', sortingField: 'failures', cell: (row) => num(row.failures) },
];

function sortRows<T>(rows: T[], field: string | undefined, descending: boolean) {
  if (!field) return rows;
  return [...rows].sort((a, b) => {
    const x = (a as Record<string, unknown>)[field] as string | number | null;
    const y = (b as Record<string, unknown>)[field] as string | number | null;
    const order = x === y ? 0 : x === null ? -1 : y === null ? 1 : x < y ? -1 : 1;
    return descending ? -order : order;
  });
}

// One table for all of it: search, sort, group by a pill, and totals in the header.
function UsageTable() {
  const [days, setDays] = useState('30');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [sorting, setSorting] = useState<{ field?: string; descending: boolean }>({
    field: 'createdAt',
    descending: true,
  });
  const usage = useUsage(Number(days));
  const totals = usage.data?.totals;

  const matching = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const calls = usage.data?.calls ?? [];
    if (!needle) return calls;
    return calls.filter((call) =>
      [
        purposeLabel(call.purpose),
        call.modelUsed ?? '',
        call.requestedModel,
        call.status === 'ok' ? 'ok' : 'failed',
        call.errorCode ?? '',
        call.cacheHit ? 'cache' : '',
        formatUtc(call.createdAt),
      ]
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  }, [usage.data, filter]);

  const grouped = groupBy !== 'none';
  const rows: (UsageCall | Group)[] = sortRows<UsageCall | Group>(
    grouped ? groupCalls(matching, groupBy) : matching,
    sorting.field,
    sorting.descending,
  );
  const pagesCount = Math.max(1, Math.ceil(rows.length / PAGE));
  const shown = rows.slice((page - 1) * PAGE, page * PAGE);
  const columns = (grouped ? groupColumns(groupBy) : CALL_COLUMNS) as TableProps.ColumnDefinition<
    UsageCall | Group
  >[];

  return (
    <div className={tableStyles.table}>
      <Table
        variant="container"
        items={shown}
        wrapLines={false}
        trackBy={(row) => ('id' in row ? row.id : row.key)}
        loading={usage.isPending}
        loadingText="Loading usage"
        columnDefinitions={columns}
        sortingColumn={columns.find((column) => column.sortingField === sorting.field) ?? {}}
        sortingDescending={sorting.descending}
        onSortingChange={({ detail }) =>
          setSorting({
            field: detail.sortingColumn.sortingField,
            descending: detail.isDescending ?? false,
          })
        }
        header={
          <SpaceBetween size="m">
            <Header
              variant="h2"
              counter={totals ? `(${num(totals.calls)})` : undefined}
              description="Every AI call OneBox made for you, what it used and what it cost."
              actions={
                <TableActions
                  name="AI usage"
                  refreshing={usage.isFetching && !usage.isPending}
                  onRefresh={() => void usage.refetch()}
                  rows={() =>
                    grouped
                      ? groupCalls(matching, groupBy).map((group) => ({
                          [GROUP_LABEL[groupBy]]: group.key,
                          Calls: group.calls,
                          'Input tokens': group.inputTokens,
                          'Output tokens': group.outputTokens,
                          'Cache read tokens': group.cacheReadTokens,
                          'Cache write tokens': group.cacheWriteTokens,
                          'Cost (USD)': group.costUsd,
                          'Latency (ms)': group.latencyMs,
                          Failures: group.failures,
                        }))
                      : matching.map((call) => ({
                          When: call.createdAt,
                          Task: purposeLabel(call.purpose),
                          'Requested model': call.requestedModel,
                          'Model used': call.modelUsed ?? '',
                          Status: call.status,
                          Error: call.errorCode ?? '',
                          'Cache hit': call.cacheHit,
                          'Input tokens': call.inputTokens,
                          'Output tokens': call.outputTokens,
                          'Cache read tokens': call.cacheReadTokens,
                          'Cache write tokens': call.cacheWriteTokens,
                          'Cost (USD)': call.costUsd,
                          'Latency (ms)': call.latencyMs,
                          Fallbacks: call.fallbacks,
                        }))
                  }
                >
                  <ButtonDropdown
                    items={(Object.keys(GROUP_LABEL) as GroupBy[]).map((id) => ({
                      id,
                      text: id === 'none' ? 'No grouping' : `By ${GROUP_LABEL[id].toLowerCase()}`,
                    }))}
                    onItemClick={({ detail }) => {
                      const next = detail.id as GroupBy;
                      setGroupBy(next);
                      setPage(1);
                      setSorting(
                        next === 'none'
                          ? { field: 'createdAt', descending: true }
                          : { field: 'calls', descending: true },
                      );
                    }}
                  >
                    {groupBy === 'none'
                      ? 'Group by'
                      : `Grouped by ${GROUP_LABEL[groupBy].toLowerCase()}`}
                  </ButtonDropdown>
                  <ButtonDropdown
                    items={PERIODS.map((period) => ({ id: period.id, text: period.text }))}
                    onItemClick={({ detail }) => {
                      setDays(detail.id);
                      setPage(1);
                    }}
                  >
                    {PERIODS.find((period) => period.id === days)?.text}
                  </ButtonDropdown>
                </TableActions>
              }
            >
              AI usage
            </Header>
            {totals && (
              <div className={styles.totals} role="status">
                <Icon name="status-info" />
                <span>
                  <b>{usd(totals.costUsd)}</b> · {num(totals.inputTokens)} input tokens (
                  {num(totals.cacheReadTokens)} from the provider's cache) ·{' '}
                  {num(totals.outputTokens)} output · {num(totals.cacheHits)} answered from OneBox's
                  cache · {num(totals.failures)} failed
                </span>
              </div>
            )}
          </SpaceBetween>
        }
        filter={
          <div className={styles.filters}>
            <TextFilter
              filteringText={filter}
              filteringPlaceholder="Search by task, model or result"
              filteringAriaLabel="Search AI calls"
              countText={`${matching.length} ${matching.length === 1 ? 'call' : 'calls'}`}
              onChange={({ detail }) => {
                setFilter(detail.filteringText);
                setPage(1);
              }}
            />
          </div>
        }
        pagination={
          <Pagination
            currentPageIndex={page}
            pagesCount={pagesCount}
            onChange={({ detail }) => setPage(detail.currentPageIndex)}
          />
        }
        empty={
          usage.isError ? (
            <LoadError
              error={usage.error}
              header="Usage could not be loaded"
              onRetry={() => void usage.refetch()}
            />
          ) : (
            <Box textAlign="center" color="inherit">
              <b>{filter ? 'No matching calls' : 'No AI calls in this period'}</b>
            </Box>
          )
        }
      />
    </div>
  );
}
