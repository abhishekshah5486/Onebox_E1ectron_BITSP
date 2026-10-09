import { useState, type CSSProperties } from 'react';
import { Icon } from '../../ui/Icon';
import { IconButton } from '../../ui/IconButton';
import { formatBytes } from '../format';
import { AttachmentViewer } from './AttachmentViewer';
import styles from './Attachments.module.css';
import { FileBadge, fileColor } from './FileBadge';
import { useAttachmentDownload, useAttachmentUrl, type AttachmentFile } from './useAttachment';
import { useSaveToDrive } from './useSaveToDrive';

const THUMBNAIL = /^image\/(png|jpeg|gif|webp|bmp|avif)$/;

function Card({
  file,
  onOpen,
  onSaveToDrive,
}: {
  file: AttachmentFile;
  onOpen: () => void;
  onSaveToDrive: () => void;
}) {
  const download = useAttachmentDownload();
  const { url } = useAttachmentUrl(THUMBNAIL.test(file.contentType.toLowerCase()) ? file : null);
  return (
    <div className={styles.card} style={{ '--fold': fileColor(file) } as CSSProperties}>
      <button
        type="button"
        className={styles.cardOpen}
        aria-label={`Preview ${file.filename}`}
        onClick={onOpen}
      >
        <span className={styles.cardPreview}>
          {url ? (
            <img className={styles.thumbnail} src={url} alt="" />
          ) : (
            <span className={styles.cardBadge}>
              <FileBadge file={file} size={56} />
            </span>
          )}
        </span>
        <span className={styles.cardFooter}>
          <FileBadge file={file} size={22} />
          <span className={styles.cardName}>{file.filename}</span>
        </span>
      </button>
      {/* Gmail's hover sheet: the full name, its size and a download. */}
      <span className={styles.cardHover} aria-hidden="true">
        <span className={styles.cardHoverHead}>
          <FileBadge file={file} size={22} />
          <span className={styles.cardHoverName}>{file.filename}</span>
        </span>
        <span className={styles.cardSize}>{formatBytes(file.sizeBytes)}</span>
      </span>
      <span className={styles.cardActions}>
        <button
          type="button"
          className={styles.cardButton}
          aria-label={`Download ${file.filename}`}
          data-tooltip="Download"
          onClick={() => void download(file)}
        >
          <Icon name="download" size={20} />
        </button>
        <button
          type="button"
          className={styles.cardButton}
          aria-label={`Add ${file.filename} to Drive`}
          data-tooltip="Add to Drive"
          onClick={onSaveToDrive}
        >
          <Icon name="addToDrive" size={22} />
        </button>
      </span>
      {/* The dog-ear stays on top, hovered or not. */}
      <span className={styles.fold} aria-hidden="true" />
    </div>
  );
}

// A message's files as cards, with Download all and Add all to Drive, like Gmail's reading pane.
// The console shows the two as Cloudscape buttons.
export function AttachmentCards({
  files,
  console = false,
}: {
  files: AttachmentFile[];
  console?: boolean;
}) {
  const download = useAttachmentDownload();
  const drive = useSaveToDrive();
  const [open, setOpen] = useState<AttachmentFile | null>(null);
  if (files.length === 0) return null;
  const downloadAll = () => {
    void (async () => {
      for (const file of files) await download(file);
    })();
  };
  const addAll = () => void drive.save(files);
  const title = `${files.length} ${files.length === 1 ? 'Attachment' : 'Attachments'}`;

  return (
    <section className={styles.cards} aria-label="Attachments">
      {console ? (
        <div className={styles.cardsHeader}>
          <b>{title}</b>
          <span className={styles.pillGroup}>
            <button type="button" className={styles.awsPill} onClick={downloadAll}>
              <Icon name="download" size={20} />
              Download all
            </button>
            <button
              type="button"
              className={styles.awsPill}
              disabled={drive.saving}
              onClick={addAll}
            >
              <Icon name="addToDrive" size={22} />
              {drive.saving ? 'Adding to Drive…' : 'Add all to Drive'}
            </button>
          </span>
        </div>
      ) : (
        <div className={styles.cardsHeader}>
          <b>{title}</b>
          <span className={styles.cardsDot} aria-hidden="true">
            •
          </span>
          <IconButton size="small" icon="download" label="Download all" onClick={downloadAll} />
          <button
            type="button"
            className={styles.drivePill}
            disabled={drive.saving}
            onClick={addAll}
          >
            <Icon name="addToDrive" size={24} />
            {drive.saving ? 'Adding to Drive…' : 'Add all to Drive'}
          </button>
        </div>
      )}
      <div className={styles.cardGrid}>
        {files.map((file) => (
          <Card
            key={`${file.messageId}:${file.index}`}
            file={file}
            onOpen={() => setOpen(file)}
            onSaveToDrive={() => void drive.save([file])}
          />
        ))}
      </div>
      {open && <AttachmentViewer file={open} onClose={() => setOpen(null)} />}
      {drive.dialog}
    </section>
  );
}
