import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import KeyValuePairs from '@cloudscape-design/components/key-value-pairs';
import Link from '@cloudscape-design/components/link';
import SpaceBetween from '@cloudscape-design/components/space-between';
import SplitPanel from '@cloudscape-design/components/split-panel';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Tabs from '@cloudscape-design/components/tabs';
import { useState } from 'react';
import { useRecordDetails, type RecordDetails } from '../../api/hub';
import { useRecordRead } from '../../api/knowledge';
import { formatSize } from '../../knowledge/format';
import { STATUS, formatWhen, upper } from './parts';
import { FlowLoader } from './Sparkle';

const STAGE_LABEL = { parse: 'Reading', index: 'Indexing', classify: 'Summary' } as const;

function stageIndicator(status: string) {
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

function Details({ record, onOpen }: { record: RecordDetails; onOpen: (id: string) => void }) {
  const place = [record.collection?.name, ...(record.folderPath ?? []).map((f) => f.name)]
    .filter(Boolean)
    .join(' / ');
  const c = record.classification;
  return (
    <SpaceBetween size="l">
      <KeyValuePairs
        columns={2}
        items={[
          { label: 'Name', value: record.name },
          { label: 'Record ID', value: <Box variant="code">{record.id}</Box> },
          { label: 'Record type', value: record.recordType === 'MAIL' ? 'Mail' : 'File' },
          { label: 'Origin', value: record.origin === 'UPLOAD' ? 'Upload' : 'Mail' },
          {
            label: 'Indexing status',
            value: stageIndicator(upper(record.status)),
            info: record.reason ?? undefined,
          },
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
      <Attachments record={record} onOpen={onOpen} />
      {record.reason && (
        <Box color="text-status-error" variant="p">
          {record.reason}
        </Box>
      )}
      <KeyValuePairs
        columns={3}
        items={(record.stageStates ?? []).map((s) => ({
          label: STAGE_LABEL[s.stage],
          value: stageIndicator(s.status),
          info: s.reason ?? undefined,
        }))}
      />
      {(record.blockCount !== undefined || record.engine) && (
        <KeyValuePairs
          columns={3}
          items={[
            { label: 'Blocks', value: record.blockCount ?? '-' },
            { label: 'Read with', value: record.engine ?? '-' },
            { label: 'Search points', value: record.pointCount ?? '-' },
          ]}
        />
      )}
      {c && (
        <KeyValuePairs
          columns={1}
          items={[
            { label: 'Summary', value: c.summary },
            ...(c.category ? [{ label: 'Category', value: c.category }] : []),
            ...(c.topics?.length ? [{ label: 'Topics', value: c.topics.join(', ') }] : []),
            ...(c.languages?.length ? [{ label: 'Languages', value: c.languages.join(', ') }] : []),
          ]}
        />
      )}
    </SpaceBetween>
  );
}

function Preview({ id }: { id: string }) {
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
        <Box color="text-body-secondary" fontSize="body-s">
          Showing the first {read.data.blocks.length} of {read.data.total} blocks.
        </Box>
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
