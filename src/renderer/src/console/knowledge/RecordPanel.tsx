import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import KeyValuePairs from '@cloudscape-design/components/key-value-pairs';
import Link from '@cloudscape-design/components/link';
import SpaceBetween from '@cloudscape-design/components/space-between';
import SplitPanel from '@cloudscape-design/components/split-panel';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Tabs from '@cloudscape-design/components/tabs';
import { useState, type ReactNode } from 'react';
import { useRecordDetails, type RecordDetails } from '../../api/hub';
import { useRecordRead } from '../../api/knowledge';
import { formatSize } from '../../knowledge/format';
import { STATUS, formatWhen, upper } from './parts';
import { Banner } from './Banner';
import { FlowLoader } from './Sparkle';

const STAGE_LABEL = { parse: 'Reading', index: 'Indexing', classify: 'Summary' } as const;

export function stageIndicator(status: string) {
  const known = STATUS[status as keyof typeof STATUS];
  if (known) return <StatusIndicator type={known.type}>{known.label}</StatusIndicator>;
  const label = status.replace(/_/g, ' ').toLowerCase();
  const type = status === 'SKIPPED' || status === 'DEFERRED' ? 'stopped' : 'pending';
  return <StatusIndicator type={type}>{label[0]!.toUpperCase() + label.slice(1)}</StatusIndicator>;
}

// An email's attachments, each with its state (and why one wasn't read), opening in this panel.
function Attachments({ record, onOpen }: { record: RecordDetails; onOpen: (id: string) => void }) {
  const items = record.attachments ?? [];
  if (items.length === 0) return null;
  return (
    <KeyValuePairs
      columns={1}
      items={[
        {
          label: `Attachments (${items.length})`,
          value: (
            <SpaceBetween size="xs">
              {items.map((a) => (
                <SpaceBetween key={a.id} direction="horizontal" size="xs" alignItems="center">
                  <Link
                    href={`#${a.id}`}
                    onFollow={(e) => {
                      e.preventDefault();
                      onOpen(a.id);
                    }}
                  >
                    {a.name}
                  </Link>
                  {stageIndicator(upper(a.status))}
                  <Box color="text-body-secondary" fontSize="body-s">
                    {[formatSize(a.sizeBytes), a.reason].filter(Boolean).join(' · ')}
                  </Box>
                </SpaceBetween>
              ))}
            </SpaceBetween>
          ),
        },
      ]}
    />
  );
}

// A state and, under it, why (once).
function withReason(state: ReactNode, reason: string | null | undefined) {
  return reason ? (
    <SpaceBetween size="xxxs">
      {state}
      <Box color="text-body-secondary" fontSize="body-s">
        {reason}
      </Box>
    </SpaceBetween>
  ) : (
    state
  );
}

const SETTLED = new Set([
  'COMPLETED',
  'EMPTY',
  'FILE_TYPE_NOT_SUPPORTED',
  'PASSWORD_PROTECTED',
  'FAILED',
]);

// What a record is: its name, id, type, size, times and where it lives.
export function RecordFacts({
  record,
  onOpen,
  columns = 2,
  withStatus = true,
}: {
  record: RecordDetails;
  onOpen: (id: string) => void;
  columns?: 1 | 2 | 3 | 4;
  withStatus?: boolean;
}) {
  const place = [record.collection?.name, ...(record.folderPath ?? []).map((f) => f.name)]
    .filter(Boolean)
    .join(' / ');
  return (
    <KeyValuePairs
      columns={columns}
      items={[
        { label: 'Name', value: record.name },
        { label: 'Record ID', value: record.id },
        { label: 'Record type', value: record.recordType === 'MAIL' ? 'Mail' : 'File' },
        // An email's origin is mail, as its type says.
        ...(record.recordType === 'MAIL'
          ? []
          : [{ label: 'Origin', value: record.origin === 'UPLOAD' ? 'Upload' : 'Mail' }]),
        ...(withStatus
          ? [
              {
                label: 'Indexing status',
                value: withReason(stageIndicator(upper(record.status)), record.reason),
              },
            ]
          : []),
        { label: 'Version', value: record.version },
        { label: 'Size', value: formatSize(record.sizeBytes) },
        { label: 'Type', value: record.mimeType },
        { label: 'Created at (UTC)', value: formatWhen(record.createdAt) },
        { label: 'Updated at (UTC)', value: formatWhen(record.updatedAt) },
        ...(place ? [{ label: 'Collection', value: place }] : []),
        ...(record.attachedTo
          ? [
              {
                label: 'Attached to',
                value: (
                  <Link
                    href={`#${record.attachedTo.id}`}
                    onFollow={(e) => {
                      e.preventDefault();
                      onOpen(record.attachedTo!.id);
                    }}
                  >
                    {record.attachedTo.name}
                  </Link>
                ),
              },
            ]
          : []),
        { label: 'Permissions', value: record.permissions[0]?.relationship ?? 'OWNER' },
      ]}
    />
  );
}

