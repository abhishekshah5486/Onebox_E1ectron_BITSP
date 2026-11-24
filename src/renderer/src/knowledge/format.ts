import type { Chunk, DateOrigin, KnowledgeRecord, RecordStatus } from '../api/knowledge';
import { FILE_KINDS, fileKind, type FileKind } from '../mail/attachments/fileTypes';

export const STATUS: Record<RecordStatus, { label: string; tone: Tone }> = {
  queued: { label: 'Queued', tone: 'blue' },
  in_progress: { label: 'Reading', tone: 'violet' },
  completed: { label: 'Searchable', tone: 'green' },
  empty: { label: 'No text', tone: 'amber' },
  failed: { label: 'Failed', tone: 'red' },
  file_type_not_supported: { label: 'Not supported', tone: 'amber' },
  password_protected: { label: 'Password protected', tone: 'amber' },
};

export type Tone = 'violet' | 'blue' | 'cyan' | 'green' | 'amber' | 'red' | 'gray';

export const isBusy = (status: RecordStatus) => status === 'queued' || status === 'in_progress';

export const DATE_ORIGIN: Record<DateOrigin, string> = {
  source: 'as sent',
  lastModified: "the file's last change",
  upload: 'when uploaded',
  content: 'as its header states',
};

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

const DAY = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export const formatDay = (iso: string | null | undefined) =>
  iso ? DAY.format(new Date(iso)) : '—';

export const kindOf = (name: string, mimeType: string): FileKind => fileKind(name, mimeType);
export const kindLabel = (kind: FileKind) => FILE_KINDS[kind].name;

export function sourceLabel(sourceType: string, sourceId: string) {
  if (sourceType === 'mail') return 'Mail';
  return sourceId === 'default' ? 'My files' : sourceId.replace(/[-_]+/g, ' ');
}

// Where a passage sits in its record, e.g. ["Page 4", "Returns › Parcels"].
export function locate(chunk: Chunk): string[] {
  const { citation } = chunk;
  const out: string[] = [];
  if (citation.page !== undefined) out.push(`Page ${citation.page}`);
  if (citation.slide !== undefined) out.push(`Slide ${citation.slide}`);
  if (citation.sheet !== undefined) out.push(`Sheet ${citation.sheet}`);
  if (citation.row !== undefined) out.push(`Row ${citation.row}`);
  if (citation.line !== undefined) out.push(`Line ${citation.line}`);
  if (citation.headingPath?.length) out.push(citation.headingPath.join(' › '));
  if (chunk.kind === 'summary') out.push('Summary');
  else if (chunk.kind === 'record') out.push('Whole record');
  else out.push(`Paragraph ${citation.blockIndex + 1}`);
  return out;
}

export const KIND_LABEL: Record<Chunk['kind'], string> = {
  block: 'Passage',
  list: 'List',
  table: 'Table',
  record: 'Whole record',
  summary: 'Summary',
  neighbour: 'Context',
};

export interface RecordHit {
  recordId: string;
  record: Chunk['record'];
  // In the order the search ranked them; the first is the best.
  chunks: { chunk: Chunk; ref: number }[];
  best: number;
}

// Passages grouped under their record, records in the order of their best passage; each passage
// keeps its reference number from the flat list.
export function byRecord(chunks: Chunk[]): RecordHit[] {
  const groups = new Map<string, RecordHit>();
  chunks.forEach((chunk, i) => {
    const id = chunk.record.recordId;
    const group = groups.get(id) ?? { recordId: id, record: chunk.record, chunks: [], best: 0 };
    group.chunks.push({ chunk, ref: i + 1 });
    group.best = Math.max(group.best, chunk.score);
    groups.set(id, group);
  });
  return [...groups.values()];
}

// Scores are relative within a search (rank fusion), so the best of the batch is 100%.
export function relevance(score: number, top: number) {
  if (top <= 0) return 0;
  return Math.max(1, Math.round((score / top) * 100));
}

// Words of the question, to mark in a passage.
export function terms(query: string) {
  return [
    ...new Set(
      query
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((word) => word.length > 2),
    ),
  ];
}

export function recordDates(record: KnowledgeRecord) {
  const created = record.sourceCreatedAt ?? record.createdAt;
  return { created, modified: record.sourceModifiedAt ?? created };
}
