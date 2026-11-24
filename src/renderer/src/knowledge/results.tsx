import { useState } from 'react';
import type { Chunk } from '../api/knowledge';
import { Icon } from '../ui/Icon';
import {
  DATE_ORIGIN,
  KIND_LABEL,
  formatDay,
  locate,
  relevance,
  sourceLabel,
  type RecordHit,
} from './format';
import { Chip, FileIcon, Marked } from './parts';
import styles from './Knowledge.module.css';

export interface Focus {
  recordId: string;
  // The passage opened from, if any: its blocks are marked in the preview.
  chunk?: Chunk;
}

interface Shared {
  words: string[];
  top: number;
  focus: Focus | null;
  onPreview: (focus: Focus) => void;
  onOpen: (record: Chunk['record']) => void;
}

function Where({ record }: { record: Chunk['record'] }) {
  const via = record.attachedTo ? `Attached to ${record.attachedTo.name}` : null;
  const from = record.mail?.sender ?? record.attachedTo?.mail.sender;
  return (
    <div className={styles.where}>
      <span>{sourceLabel(record.sourceType, record.sourceId)}</span>
      {from && <span>From {from.name || from.address}</span>}
      {via && <span>{via}</span>}
      <span title={`Dated ${DATE_ORIGIN[record.dates.origin]}`}>
        {formatDay(record.dates.created)}
      </span>
    </div>
  );
}

function Score({ score, top }: { score: number; top: number }) {
  const percent = relevance(score, top);
  return (
    <span className={styles.score} title="Relevance, against the best match of this search">
      <span className={styles.scoreTrack}>
        <span className={styles.scoreFill} style={{ width: `${percent}%` }} />
      </span>
      {percent}%
    </span>
  );
}

function Actions({
  record,
  onOpen,
  onPreview,
  chunk,
}: Shared & { record: Chunk['record']; chunk?: Chunk }) {
  return (
    <div className={styles.cardActions}>
      <button type="button" className={styles.ghost} onClick={() => onOpen(record)}>
        {record.mail?.threadId ? 'Open email' : 'Download'}
      </button>
      <button
        type="button"
        className={styles.solid}
        onClick={() => onPreview({ recordId: record.recordId, ...(chunk && { chunk }) })}
      >
        Preview
      </button>
    </div>
  );
}

// A record and its passages, best first: the Results tab.
export function RecordCard(props: Shared & { hit: RecordHit; index: number }) {
  const { hit, words, top, focus, index } = props;
  const [open, setOpen] = useState(false);
  const [first, ...rest] = hit.chunks as [RecordHit['chunks'][number], ...RecordHit['chunks']];
  const shown = open ? hit.chunks : [first];
  const selected = focus?.recordId === hit.recordId;
  return (
    <article
      className={`${styles.card} ${selected ? styles.cardSelected : ''}`}
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
    >
      <header className={styles.cardHead}>
        <FileIcon name={hit.record.name} mimeType={hit.record.mimeType} />
        <button
          type="button"
          className={styles.recordName}
          onClick={() => props.onPreview({ recordId: hit.recordId, chunk: first.chunk })}
        >
          {hit.record.name}
        </button>
        <Actions {...props} record={hit.record} chunk={first.chunk} />
      </header>
      <Where record={hit.record} />
      {shown.map(({ chunk, ref }) => (
        <div key={chunk.id} className={styles.passage}>
          <button
            type="button"
            className={styles.ref}
            title="Show it in the record"
            onClick={() => props.onPreview({ recordId: hit.recordId, chunk })}
          >
            {ref}
          </button>
          <div className={styles.passageBody}>
            <blockquote className={styles.quote}>
              <Marked text={chunk.text} words={words} />
            </blockquote>
            <div className={styles.badges}>
              <Score score={chunk.score} top={top} />
              {locate(chunk).map((where) => (
                <Chip key={where}>{where}</Chip>
              ))}
              {chunk.kind !== 'block' && <Chip tone="violet">{KIND_LABEL[chunk.kind]}</Chip>}
            </div>
          </div>
        </div>
      ))}
      {rest.length > 0 && (
        <button type="button" className={styles.more} onClick={() => setOpen(!open)}>
          <Icon name="expand" size={16} />
          {open
            ? 'Fewer passages'
            : `${rest.length} more ${rest.length === 1 ? 'citation' : 'citations'}`}
        </button>
      )}
    </article>
  );
}

// One passage with its reference number: the Citations tab.
export function CitationCard(props: Shared & { chunk: Chunk; refNumber: number; index: number }) {
  const { chunk, refNumber, words, top, focus, index } = props;
  const selected = focus?.chunk?.id === chunk.id;
  return (
    <article
      className={`${styles.card} ${selected ? styles.cardSelected : ''}`}
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
    >
      <header className={styles.cardHead}>
        <span className={styles.refStatic}>{refNumber}</span>
        <FileIcon name={chunk.record.name} mimeType={chunk.record.mimeType} />
        <button
          type="button"
          className={styles.recordName}
          onClick={() => props.onPreview({ recordId: chunk.record.recordId, chunk })}
        >
          {chunk.record.name}
        </button>
        <Actions {...props} record={chunk.record} chunk={chunk} />
      </header>
      <Where record={chunk.record} />
      <blockquote className={styles.quote}>
        <Marked text={chunk.text} words={words} />
      </blockquote>
      <div className={styles.badges}>
        <Score score={chunk.score} top={top} />
        {locate(chunk).map((where) => (
          <Chip key={where}>{where}</Chip>
        ))}
        {chunk.kind !== 'block' && <Chip tone="violet">{KIND_LABEL[chunk.kind]}</Chip>}
      </div>
    </article>
  );
}