// How indexing went: each step that says more than the status, and what it produced.
export function RecordIndexing({
  record,
  withStatus = false,
  columns = 3,
}: {
  record: RecordDetails;
  withStatus?: boolean;
  columns?: 1 | 2 | 3 | 4;
}) {
  const status = upper(record.status);
  // Not a step that repeats the status, nor one that will never start now that the record
  // has settled short of being indexed.
  const stages = (record.stageStates ?? []).filter(
    (s) =>
      !(s.status === status && (s.reason ?? null) === (record.reason ?? null)) &&
      !(SETTLED.has(status) && status !== 'COMPLETED' && s.status === 'NOT_STARTED'),
  );
  const facts = [
    { label: 'Blocks', value: record.blockCount },
    { label: 'Read with', value: record.engine },
    { label: 'Search points', value: record.pointCount },
  ].filter((f) => f.value !== undefined && f.value !== null);
  const items = [
    ...(withStatus
      ? [{ label: 'Status', value: withReason(stageIndicator(status), record.reason) }]
      : []),
    ...stages.map((s) => ({
      label: STAGE_LABEL[s.stage],
      value: withReason(stageIndicator(s.status), s.reason === record.reason ? null : s.reason),
    })),
    ...facts,
  ];
  return items.length > 0 ? <KeyValuePairs columns={columns} items={items} /> : null;
}

export function RecordSummary({ record }: { record: RecordDetails }) {
  const c = record.classification;
  if (!c) return null;
  return (
    <KeyValuePairs
      columns={1}
      items={[
        { label: 'Summary', value: c.summary },
        ...(c.category ? [{ label: 'Category', value: c.category }] : []),
        ...(c.topics?.length ? [{ label: 'Topics', value: c.topics.join(', ') }] : []),
        ...(c.languages?.length ? [{ label: 'Languages', value: c.languages.join(', ') }] : []),
      ]}
    />
  );
}

function Details({ record, onOpen }: { record: RecordDetails; onOpen: (id: string) => void }) {
  return (
    <SpaceBetween size="l">
      <RecordFacts record={record} onOpen={onOpen} />
      <Attachments record={record} onOpen={onOpen} />
      <RecordIndexing record={record} />
      <RecordSummary record={record} />
    </SpaceBetween>
  );
}

export function Preview({ id }: { id: string }) {
  const read = useRecordRead(id, '');
  if (read.isPending) return <FlowLoader label="Loading preview" />;
  if (read.isError || !read.data) return <Box color="text-status-inactive">No preview yet.</Box>;
  if (read.data.blocks.length === 0)
    return <Box color="text-status-inactive">Nothing read from this file yet.</Box>;
  return (
    <SpaceBetween size="s">
      {read.data.blocks.map((block) => (
        <Box key={block.index} variant={block.isHeader ? 'h4' : 'p'}>
          {block.text}
        </Box>
      ))}
      {read.data.next !== null && (
        <Banner tone="info" header="Partial preview">
          Showing the first {read.data.blocks.length} of {read.data.total} blocks. Search covers the
          full text.
        </Banner>
      )}
    </SpaceBetween>
  );
}

export function RecordPanel({
  id,
  onDownload,
  onOpen,
}: {
  id: string;
  onDownload: (record: RecordDetails) => void;
  onOpen: (id: string) => void;
}) {
  const details = useRecordDetails(id);
  const [tab, setTab] = useState('details');
  const record = details.data;
  return (
    <SplitPanel
      header={record?.name ?? 'Record'}
      headerActions={
        record && (
          <Button iconName="download" onClick={() => onDownload(record)}>
            {record.recordType === 'MAIL' ? 'Open email' : 'Download'}
          </Button>
        )
      }
      closeBehavior="hide"
    >
      {details.isPending ? (
        <FlowLoader label="Loading record" />
      ) : !record ? (
        <Box>This record is no longer here.</Box>
      ) : (
        <Tabs
          activeTabId={tab}
          onChange={({ detail }) => setTab(detail.activeTabId)}
          tabs={[
            { id: 'preview', label: 'Preview', content: <Preview id={record.id} /> },
            {
              id: 'details',
              label: 'File details',
              content: <Details record={record} onOpen={onOpen} />,
            },
          ]}
        />
      )}
    </SplitPanel>
  );
}
