import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { mailApi } from '../../api/mail';
import { useAuth } from '../../auth/AuthProvider';

export interface AttachmentFile {
  messageId: string;
  index: number;
  filename: string;
  contentType: string;
  sizeBytes: number;
}

// Saves a file under its own name through a temporary link.
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function useAttachmentDownload() {
  const { api } = useAuth();
  return async (file: AttachmentFile) =>
    saveBlob(await mailApi.attachment(api, file.messageId, file.index), file.filename);
}

// One object URL per file, shared by every thumbnail and preview of it, and revoked a little
// after the last of them closes (React may unmount and remount a view in between).
const objectUrls = new Map<Blob, { url: string; users: number }>();

function urlFor(blob: Blob, type: string | undefined) {
  let entry = objectUrls.get(blob);
  if (!entry) {
    // Typed from the message, so the browser renders only what the server allowed inline.
    entry = { url: URL.createObjectURL(new Blob([blob], { type })), users: 0 };
    objectUrls.set(blob, entry);
  }
  return entry.url;
}

function holdUrl(blob: Blob) {
  const entry = objectUrls.get(blob);
  if (!entry) return;
  entry.users += 1;
  return () => {
    entry.users -= 1;
    setTimeout(() => {
      if (entry.users > 0) return;
      URL.revokeObjectURL(entry.url);
      objectUrls.delete(blob);
    }, 5_000);
  };
}

// An object URL for the file while the caller is shown, for previews and thumbnails.
export function useAttachmentUrl(file: AttachmentFile | null) {
  const { api } = useAuth();
  const query = useQuery({
    queryKey: ['mail', 'attachment', file?.messageId, file?.index],
    queryFn: () => mailApi.attachment(api, file!.messageId, file!.index, true),
    enabled: file !== null,
    staleTime: Infinity,
    gcTime: 5 * 60_000,
  });
  const type = file?.contentType;
  const url = useMemo(() => (query.data ? urlFor(query.data, type) : null), [query.data, type]);
  useEffect(() => {
    if (!query.data) return;
    return holdUrl(query.data);
  }, [query.data]);
  return { url, blob: query.data ?? null, error: query.error };
}
