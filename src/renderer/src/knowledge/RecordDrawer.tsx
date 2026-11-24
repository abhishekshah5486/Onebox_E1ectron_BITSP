import { useEffect, useMemo, useRef, useState } from 'react';
import { useKnowledgeRecord, useRecordRead, type KnowledgeRecord } from '../api/knowledge';
import { Icon } from '../ui/Icon';
import {
  DATE_ORIGIN,
  STATUS,
  formatDay,
  formatSize,
  isBusy,
  kindLabel,
  kindOf,
  recordDates,
  sourceLabel,
  terms,
} from './format';
import { Chip, FileIcon, Marked, Sparkles } from './parts';
import type { Focus } from './results';
import styles from './Knowledge.module.css';

type StepState = 'done' | 'active' | 'waiting' | 'failed' | 'skipped';

// Read → Searchable → Summarized, as the pipeline runs them.
function stages(record: KnowledgeRecord): { label: string; state: StepState; hint?: string }[] {
  const failed = !isBusy(record.status) && record.status !== 'completed';
  const read: StepState =
    record.stage === 'parse'
      ? failed
        ? 'failed'
        : isBusy(record.status)
          ? 'active'
          : 'done'
      : 'done';
  const searchable: StepState =
    record.status === 'completed'
      ? 'done'
      : record.stage === 'index'
        ? failed
          ? 'failed'
          : 'active'
        : 'waiting';
  const summary = record.classifyStatus;
  const summarized: StepState =
    summary === 'completed'
      ? 'done'
      : summary === 'queued'
        ? 'active'
        : summary === 'failed'
          ? 'failed'
          : summary === 'skipped' || summary === 'deferred'
            ? 'skipped'
            : 'waiting';
  return [
    {
      label: 'Read',
      state: read,
      ...(read === 'failed' && record.reason && { hint: record.reason }),
    },
    {
      label: 'Searchable',
      state: searchable,
      ...(searchable === 'failed' && record.reason && { hint: record.reason }),
    },
    {
      label: 'Summarized',
      state: summarized,
      ...(summary === 'deferred' && { hint: 'On its first search' }),
      ...(summary === 'skipped' && { hint: 'Off' }),
    },
  ];
}

