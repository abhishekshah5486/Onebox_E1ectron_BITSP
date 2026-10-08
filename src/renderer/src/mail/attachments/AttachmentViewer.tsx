import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { describeError } from '../../auth/errors';
import { IconButton } from '../../ui/IconButton';
import { formatBytes } from '../format';
import styles from './Attachments.module.css';
import { FileBadge } from './FileBadge';
import { canPreview, FILE_KINDS, fileKind, readsAsText } from './fileTypes';
import { useAttachmentDownload, useAttachmentUrl, type AttachmentFile } from './useAttachment';

const MAX_TEXT_PREVIEW_BYTES = 2 * 1024 * 1024;

// Full-window preview, like Gmail's: images, PDFs, text, audio and video in place; anything else
// offers a download.
export function AttachmentViewer({ file, onClose }: { file: AttachmentFile; onClose: () => void }) {
  const download = useAttachmentDownload();
  // Code and text of any declared type are shown as plain text, never rendered.
  const asText =
    readsAsText(file.filename, file.contentType) && file.sizeBytes <= MAX_TEXT_PREVIEW_BYTES;
  const previewable = asText || canPreview(file.contentType);
  const { url, blob, error } = useAttachmentUrl(previewable ? file : null);
  const kind = fileKind(file.filename, file.contentType);
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [onClose]);

  useEffect(() => {
    if (!blob || !(asText || file.contentType.startsWith('text/'))) return;
    void blob.text().then(setText);
  }, [blob, asText, file.contentType]);

  const type = file.contentType.toLowerCase();
  const body = !previewable ? (
    <div className={styles.noPreview}>
      <FileBadge file={file} size={64} />
      <p>No preview available for {FILE_KINDS[kind].name.toLowerCase()} files.</p>
      <button type="button" className={styles.viewerButton} onClick={() => void download(file)}>
        Download
      </button>
    </div>
  ) : error ? (
    <p className={styles.noPreview}>{describeError(error)}</p>
  ) : !url ? (
    <p className={styles.noPreview}>Loading…</p>
  ) : asText ? (
    <pre className={styles.viewerText}>{text ?? 'Loading…'}</pre>
  ) : type.startsWith('image/') ? (
    <img className={styles.viewerImage} src={url} alt={file.filename} />
  ) : type === 'application/pdf' ? (
    <iframe className={styles.viewerFrame} src={url} title={file.filename} />
  ) : type.startsWith('video/') ? (
    <video className={styles.viewerImage} src={url} controls autoPlay />
  ) : type.startsWith('audio/') ? (
    <audio src={url} controls autoPlay />
  ) : (
    <pre className={styles.viewerText}>{text ?? 'Loading…'}</pre>
  );

  return createPortal(
    <div
      className={styles.viewer}
      role="dialog"
      aria-modal="true"
      aria-label={file.filename}
      onClick={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <header className={styles.viewerBar}>
        <IconButton icon="back" label="Close preview" onClick={onClose} />
        <FileBadge file={file} size={22} />
        <span className={styles.viewerName}>{file.filename}</span>
        <span className={styles.viewerSize}>{formatBytes(file.sizeBytes)}</span>
        <IconButton icon="download" label="Download" onClick={() => void download(file)} />
      </header>
      <div
        className={styles.viewerBody}
        onClick={(event) => event.target === event.currentTarget && onClose()}
      >
        {body}
      </div>
    </div>,
    document.body,
  );
}
