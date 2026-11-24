import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import {
  useDeleteRecord,
  useRecordsPage,
  useReindex,
  type KnowledgeRecord,
  type RecordQuery,
  type RecordSort,
  type RecordStatus,
} from '../api/knowledge';
import { Dialog } from '../ui/Dialog';
import { Icon } from '../ui/Icon';
import { useNotify } from '../ui/useNotify';
import type { FileKind } from '../mail/attachments/fileTypes';
import {
  STATUS,
  formatDay,
  formatSize,
  isBusy,
  kindLabel,
  kindOf,
  recordDates,
  sourceLabel,
} from './format';
import { Chip, FileIcon } from './parts';
import { UploadPanel } from './Upload';
import styles from './Knowledge.module.css';

const PAGE = 25;

const SIZES = [
  { key: 'xs', label: 'Under 100 KB', max: 100 * 1024 },
  { key: 's', label: '100 KB – 1 MB', min: 100 * 1024, max: 1024 * 1024 },
  { key: 'm', label: '1 – 10 MB', min: 1024 * 1024, max: 10 * 1024 * 1024 },
  { key: 'l', label: 'Over 10 MB', min: 10 * 1024 * 1024 },
] as const;

interface Filters {
  kinds: FileKind[];
  // The kinds' MIME types, fixed when the filters are applied.
  mimeTypes: string[];
  statuses: RecordStatus[];
  size: (typeof SIZES)[number]['key'] | null;
  createdAfter: string;
  createdBefore: string;
  modifiedAfter: string;
  modifiedBefore: string;
}

const NONE: Filters = {
  kinds: [],
  mimeTypes: [],
  statuses: [],
  size: null,
  createdAfter: '',
  createdBefore: '',
  modifiedAfter: '',
  modifiedBefore: '',
};

const active = (f: Filters) => JSON.stringify(f) !== JSON.stringify(NONE);

function Menu({
  label,
  icon,
  on,
  children,
}: {
  label: string;
  icon: Parameters<typeof Icon>[0]['name'];
  on: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <div className={styles.menuBox} ref={box}>
      <button
        type="button"
        className={`${styles.filter} ${on ? styles.filterOn : ''}`}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Icon name={icon} size={15} />
        {label}
        <Icon name="expand" size={15} />
      </button>
      {open && <div className={styles.popover}>{children}</div>}
    </div>
  );
}

function Check({
  on,
  onChange,
  children,
}: {
  on: boolean;
  onChange: () => void;
  children: ReactNode;
}) {
  return (
    <label className={styles.option}>
      <input type="checkbox" checked={on} onChange={onChange} />
      {children}
    </label>
  );
}

const toggle = <T,>(list: T[], item: T) =>
  list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

function Range({
  after,
  before,
  onChange,
}: {
  after: string;
  before: string;
  onChange: (after: string, before: string) => void;
}) {
  return (
    <div className={styles.range}>
      <label>
        From
        <input
          type="date"
          className={styles.input}
          value={after}
          onChange={(e) => onChange(e.target.value, before)}
        />
      </label>
      <label>
        To
        <input
          type="date"
          className={styles.input}
          value={before}
          onChange={(e) => onChange(after, e.target.value)}
        />
      </label>
    </div>
  );
}

const COLUMNS: { key: RecordSort | null; label: string; className?: string }[] = [
  { key: 'name', label: 'Name' },
  { key: null, label: 'Status' },
  { key: null, label: 'Source' },
  { key: 'sizeBytes', label: 'Size', className: styles.num },
  { key: 'sourceCreatedAt', label: 'Created' },
  { key: 'sourceModifiedAt', label: 'Updated' },
];

