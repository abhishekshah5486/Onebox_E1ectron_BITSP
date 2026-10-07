import type { ApiClient } from './client';

export interface Address {
  name: string;
  address: string;
}

export interface Thread {
  id: string;
  accountId: string;
  subject: string;
  snippet: string;
  participants: Address[];
  lastFrom: Address | null;
  messageCount: number;
  unreadCount: number;
  isStarred: boolean;
  hasAttachments: boolean;
  lastMessageAt: string;
}

export interface Attachment {
  filename: string;
  contentType: string;
  sizeBytes: number;
  inline: boolean;
}

export interface Message {
  id: string;
  accountId: string;
  from: Address | null;
  to: Address[];
  cc: Address[];
  replyTo: Address[];
  subject: string;
  snippet: string;
  textBody: string;
  htmlBody: string | null;
  hasRemoteImages: boolean;
  attachments: Attachment[];
  isRead: boolean;
  isStarred: boolean;
  receivedAt: string;
  sentAt: string | null;
}

export type ThreadFilter = 'all' | 'unread' | 'starred';

export interface ThreadPage {
  items: Thread[];
  page: number;
  pageSize: number;
  // Conversations stored for this view (the server may hold more, see MailboxSummary).
  total: number;
}

export type HistoryStatus = 'idle' | 'fetching' | 'complete' | 'error';

export interface MailboxSummary {
  accountId: string;
  server: { total: number; unread: number; updatedAt: string } | null;
  fetched: { conversations: number; messages: number };
  history: { status: HistoryStatus; error: string | null };
  hasMoreOnServer: boolean;
}

export interface MailStats {
  unreadThreads: number;
  starredThreads: number;
  totalThreads: number;
}

const pageParams = (page: number, extra: Record<string, string> = {}) =>
  new URLSearchParams({ page: String(page), limit: '50', ...extra });

export const mailApi = {
  listThreads: (api: ApiClient, filter: ThreadFilter, page: number) =>
    api.get<ThreadPage>(`/mail/threads?${pageParams(page, { filter })}`),
  listAccountThreads: (api: ApiClient, accountId: string, page: number) =>
    api.get<ThreadPage>(`/mail/accounts/${accountId}/threads?${pageParams(page)}`),
  summary: (api: ApiClient, accountId: string) =>
    api.get<MailboxSummary>(`/mail/accounts/${accountId}/summary`),
  requestHistory: (api: ApiClient, accountId: string) =>
    api.post<MailboxSummary>(`/mail/accounts/${accountId}/history`),
  getThread: (api: ApiClient, id: string) =>
    api.get<{ thread: Thread; messages: Message[] }>(`/mail/threads/${id}`),
  updateThread: (api: ApiClient, id: string, changes: { isRead?: boolean; isStarred?: boolean }) =>
    api.patch<Thread>(`/mail/threads/${id}`, changes),
  stats: (api: ApiClient) => api.get<MailStats>('/mail/stats'),
};
