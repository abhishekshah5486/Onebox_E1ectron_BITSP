import type { FolderRole, GmailCategory, MailboxView, MailCategory } from '../mail/folders';
import type { ApiClient } from './client';

export interface Address {
  name: string;
  address: string;
}

export interface Thread {
  id: string;
  accountId: string;
  folders: FolderRole[];
  labels: string[];
  category: GmailCategory | null;
  categories: MailCategory[];
  canUnsubscribe: boolean;
  unsubscribedAt: string | null;
  subject: string;
  snippet: string;
  participants: Address[];
  lastFrom: Address | null;
  messageCount: number;
  unreadCount: number;
  isStarred: boolean;
  hasAttachments: boolean;
  // The first few files across its messages, for chips in the list.
  attachments: AttachmentRef[];
  lastMessageAt: string;
}

export interface AttachmentRef {
  messageId: string;
  index: number;
  filename: string;
  contentType: string;
  sizeBytes: number;
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
  // Who sent and signed it, per the user's own provider; null for older mail.
  authentication: Authentication | null;
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
  folder: FolderRole | 'label';
  label: string | null;
  server: { total: number; unread: number; updatedAt: string } | null;
  fetched: { conversations: number; messages: number };
  history: { status: HistoryStatus; error: string | null };
  hasMoreOnServer: boolean;
}

export interface FolderCounts {
  role: FolderRole | 'label';
  path: string;
  // The server's own name: "All Mail" for Gmail's archive, or a label's display name.
  name: string;
  total: number;
  unread: number;
  updatedAt: string;
}

export interface MailboxLabel {
  path: string;
  name: string;
}

export interface MailStats {
  unreadThreads: number;
  starredThreads: number;
  totalThreads: number;
}

export type ThreadAction =
  'read' | 'unread' | 'star' | 'unstar' | 'archive' | 'trash' | 'move' | 'delete';

// Where a move sends mail: a folder by role, or a label by its path.
export type MailboxTarget = { role: FolderRole } | { label: string };

export interface ActionRequest {
  threadIds: string[];
  action: ThreadAction;
  // The folder or label being viewed; moves take the messages shown there.
  from?: MailboxView;
  to?: MailboxTarget;
}

export interface Authentication {
  mailedBy: string | null;
  signedBy: string | null;
  encrypted: boolean | null;
}

export interface UnsubscribeResult {
  method: 'one-click' | 'link' | 'mailto';
  url: string | null;
}

const viewParams = (view: MailboxView): Record<string, string> =>
  'label' in view ? { label: view.label } : { folder: view.role };

const pageParams = (page: number, extra: Record<string, string> = {}) =>
  new URLSearchParams({ page: String(page), limit: '50', ...extra });

export const mailApi = {
  listThreads: (
    api: ApiClient,
    filter: ThreadFilter,
    folder: FolderRole | null,
    page: number,
    category?: GmailCategory | null,
    tagged?: MailCategory | null,
  ) =>
    api.get<ThreadPage>(
      `/mail/threads?${pageParams(page, { filter, ...(folder && { folder }), ...(category && { category }), ...(tagged && { tagged }) })}`,
    ),
  listAccountThreads: (
    api: ApiClient,
    accountId: string,
    view: MailboxView,
    page: number,
    category?: GmailCategory | null,
  ) =>
    api.get<ThreadPage>(
      `/mail/accounts/${accountId}/threads?${pageParams(page, { ...viewParams(view), ...(category && { category }) })}`,
    ),
  summary: (api: ApiClient, accountId: string, view: MailboxView) =>
    api.get<MailboxSummary>(
      `/mail/accounts/${accountId}/summary?${new URLSearchParams(viewParams(view))}`,
    ),
  requestHistory: (api: ApiClient, accountId: string, view: MailboxView) =>
    api.post<MailboxSummary>(
      `/mail/accounts/${accountId}/history?${new URLSearchParams(viewParams(view))}`,
    ),
  folders: (api: ApiClient, accountId: string) =>
    api.get<{ items: FolderCounts[] }>(`/mail/accounts/${accountId}/folders`),
  getThread: (api: ApiClient, id: string) =>
    api.get<{ thread: Thread; messages: Message[] }>(`/mail/threads/${id}`),
  updateThread: (api: ApiClient, id: string, changes: { isRead?: boolean; isStarred?: boolean }) =>
    api.patch<Thread>(`/mail/threads/${id}`, changes),
  act: (api: ApiClient, request: ActionRequest) =>
    api.post<{ items: Thread[]; undoToken: string | null }>('/mail/threads/actions', request),
  undo: (api: ApiClient, undoToken: string) =>
    api.post<{ items: Thread[] }>('/mail/threads/undo', { undoToken }),
  unsubscribe: (api: ApiClient, id: string) =>
    api.post<UnsubscribeResult>(`/mail/threads/${id}/unsubscribe`),
  createLabel: (api: ApiClient, accountId: string, name: string) =>
    api.post<{ items: MailboxLabel[] }>(`/mail/accounts/${accountId}/labels`, { name }),
  renameLabel: (api: ApiClient, accountId: string, path: string, name: string) =>
    api.patch<{ items: MailboxLabel[] }>(`/mail/accounts/${accountId}/labels`, { path, name }),
  deleteLabel: (api: ApiClient, accountId: string, path: string) =>
    api.post<{ items: MailboxLabel[] }>(`/mail/accounts/${accountId}/labels/delete`, { path }),
  stats: (api: ApiClient) => api.get<MailStats>('/mail/stats'),
  attachment: (api: ApiClient, messageId: string, index: number, inline = false) =>
    api.blob(`/mail/messages/${messageId}/attachments/${index}${inline ? '?inline=true' : ''}`),
  saveToDrive: (
    api: ApiClient,
    messageId: string,
    target: { indexes: number[]; accountId: string; path: string },
  ) =>
    api.post<{ files: { index: number; name: string; link: string }[] }>(
      `/mail/messages/${messageId}/attachments/drive`,
      target,
    ),
  lookup: (api: ApiClient, threadIds: string[]) =>
    api.post<{ items: Thread[] }>('/mail/threads/lookup', { threadIds }),
};
