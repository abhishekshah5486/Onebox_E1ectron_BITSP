import Icon from '@cloudscape-design/components/icon';
import StatusIndicator, {
  type StatusIndicatorProps,
} from '@cloudscape-design/components/status-indicator';
import type { HubNode, IndexingStatus } from '../../api/hub';
import { formatSize } from '../../knowledge/format';

export const STATUS: Record<IndexingStatus, { label: string; type: StatusIndicatorProps.Type }> = {
  QUEUED: { label: 'Queued', type: 'pending' },
  IN_PROGRESS: { label: 'In progress', type: 'in-progress' },
  COMPLETED: { label: 'Completed', type: 'success' },
  EMPTY: { label: 'Empty', type: 'stopped' },
  FILE_TYPE_NOT_SUPPORTED: { label: 'File type not supported', type: 'warning' },
  PASSWORD_PROTECTED: { label: 'Password protected', type: 'warning' },
  FAILED: { label: 'Failed', type: 'error' },
};

export const STATUS_ORDER = Object.keys(STATUS) as IndexingStatus[];

export function NodeStatus({ node }: { node: Pick<HubNode, 'indexingStatus' | 'reason'> }) {
  if (!node.indexingStatus) return <>-</>;
  const status = STATUS[node.indexingStatus];
  return (
    <span title={node.reason ?? undefined}>
      <StatusIndicator type={status.type}>{status.label}</StatusIndicator>
    </span>
  );
}

// A record's status as stored in lower case (the records API).
export const upper = (status: string) => status.toUpperCase() as IndexingStatus;

export function NodeIcon({ node }: { node: HubNode }) {
  if (node.nodeType === 'folder' || node.nodeType === 'collection')
    return <Icon name="folder" variant="subtle" />;
  if (node.nodeType === 'mailbox' || node.recordType === 'MAIL')
    return <Icon name="envelope" variant="subtle" />;
  return <Icon name="file" variant="subtle" />;
}

export const nodeSize = (node: HubNode) =>
  node.sizeInBytes !== undefined && node.nodeType === 'record' ? formatSize(node.sizeInBytes) : '-';

// Times in UTC; the column or label says so.
const UTC = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'UTC',
});

export const formatWhen = (when: string | number | null | undefined) =>
  when ? UTC.format(new Date(when)) : '-';
export const formatMs = formatWhen;

export const SIZE_RANGES = [
  { value: 'lt1mb', label: '< 1 MB', bounds: [null, 1024 * 1024 - 1] },
  { value: '1to10mb', label: '1–10 MB', bounds: [1024 * 1024, 10 * 1024 * 1024] },
  { value: '10to100mb', label: '10–100 MB', bounds: [10 * 1024 * 1024, 100 * 1024 * 1024] },
] as const;

// The message an API error carries, or a plain one.
export function problem(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
