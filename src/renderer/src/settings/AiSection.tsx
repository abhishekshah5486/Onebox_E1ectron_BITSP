import Box from '@cloudscape-design/components/box';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Container from '@cloudscape-design/components/container';
import FormField from '@cloudscape-design/components/form-field';
import Header from '@cloudscape-design/components/header';
import KeyValuePairs from '@cloudscape-design/components/key-value-pairs';
import SegmentedControl from '@cloudscape-design/components/segmented-control';
import Select, { type SelectProps } from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Table from '@cloudscape-design/components/table';
import { useState, type ReactElement } from 'react';
import {
  AUTO_MODEL,
  useChooseModel,
  useModels,
  useUsage,
  type ModelOption,
  type ModelProvider,
  type ModelPurpose,
} from '../api/ai';
import { describeError } from '../auth/errors';
import { useFlash } from './flash';

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

// Which model does each job, and what the AI work has cost in calls and tokens.
export function AiSection() {
  const models = useModels();
  const choose = useChooseModel();
  const flash = useFlash();
  const [days, setDays] = useState('30');
  const usage = useUsage(Number(days));
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
                  disabled={choose.isPending}
                  ariaLabel={`Model for ${PURPOSE[purpose].label.toLowerCase()}`}
                  onChange={({ detail }) =>
                    choose.mutate(
                      { purpose, modelId: detail.selectedOption.value ?? AUTO_MODEL },
                      {
                        onError: (error) => flash({ type: 'error', content: describeError(error) }),
                      },
                    )
                  }
                />
              </FormField>
            );
          })}
        </ColumnLayout>
      </Container>

      <Container
        header={
          <Header
            variant="h2"
            description="Every AI call OneBox made for you. Repeated questions are answered from the cache."
            actions={
              <SegmentedControl
                label="Period"
                selectedId={days}
                onChange={({ detail }) => setDays(detail.selectedId)}
                options={[
                  { id: '1', text: 'Today' },
                  { id: '7', text: '7 days' },
                  { id: '30', text: '30 days' },
                ]}
              />
            }
          >
            Usage
          </Header>
        }
      >
        <SpaceBetween size="l">
          <KeyValuePairs
            columns={5}
            items={[
              { label: 'Calls', value: (usage.data?.totals.calls ?? 0).toLocaleString() },
              {
                label: 'Input tokens',
                value: (usage.data?.totals.inputTokens ?? 0).toLocaleString(),
              },
              {
                label: 'Output tokens',
                value: (usage.data?.totals.outputTokens ?? 0).toLocaleString(),
              },
              { label: 'From cache', value: (usage.data?.totals.cacheHits ?? 0).toLocaleString() },
              { label: 'Failed', value: (usage.data?.totals.failures ?? 0).toLocaleString() },
            ]}
          />
          <Table
            variant="embedded"
            header={<Header variant="h3">By model</Header>}
            loading={usage.isPending}
            loadingText="Loading usage"
            items={usage.data?.byModel ?? []}
            empty={<Box color="text-status-inactive">No AI calls in this period.</Box>}
            columnDefinitions={[
              { id: 'model', header: 'Model', cell: (row) => row.model },
              { id: 'calls', header: 'Calls', cell: (row) => row.calls.toLocaleString() },
              { id: 'in', header: 'Input tokens', cell: (row) => row.inputTokens.toLocaleString() },
              {
                id: 'out',
                header: 'Output tokens',
                cell: (row) => row.outputTokens.toLocaleString(),
              },
              { id: 'cache', header: 'From cache', cell: (row) => row.cacheHits.toLocaleString() },
            ]}
          />
          <Table
            variant="embedded"
            header={<Header variant="h3">Recent calls</Header>}
            items={usage.data?.recent ?? []}
            empty={<Box color="text-status-inactive">Nothing yet.</Box>}
            columnDefinitions={[
              {
                id: 'when',
                header: 'When',
                cell: (row) => new Date(row.createdAt).toLocaleString(),
              },
              {
                id: 'purpose',
                header: 'For',
                cell: (row) => PURPOSE[row.purpose as ModelPurpose]?.label ?? row.purpose,
              },
              {
                id: 'model',
                header: 'Model',
                cell: (row) =>
                  row.cacheHit
                    ? `${row.modelUsed} (cache)`
                    : row.fallbacks
                      ? `${row.modelUsed ?? '—'} (after ${row.fallbacks} fallback${row.fallbacks > 1 ? 's' : ''})`
                      : (row.modelUsed ?? '—'),
              },
              {
                id: 'tokens',
                header: 'Tokens in / out',
                cell: (row) => `${row.inputTokens} / ${row.outputTokens}`,
              },
              {
                id: 'time',
                header: 'Time',
                cell: (row) => `${(row.latencyMs / 1000).toFixed(1)} s`,
              },
              {
                id: 'status',
                header: 'Result',
                cell: (row) =>
                  row.status === 'ok' ? (
                    <StatusIndicator type="success">OK</StatusIndicator>
                  ) : (
                    <StatusIndicator type="error">Failed</StatusIndicator>
                  ),
              },
            ]}
          />
        </SpaceBetween>
      </Container>
    </SpaceBetween>
  );
}