export function RecordsView({
  sourceType,
  sourceId,
  onPreview,
  onOpen,
}: {
  sourceType?: 'upload' | 'mail';
  sourceId?: string;
  onPreview: (recordId: string) => void;
  onOpen: (record: KnowledgeRecord) => void;
}) {
  const navigate = useNavigate();
  const notify = useNotify();
  const [find, setFind] = useState('');
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState<Filters>(NONE);
  const [applied, setApplied] = useState<Filters>(NONE);
  const [sort, setSort] = useState<RecordSort>('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string[] | null>(null);
  const reindex = useReindex();
  const remove = useDeleteRecord();

  // Typing in Find narrows the list after a short pause.
  useEffect(() => {
    const timer = setTimeout(() => setQ(find.trim()), 300);
    return () => clearTimeout(timer);
  }, [find]);
  // Another list starts on its first page with nothing selected.
  const listKey = JSON.stringify([q, applied, sort, order, sourceType, sourceId]);
  const [shownKey, setShownKey] = useState(listKey);
  if (shownKey !== listKey) {
    setShownKey(listKey);
    setOffset(0);
    setSelected(new Set());
  }
  const size = SIZES.find((s) => s.key === applied.size);
  const query: RecordQuery = {
    ...(q && { q }),
    ...(sourceType && { sourceType: [sourceType] }),
    ...(sourceId && { sourceId: [sourceId] }),
    ...(applied.statuses.length > 0 && { status: applied.statuses }),
    ...(applied.kinds.length > 0 && {
      mimeType: applied.mimeTypes,
    }),
    ...(size && 'min' in size && { minSize: size.min }),
    ...(size && 'max' in size && { maxSize: size.max }),
    ...(applied.createdAfter && { createdAfter: applied.createdAfter }),
    ...(applied.createdBefore && { createdBefore: applied.createdBefore }),
    ...(applied.modifiedAfter && { modifiedAfter: applied.modifiedAfter }),
    ...(applied.modifiedBefore && { modifiedBefore: applied.modifiedBefore }),
    sort,
    order,
    offset,
    limit: PAGE,
  };
  const page = useRecordsPage(query);
  const records = page.data?.records ?? [];
  const total = page.data?.total ?? 0;
  const statuses = page.data?.available.statuses ?? {};
  // The user's file types, to filter by; a type picks all of its MIME types.
  const mimeTypes = page.data?.available.mimeTypes;
  const kindsByMime = useMemo(() => {
    const kinds = new Map<FileKind, string[]>();
    for (const mime of Object.keys(mimeTypes ?? {})) {
      const kind = kindOf('', mime);
      kinds.set(kind, [...(kinds.get(kind) ?? []), mime]);
    }
    return kinds;
  }, [mimeTypes]);

  const allOnPage = records.length > 0 && records.every((r) => selected.has(r.id));
  const sortBy = (key: RecordSort) => {
    if (sort === key) setOrder(order === 'asc' ? 'desc' : 'asc');
    else {
      setSort(key);
      setOrder(key === 'name' ? 'asc' : 'desc');
    }
  };

  const runReindex = (ids: string[]) =>
    reindex.mutate(ids, {
      onSuccess: ({ queued, skipped }) => {
        setSelected(new Set());
        notify({
          type: queued.length ? 'success' : 'warning',
          content: [
            queued.length &&
              `${queued.length} ${queued.length === 1 ? 'record is' : 'records are'} being read again.`,
            skipped.length &&
              `${skipped.length} skipped: ${[...new Set(skipped.map((s) => s.reason))].join('; ')}.`,
          ]
            .filter(Boolean)
            .join(' '),
        });
      },
      onError: () => notify({ type: 'error', content: 'Re-indexing failed.' }),
    });

  const runDelete = async (ids: string[]) => {
    setDeleting(null);
    const results = await Promise.allSettled(ids.map((id) => remove.mutateAsync(id)));
    const failed = results.filter((r) => r.status === 'rejected').length;
    setSelected(new Set());
    notify({
      type: failed ? 'error' : 'success',
      content: failed
        ? `${failed} of ${ids.length} could not be deleted.`
        : `Deleted ${ids.length} ${ids.length === 1 ? 'record' : 'records'}.`,
    });
  };

  const title =
    sourceType === 'mail' ? 'Mail' : sourceId ? sourceLabel('upload', sourceId) : 'All records';
  const filtersOn = active(applied);
  const dirty =
    JSON.stringify({ ...draft, mimeTypes: [] }) !== JSON.stringify({ ...applied, mimeTypes: [] });

  return (
    <div className={styles.wide}>
      <div className={styles.tableHead}>
        <div>
          <h2 className={styles.viewTitle}>{title}</h2>
          <p className={styles.viewText}>
            Everything the search reads: your uploads, your mail and their attachments, with how far
            each has got.
          </p>
        </div>
        <div className={styles.headActions}>
          <label className={styles.find}>
            <Icon name="search" size={16} />
            <input
              placeholder="Find by name"
              value={find}
              onChange={(e) => setFind(e.target.value)}
              aria-label="Find by name"
            />
          </label>
          <button type="button" className={styles.secondary} onClick={() => void page.refetch()}>
            <Icon name="refresh" size={16} />
            Refresh
          </button>
          {sourceType !== 'mail' && (
            <button
              type="button"
              className={styles.primary}
              onClick={() => setUploading(!uploading)}
            >
              <Icon name="add" size={16} />
              Upload
            </button>
          )}
        </div>
      </div>

      {uploading && (
        <UploadPanel {...(sourceId && { initial: sourceId })} onDone={() => setUploading(false)} />
      )}

      <div className={styles.filterBar}>
        <Icon name="tune" size={18} />
        <Menu label="Type" icon="draft" on={draft.kinds.length > 0}>
          {[...kindsByMime.keys()].length === 0 && (
            <span className={styles.muted}>No files yet</span>
          )}
          {[...kindsByMime.keys()].map((kind) => (
            <Check
              key={kind}
              on={draft.kinds.includes(kind)}
              onChange={() => setDraft({ ...draft, kinds: toggle(draft.kinds, kind) })}
            >
              {kindLabel(kind)}
            </Check>
          ))}
        </Menu>
        <Menu label="Status" icon="schedule" on={draft.statuses.length > 0}>
          {(Object.keys(STATUS) as RecordStatus[]).map((status) => (
            <Check
              key={status}
              on={draft.statuses.includes(status)}
              onChange={() => setDraft({ ...draft, statuses: toggle(draft.statuses, status) })}
            >
              {STATUS[status].label}
              <span className={styles.optionCount}>{statuses[status] ?? 0}</span>
            </Check>
          ))}
        </Menu>
        <Menu label="Size" icon="archive" on={draft.size !== null}>
          {SIZES.map((s) => (
            <label key={s.key} className={styles.option}>
              <input
                type="radio"
                name="size"
                checked={draft.size === s.key}
                onChange={() => setDraft({ ...draft, size: s.key })}
              />
              {s.label}
            </label>
          ))}
          {draft.size && (
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => setDraft({ ...draft, size: null })}
            >
              Any size
            </button>
          )}
        </Menu>
        <Menu
          label="Date created"
          icon="schedule"
          on={Boolean(draft.createdAfter || draft.createdBefore)}
        >
          <Range
            after={draft.createdAfter}
            before={draft.createdBefore}
            onChange={(a, b) => setDraft({ ...draft, createdAfter: a, createdBefore: b })}
          />
        </Menu>
        <Menu
          label="Last updated"
          icon="schedule"
          on={Boolean(draft.modifiedAfter || draft.modifiedBefore)}
        >
          <Range
            after={draft.modifiedAfter}
            before={draft.modifiedBefore}
            onChange={(a, b) => setDraft({ ...draft, modifiedAfter: a, modifiedBefore: b })}
          />
        </Menu>
        {dirty && (
          <button
            type="button"
            className={styles.apply}
            onClick={() =>
              setApplied({
                ...draft,
                mimeTypes: draft.kinds.flatMap((k) => kindsByMime.get(k) ?? []),
              })
            }
          >
            Apply
          </button>
        )}
        {(filtersOn || dirty) && (
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => {
              setDraft(NONE);
              setApplied(NONE);
            }}
          >
            Reset
          </button>
        )}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.checkCell}>
                <input
                  type="checkbox"
                  aria-label="Select all on this page"
                  checked={allOnPage}
                  onChange={() =>
                    setSelected(
                      allOnPage ? new Set() : new Set([...selected, ...records.map((r) => r.id)]),
                    )
                  }
                />
              </th>
              {COLUMNS.map((column) => (
                <th key={column.label} className={column.className}>
                  {column.key ? (
                    <button
                      type="button"
                      className={styles.sort}
                      onClick={() => sortBy(column.key!)}
                    >
                      {column.label}
                      {sort === column.key && (
                        <span className={order === 'asc' ? styles.sortUp : styles.sortDown}>▾</span>
                      )}
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              ))}
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {records.map((record) => {
              const status = STATUS[record.status];
              const dates = recordDates(record);
              return (
                <tr
                  key={record.id}
                  className={selected.has(record.id) ? styles.rowSelected : undefined}
                >
                  <td className={styles.checkCell}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${record.name}`}
                      checked={selected.has(record.id)}
                      onChange={() => {
                        const next = new Set(selected);
                        if (next.has(record.id)) next.delete(record.id);
                        else next.add(record.id);
                        setSelected(next);
                      }}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className={styles.nameCell}
                      onClick={() => onPreview(record.id)}
                    >
                      <FileIcon name={record.name} mimeType={record.mimeType} />
                      <span className={styles.nameText}>{record.name}</span>
                      {record.parentId && <Chip>Attachment</Chip>}
                    </button>
                  </td>
                  <td>
                    <span className={isBusy(record.status) ? styles.pulse : undefined}>
                      <Chip tone={status.tone} {...(record.reason && { title: record.reason })}>
                        {status.label}
                      </Chip>
                    </span>
                  </td>
                  <td className={styles.muted}>
                    {sourceLabel(record.sourceType, record.sourceId)}
                  </td>
                  <td className={`${styles.num} ${styles.muted}`}>
                    {formatSize(record.sizeBytes)}
                  </td>
                  <td className={styles.muted}>{formatDay(dates.created)}</td>
                  <td className={styles.muted}>{formatDay(dates.modified)}</td>
                  <td className={styles.rowActions}>
                    <button
                      type="button"
                      className={styles.iconButton}
                      title={record.mail?.threadId ? 'Open email' : 'Download'}
                      onClick={() => onOpen(record)}
                    >
                      <Icon name="download" size={18} />
                    </button>
                    <button
                      type="button"
                      className={styles.iconButton}
                      title="Read again"
                      onClick={() => runReindex([record.id])}
                    >
                      <Icon name="refresh" size={18} />
                    </button>
                    <button
                      type="button"
                      className={styles.iconButton}
                      title="Delete"
                      onClick={() => setDeleting([record.id])}
                    >
                      <Icon name="delete" size={18} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {page.isLoading && <div className={styles.shimmer} />}
        {page.isError && <div className={styles.error}>The records couldn't be loaded.</div>}
        {page.data && records.length === 0 && (
          <div className={styles.empty}>
            {q || filtersOn
              ? 'Nothing matches these filters.'
              : 'Nothing here yet. Upload files to search them.'}
          </div>
        )}
      </div>

      <div className={styles.pager}>
        <span className={styles.muted}>
          {total === 0
            ? 'No items'
            : `Showing ${offset + 1}–${Math.min(offset + PAGE, total)} of ${total} items`}
        </span>
        <button
          type="button"
          className={styles.secondary}
          disabled={offset === 0}
          onClick={() => setOffset(Math.max(0, offset - PAGE))}
        >
          Previous
        </button>
        <span className={styles.pageNumber}>{Math.floor(offset / PAGE) + 1}</span>
        <button
          type="button"
          className={styles.secondary}
          disabled={offset + PAGE >= total}
          onClick={() => setOffset(offset + PAGE)}
        >
          Next
        </button>
      </div>

      {selected.size > 0 && (
        <div className={styles.selectionBar} role="toolbar" aria-label="Selected records">
          <span>{selected.size} selected</span>
          <button
            type="button"
            className={styles.solid}
            onClick={() =>
              void navigate(
                `/knowledge?${new URLSearchParams({ records: [...selected].join(',') })}`,
              )
            }
          >
            <Icon name="search" size={15} />
            Search in these
          </button>
          <button
            type="button"
            className={styles.ghost}
            onClick={() => runReindex([...selected])}
            disabled={reindex.isPending}
          >
            <Icon name="refresh" size={15} />
            Re-index
          </button>
          <button type="button" className={styles.ghost} onClick={() => setDeleting([...selected])}>
            <Icon name="delete" size={15} />
            Delete
          </button>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Clear selection"
            onClick={() => setSelected(new Set())}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}

      {deleting && (
        <Dialog
          title={
            deleting.length === 1 ? 'Delete this record?' : `Delete ${deleting.length} records?`
          }
          confirmLabel="Delete"
          onConfirm={() => void runDelete(deleting)}
          onCancel={() => setDeleting(null)}
        >
          It is removed from search, with its attachments. An email stays in your mailbox.
        </Dialog>
      )}
    </div>
  );
}
