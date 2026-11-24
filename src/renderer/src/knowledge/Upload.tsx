import { useRef, useState, type DragEvent } from 'react';
import { ApiError } from '../api/client';
import { useKnowledgeSources, useUploadDocuments } from '../api/knowledge';
import { Icon } from '../ui/Icon';
import { useNotify } from '../ui/useNotify';
import { sourceLabel } from './format';
import styles from './Knowledge.module.css';

const COLLECTION = /^[A-Za-z0-9_-]{1,64}$/;

// Files dropped or picked go into a collection (a knowledge base), new or existing.
export function UploadPanel({ initial, onDone }: { initial?: string; onDone: () => void }) {
  const notify = useNotify();
  const sources = useKnowledgeSources();
  const upload = useUploadDocuments();
  const collections = (sources.data ?? [])
    .filter((s) => s.sourceType === 'upload')
    .map((s) => s.sourceId);
  const [collection, setCollection] = useState(initial ?? collections[0] ?? 'default');
  const [over, setOver] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const valid = COLLECTION.test(collection);

  const send = (files: File[]) => {
    if (files.length === 0 || !valid || upload.isPending) return;
    setProgress(0);
    upload.mutate(
      { knowledgeBase: collection, files, onProgress: setProgress },
      {
        onSuccess: ({ records }) => {
          const again = records.filter((r) => r.duplicate).length;
          notify({
            type: 'success',
            content: `${records.length} ${records.length === 1 ? 'file' : 'files'} added to ${sourceLabel('upload', collection)}${again ? ` (${again} already there)` : ''}. They become searchable once read.`,
          });
          onDone();
        },
        onError: (error) =>
          notify({
            type: 'error',
            content: error instanceof ApiError ? error.message : 'The upload failed.',
          }),
        onSettled: () => setProgress(null),
      },
    );
  };

  const drop = (event: DragEvent) => {
    event.preventDefault();
    setOver(false);
    send([...event.dataTransfer.files]);
  };

  return (
    <div className={styles.upload}>
      <div className={styles.uploadRow}>
        <label className={styles.fieldLabel} htmlFor="kb-collection">
          Collection
        </label>
        <input
          id="kb-collection"
          className={styles.input}
          list="kb-collections"
          value={collection}
          onChange={(e) => setCollection(e.target.value.trim())}
          aria-invalid={!valid}
        />
        <datalist id="kb-collections">
          {collections.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      {!valid && <p className={styles.fieldError}>Letters, numbers, - and _ only, up to 64.</p>}
      <div
        role="button"
        tabIndex={0}
        className={`${styles.drop} ${over ? styles.dropActive : ''}`}
        onClick={() => picker.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && picker.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={drop}
      >
        <span className={styles.dropIcon}>
          <Icon name="attachment" size={26} />
        </span>
        <span className={styles.dropTitle}>Drop files here, or click to choose</span>
        <span>PDF, Word, PowerPoint, spreadsheets, images, emails, text, code and more</span>
        {progress !== null && (
          <span className={styles.progress} aria-label="Upload progress">
            <span
              className={styles.progressFill}
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </span>
        )}
        <input
          ref={picker}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            send([...(e.target.files ?? [])]);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