function StageTrack({ record }: { record: KnowledgeRecord }) {
  return (
    <ol className={styles.track}>
      {stages(record).map((step) => (
        <li
          key={step.label}
          className={`${styles.trackStep} ${styles[`track_${step.state}`]}`}
          title={step.hint}
        >
          <span className={styles.trackDot}>
            {step.state === 'done' && <Icon name="check" size={14} />}
            {step.state === 'failed' && <Icon name="close" size={14} />}
            {step.state === 'active' && <span className={styles.spinner} />}
          </span>
          <span>
            {step.label}
            {step.hint && <span className={styles.trackHint}>{step.hint}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function RecordDrawer({
  focus,
  query,
  onClose,
  onOpen,
}: {
  focus: Focus;
  query: string;
  onClose: () => void;
  onOpen: (record: KnowledgeRecord) => void;
}) {
  const record = useKnowledgeRecord(focus.recordId);
  // Read for the question it was opened from, or from the start.
  const [inOrder, setInOrder] = useState(false);
  const read = useRecordRead(
    record.data?.status === 'completed' || record.data?.status === 'empty' ? focus.recordId : null,
    inOrder ? '' : query,
  );
  const cited = useMemo(() => new Set(focus.chunk?.citation.blockIndices ?? []), [focus.chunk]);
  const words = useMemo(() => terms(query), [query]);
  const body = useRef<HTMLDivElement>(null);

  useEffect(() => {
    body.current
      ?.querySelector(`.${styles.blockCited}`)
      ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [read.data, focus]);

  const r = record.data;
  const dates = r ? recordDates(r) : null;
  const status = r ? STATUS[r.status] : null;

  return (
    <aside className={styles.drawer} aria-label="Record preview">
      <header className={styles.drawerHead}>
        {r && <FileIcon name={r.name} mimeType={r.mimeType} />}
        <h3 className={styles.drawerTitle} title={r?.name}>
          {r?.name ?? 'Loading…'}
        </h3>
        {r && (
          <button type="button" className={styles.ghost} onClick={() => onOpen(r)}>
            {r.mail?.threadId ? 'Open email' : 'Download'}
          </button>
        )}
        <button
          type="button"
          className={styles.iconButton}
          onClick={onClose}
          aria-label="Close preview"
        >
          <Icon name="close" size={20} />
        </button>
        <span className={styles.accent} />
      </header>
      <div className={styles.drawerBody} ref={body}>
        {record.isError && (
          <div className={styles.error}>This record is gone or can't be loaded.</div>
        )}
        {r && dates && status && (
          <>
            <StageTrack record={r} />
            <dl className={styles.meta}>
              <dt>Status</dt>
              <dd>
                <Chip tone={status.tone}>{status.label}</Chip>
                {r.reason && <span className={styles.muted}> {r.reason}</span>}
              </dd>
              <dt>Source</dt>
              <dd>{sourceLabel(r.sourceType, r.sourceId)}</dd>
              <dt>Type</dt>
              <dd>
                {kindLabel(kindOf(r.name, r.mimeType))} · {formatSize(r.sizeBytes)}
              </dd>
              <dt>Created</dt>
              <dd>
                {formatDay(dates.created)}{' '}
                <span className={styles.muted}>({DATE_ORIGIN[r.dateOrigin]})</span>
              </dd>
              <dt>Modified</dt>
              <dd>{formatDay(dates.modified)}</dd>
              <dt>Added</dt>
              <dd>{formatDay(r.createdAt)}</dd>
            </dl>
            {r.classification && (
              <section className={styles.summary}>
                <div className={styles.summaryLabel}>
                  <Sparkles size={14} />
                  Summary
                </div>
                {r.classification.summary}
                <div className={styles.chips}>
                  {r.classification.category && (
                    <Chip tone="violet">{r.classification.category}</Chip>
                  )}
                  {r.classification.subcategories &&
                    Object.values(r.classification.subcategories)
                      .filter(Boolean)
                      .map((sub) => (
                        <Chip key={sub} tone="blue">
                          {sub}
                        </Chip>
                      ))}
                  {r.classification.topics?.map((topic) => (
                    <Chip key={topic} tone="cyan">
                      {topic}
                    </Chip>
                  ))}
                  {r.classification.languages?.map((lang) => (
                    <Chip key={lang}>{lang}</Chip>
                  ))}
                </div>
              </section>
            )}
            {isBusy(r.status) && (
              <div className={`${styles.notice} ${styles.noticeInfo}`}>
                <span className={styles.spinner} />
                It is being read. Its text shows here once it is searchable.
              </div>
            )}
          </>
        )}
        {read.data && (
          <section>
            <div className={styles.readHead}>
              <h4 className={styles.readTitle}>
                {read.data.focused ? 'The parts that answer your question' : 'Contents'}
              </h4>
              {query && (
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => setInOrder(!inOrder)}
                >
                  {inOrder ? 'Show the parts that answer it' : 'Read from the start'}
                </button>
              )}
            </div>
            {read.data.blocks.map((block, i) => {
              const gap = read.data.gaps?.find((g) => g.to === block.index - 1 && i > 0);
              const mono = block.type === 'code' || block.type === 'table_row';
              return (
                <div key={block.index}>
                  {gap && (
                    <p className={styles.gap}>
                      {gap.to - gap.from + 1} {gap.to === gap.from ? 'block' : 'blocks'} left out
                    </p>
                  )}
                  <p
                    className={`${styles.block} ${mono ? styles.blockMono : ''} ${block.isHeader ? styles.blockHeader : ''} ${cited.has(block.index) ? styles.blockCited : ''}`}
                  >
                    {block.citation?.page !== undefined && (
                      <span className={styles.blockPage}>p. {block.citation.page}</span>
                    )}
                    <Marked text={block.text} words={cited.has(block.index) ? words : []} />
                  </p>
                </div>
              );
            })}
            {read.data.next !== null && (
              <p className={styles.gap}>
                Showing {read.data.blocks.length} of {read.data.total} blocks. Open the file for the
                rest.
              </p>
            )}
          </section>
        )}
        {read.isLoading && <div className={styles.shimmer} />}
      </div>
    </aside>
  );
}
