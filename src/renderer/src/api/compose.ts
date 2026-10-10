import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import type { ApiClient, UploadOptions } from './client';
import type { StorageProviderId } from './settings';

export interface Recipient {
  name: string | null;
  address: string;
}

export interface OutgoingAttachment {
  blobKey: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
}

// A file shared from cloud storage, linked from the message instead of attached.
export interface SharedFile {
  name: string;
  link: string;
  provider: StorageProviderId;
  sizeBytes: number;
}

export type ReplyMode = 'reply' | 'replyAll' | 'forward';

// What a message being written says; drafts and sending share it.
export interface Composition {
  accountId: string | null;
  to: Recipient[];
  cc: Recipient[];
  bcc: Recipient[];
  subject: string;
  html: string;
  text: string;
  attachments: OutgoingAttachment[];
  replyTo: { messageId: string; mode: ReplyMode } | null;
}

export interface Draft extends Composition {
  id: string;
  // Why it's a draft again (a send that failed), if so.
  note: string | null;
  updatedAt: string;
}

export interface OutboxItem {
  id: string;
  accountId: string;
  threadId: string | null;
  to: Recipient[];
  subject: string;
  status: 'scheduled' | 'sent' | 'failed' | 'cancelled';
  error: string | null;
  sendAt: string;
  sentAt: string | null;
  createdAt: string;
}

export const composeApi = {
  drafts: async (api: ApiClient) => (await api.get<{ items: Draft[] }>('/mail/drafts')).items,
  draft: (api: ApiClient, id: string) => api.get<Draft>(`/mail/drafts/${id}`),
  saveDraft: (api: ApiClient, id: string, composition: Composition) =>
    api.put<Draft>(`/mail/drafts/${id}`, composition),
  deleteDraft: (api: ApiClient, id: string) => api.delete<void>(`/mail/drafts/${id}`),
  send: (api: ApiClient, composition: Composition & { draftId?: string; sendAt?: string }) =>
    api.post<OutboxItem>('/mail/send', composition),
  undo: (api: ApiClient, outboxId: string) => api.post<Draft>(`/mail/outbox/${outboxId}/cancel`),
  outbox: async (api: ApiClient) => (await api.get<{ items: OutboxItem[] }>('/mail/outbox')).items,
  contacts: async (api: ApiClient, query: string) =>
    (await api.get<{ items: Recipient[] }>(`/mail/contacts?q=${encodeURIComponent(query)}`)).items,
  upload: (api: ApiClient, file: File, onProgress?: UploadOptions['onProgress']) =>
    api.upload<OutgoingAttachment>('/mail/uploads', file, { ...(onProgress && { onProgress }) }),
  // Too big to attach: uploaded to a cloud storage account and shared by link.
  uploadToCloud: (
    api: ApiClient,
    file: File,
    storageAccountId: string,
    onProgress?: UploadOptions['onProgress'],
  ) =>
    api.upload<SharedFile>('/mail/uploads/cloud', file, {
      headers: { 'x-storage-account': storageAccountId },
      ...(onProgress && { onProgress }),
    }),
  // An attached file's contents, to download it while writing.
  downloadAttachment: (api: ApiClient, attachment: OutgoingAttachment) =>
    api.blob(
      `/mail/uploads/file?key=${encodeURIComponent(attachment.blobKey)}&name=${encodeURIComponent(attachment.filename)}`,
    ),
  attachFromMessage: (api: ApiClient, messageId: string, index: number) =>
    api.post<OutgoingAttachment>('/mail/uploads/from-message', { messageId, index }),
};

export const composeKeys = {
  drafts: ['compose', 'drafts'] as const,
  contacts: (query: string) => ['compose', 'contacts', query] as const,
};

export function useDrafts() {
  const { api } = useAuth();
  return useQuery({ queryKey: composeKeys.drafts, queryFn: () => composeApi.drafts(api) });
}

// People to suggest for a recipient field, as the user types.
export function useContacts(query: string) {
  const { api } = useAuth();
  return useQuery({
    queryKey: composeKeys.contacts(query),
    queryFn: () => composeApi.contacts(api, query),
    staleTime: 60_000,
  });
}
