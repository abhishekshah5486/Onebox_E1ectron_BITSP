import { useState } from 'react';
import { IconButton } from '../../ui/IconButton';
import { formatBytes } from '../format';
import { AttachmentViewer } from './AttachmentViewer';
import styles from './Attachments.module.css';
import { FileBadge } from './FileBadge';
import { useAttachmentDownload, useAttachmentUrl, type AttachmentFile } from './useAttachment';

const THUMBNAIL = /^image\/(png|jpeg|gif|webp|bmp|avif)$/;

function Card({ file, onOpen }: { file: AttachmentFile; onOpen: () => void }) {
  const download = useAttachmentDownload();
  const { url } = useAttachmentUrl(THUMBNAIL.test(file.contentType.toLowerCase()) ? file : null);
  return (
    <div className={styles.card}>
      <button
        type="button"
        className={styles.cardOpen}
        aria-label={`Preview ${file.filename}`}
        onClick={onOpen}
      >
        <span className={styles.cardPreview}>
          {url ? (
            <img src={url} alt="" />
          ) : (
            <span className={styles.cardBadge}>
              <FileBadge file={file} size={48} />
            </span>
          )}
        </span>
        <span className={styles.cardFooter}>
          <FileBadge file={file} size={18} />
          <span className={styles.cardName}>{file.filename}</span>
        </span>
      </button>
      {/* Gmail's hover sheet: the full name, its size and a download. */}
      <span className={styles.cardHover} aria-hidden="true">
        <span className={styles.cardHoverHead}>
          <FileBadge file={file} size={18} />
          <span className={styles.cardHoverName}>{file.filename}</span>
        </span>
        <span className={styles.cardSize}>{formatBytes(file.sizeBytes)}</span>
      </span>
      <span className={styles.cardActions}>
        <IconButton
          size="small"
          icon="download"
          label={`Download ${file.filename}`}
          onClick={() => void download(file)}
        />
      </span>
    </div>
  );
}

// A message's files as cards, with Download all, like Gmail's reading pane.
export function AttachmentCards({ files }: { files: AttachmentFile[] }) {
  const download = useAttachmentDownload();
  const [open, setOpen] = useState<AttachmentFile | null>(null);
  if (files.length === 0) return null;
  return (
    <section className={styles.cards} aria-label="Attachments">
      <div className={styles.cardsHeader}>
        <b>
          {files.length} {files.length === 1 ? 'Attachment' : 'Attachments'}
        </b>
        <IconButton
          size="small"
          icon="download"
          label="Download all"
          onClick={() => {
            void (async () => {
              for (const file of files) await download(file);
            })();
          }}
        />
      </div>
      <div className={styles.cardGrid}>
        {files.map((file) => (
          <Card key={`${file.messageId}:${file.index}`} file={file} onOpen={() => setOpen(file)} />
        ))}
      </div>
      {open && <AttachmentViewer file={open} onClose={() => setOpen(null)} />}
    </section>
  );
}
