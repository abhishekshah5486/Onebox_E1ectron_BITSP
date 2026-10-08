import { useState, type MouseEvent } from 'react';
import { AttachmentViewer } from './AttachmentViewer';
import styles from './Attachments.module.css';
import { FileBadge } from './FileBadge';
import type { AttachmentFile } from './useAttachment';

const SHOWN = 3;

// Gmail's file chips under a conversation in the list; a click previews without opening it.
export function AttachmentChips({ files }: { files: AttachmentFile[] }) {
  const [open, setOpen] = useState<AttachmentFile | null>(null);
  if (files.length === 0) return null;
  const stop = (event: MouseEvent) => event.stopPropagation();
  return (
    <span className={styles.chips} onClick={stop}>
      {files.slice(0, SHOWN).map((file) => (
        <button
          key={`${file.messageId}:${file.index}`}
          type="button"
          className={styles.chip}
          data-tooltip={file.filename}
          aria-label={`Preview ${file.filename}`}
          onClick={() => setOpen(file)}
        >
          <FileBadge file={file} size={16} />
          <span className={styles.chipName}>{file.filename}</span>
        </button>
      ))}
      {files.length > SHOWN && <span className={styles.more}>+{files.length - SHOWN}</span>}
      {open && <AttachmentViewer file={open} onClose={() => setOpen(null)} />}
    </span>
  );
}
