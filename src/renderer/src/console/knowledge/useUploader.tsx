import { useRef } from 'react';
import { hubApi, useUploadLimits, type UploadItem } from '../../api/hub';
import { useAuth } from '../../auth/AuthProvider';
import { formatSize } from '../../knowledge/format';
import { useFlash } from '../../settings/flash';
import { useQueryClient } from '@tanstack/react-query';
import { problem } from './parts';

let uploads = 0;

// Files or a whole folder into a collection (or a folder of it), with one banner that shows
// how far the upload got and then what came of it.
export function useUploader(target: { collectionId: string; folderId: string | null } | null) {
  const { api } = useAuth();
  const flash = useFlash();
  const client = useQueryClient();
  const limits = useUploadLimits();
  const files = useRef<HTMLInputElement>(null);
  const folder = useRef<HTMLInputElement>(null);

  const send = async (items: UploadItem[]) => {
    if (!target || items.length === 0) return;
    const id = `upload-${++uploads}`;
    const max = limits.data?.maxFileSizeBytes;
    const tooBig = max ? items.filter((i) => i.file.size > max) : [];
    const sending = items.filter((i) => !tooBig.includes(i));
    if (tooBig.length > 0)
      flash({
        type: 'error',
        header: `${tooBig.length === 1 ? `${tooBig[0]!.file.name} is` : `${tooBig.length} files are`} too large`,
        content: `The largest file accepted is ${formatSize(max!)}.`,
      });
    if (sending.length === 0) return;
    const total = sending.reduce((sum, i) => sum + i.file.size, 0);
    const label = `${sending.length} ${sending.length === 1 ? 'file' : 'files'}`;
    flash({
      id,
      type: 'info',
      loading: true,
      content: `Uploading ${label} (${formatSize(total)})…`,
    });
    try {
      const { records } = await hubApi.upload(api, target, sending, (fraction) =>
        flash({
          id,
          type: 'info',
          loading: true,
          content: `Uploading ${label}: ${Math.round(fraction * 100)}% of ${formatSize(total)}`,
        }),
      );
      const again = records.filter((r) => r.duplicate).length;
      flash({
        id,
        type: 'success',
        header: `${records.length}/${sending.length} uploads complete`,
        content: `They become searchable once read.${again ? ` ${again} were already in this collection.` : ''}`,
      });
    } catch (err) {
      flash({ id, type: 'error', header: 'Upload failed', content: problem(err, 'Try again.') });
    } finally {
      void client.invalidateQueries({ queryKey: ['knowledge'] });
    }
  };

  const inputs = (
    <>
      <input
        ref={files}
        type="file"
        multiple
        hidden
        aria-label="Upload files"
        onChange={(e) => {
          void send([...(e.target.files ?? [])].map((file) => ({ file })));
          e.target.value = '';
        }}
      />
      <input
        ref={folder}
        type="file"
        multiple
        hidden
        aria-label="Upload a folder"
        // Not in React's types: a folder picker that keeps each file's path inside it.
        {...{ webkitdirectory: '', directory: '' }}
        onChange={(e) => {
          void send(
            [...(e.target.files ?? [])].map((file) => ({
              file,
              path: file.webkitRelativePath || file.name,
            })),
          );
          e.target.value = '';
        }}
      />
    </>
  );

  return {
    inputs,
    pickFiles: () => files.current?.click(),
    pickFolder: () => folder.current?.click(),
    send,
  };
}
