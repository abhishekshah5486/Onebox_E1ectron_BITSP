import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Container from '@cloudscape-design/components/container';
import FormField from '@cloudscape-design/components/form-field';
import Header from '@cloudscape-design/components/header';
import Pagination from '@cloudscape-design/components/pagination';
import SegmentedControl from '@cloudscape-design/components/segmented-control';
import Select, { type SelectProps } from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Table, { type TableProps } from '@cloudscape-design/components/table';
import TextFilter from '@cloudscape-design/components/text-filter';
import { useMemo, useState, type ReactElement } from 'react';
import {
  AUTO_MODEL,
  useChooseModel,
  useModels,
  useUsage,
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
import { LoadError } from '../ui/LoadError';

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
};

// Simple marks so each provider is recognisable in the list.
const mark = (provider: ModelProvider | 'AUTO') => {
  const paths: Record<typeof provider, ReactElement> = {
    AUTO: (
      <path
        d="M8 1.5l1.6 3.9 3.9 1.6-3.9 1.6L8 12.5 6.4 8.6 2.5 7l3.9-1.6zM13 11l.7 1.3 1.3.7-1.3.7L13 15l-.7-1.3-1.3-.7 1.3-.7z"
        fill="#539fe5"
      />
    ),
    OPENAI: (
      <path
        d="M8 1.6a3.2 3.2 0 0 1 3 2.1 3.2 3.2 0 0 1 2.6 4.6 3.2 3.2 0 0 1-2.6 4.9A3.2 3.2 0 0 1 5 13.3a3.2 3.2 0 0 1-2.6-4.6A3.2 3.2 0 0 1 5 3.8a3.2 3.2 0 0 1 3-2.2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    ),
    GEMINI: (
      <path
        d="M8 1c.6 3.6 3.4 6.4 7 7-3.6.6-6.4 3.4-7 7-.6-3.6-3.4-6.4-7-7 3.6-.6 6.4-3.4 7-7z"
        fill="#4c8df6"
      />
    ),
    ANTHROPIC: (
      <path
        d="M8 1v14M1 8h14M3 3l10 10M13 3L3 13"
        stroke="#d97757"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    ),
  };
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {paths[provider]}
    </svg>
  );
};

function optionsFor(models: ModelOption[]): SelectProps.Options {
  const groups = (Object.keys(PROVIDER) as ModelProvider[]).map((provider) => ({
    label: PROVIDER[provider],
    options: models
      .filter((model) => model.provider === provider)
      .map((model) => ({
        value: model.id,
        label: model.name,
        description: model.available ? model.description : `${model.description} · not set up`,
        disabled: !model.available,
        iconSvg: mark(provider),
      })),
  }));
  return [
    {
      value: AUTO_MODEL,
      label: 'Auto',
      labelTag: 'Recommended',
      description: 'Always picks the best available model',
      iconSvg: mark('AUTO'),
    },
    ...groups.filter((group) => group.options.length > 0),
  ];
}

const flat = (options: SelectProps.Options) =>
  options.flatMap((option) => ('options' in option ? option.options : [option]));

// Which model does each job, and every AI call with what it took and cost.
export function AiSection() {
  const models = useModels();
  const choose = useChooseModel();
  const flash = useFlash();
  const options = optionsFor(models.data?.items ?? []);

  return (
    <SpaceBetween size="l">
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
                  selectedOption={flat(options).find((option) => option.value === chosen) ?? null}
                  options={options}
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
                        onError: (error) => flash({ type: 'error', content: describeError(error) }),
                      },
                    );
                  }}
                />
              </FormField>
            );
          })}
        </ColumnLayout>
      </Container>
      <UsageTable />
    </SpaceBetween>
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

const PAGE = 25;

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
    id: 'model',
    header: 'Model',
    sortingField: 'modelUsed',
    cell: (row) =>
      row.cacheHit
        ? `${row.modelUsed} · cached`
        : row.fallbacks
          ? `${row.modelUsed ?? '—'} · ${row.fallbacks} fallback${row.fallbacks > 1 ? 's' : ''}`
          : (row.modelUsed ?? '—'),
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
  { id: 'key', header: GROUP_LABEL[by], sortingField: 'key', cell: (row) => row.key },
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
          <Header
            variant="h2"
            counter={totals ? `(${num(totals.calls)})` : undefined}
            description={
              totals
                ? `${usd(totals.costUsd)} · ${num(totals.inputTokens)} input tokens (${num(totals.cacheReadTokens)} from the provider's cache) · ${num(totals.outputTokens)} output · ${num(totals.cacheHits)} answered from OneBox's cache · ${num(totals.failures)} failed`
                : 'Every AI call OneBox made for you.'
            }
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  iconName="refresh"
                  ariaLabel="Reload usage"
                  onClick={() => void usage.refetch()}
                />
                <SegmentedControl
                  label="Period"
                  selectedId={days}
                  onChange={({ detail }) => {
                    setDays(detail.selectedId);
                    setPage(1);
                  }}
                  options={[
                    { id: '1', text: 'Today' },
                    { id: '7', text: '7 days' },
                    { id: '30', text: '30 days' },
                    { id: '90', text: '90 days' },
                  ]}
                />
              </SpaceBetween>
            }
          >
            AI usage
          </Header>
        }
        filter={
          <div className={styles.toolbar}>
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
            <SegmentedControl
              label="Group by"
              selectedId={groupBy}
              onChange={({ detail }) => {
                const next = detail.selectedId as GroupBy;
                setGroupBy(next);
                setPage(1);
                setSorting(
                  next === 'none'
                    ? { field: 'createdAt', descending: true }
                    : { field: 'calls', descending: true },
                );
              }}
              options={(Object.keys(GROUP_LABEL) as GroupBy[]).map((id) => ({
                id,
                text: id === 'none' ? 'No grouping' : `By ${GROUP_LABEL[id].toLowerCase()}`,
              }))}
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
