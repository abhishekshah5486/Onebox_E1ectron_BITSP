import type { IconName } from '../ui/Icon';

export const FOLDER_ROLES = ['inbox', 'sent', 'drafts', 'spam', 'trash', 'archive'] as const;
export type FolderRole = (typeof FOLDER_ROLES)[number];

// Sidebar order, like Gmail: archive (All Mail) sits before Spam and Trash.
export const FOLDER_ORDER: FolderRole[] = ['inbox', 'sent', 'drafts', 'archive', 'spam', 'trash'];

export const FOLDER_LABEL: Record<FolderRole, string> = {
  inbox: 'Inbox',
  sent: 'Sent',
  drafts: 'Drafts',
  spam: 'Spam',
  trash: 'Trash',
  archive: 'Archive',
};

export const FOLDER_ICON: Record<FolderRole, IconName> = {
  inbox: 'inbox',
  sent: 'send',
  drafts: 'draft',
  spam: 'report',
  trash: 'delete',
  archive: 'archive',
};

export const isFolderRole = (value: string | undefined): value is FolderRole =>
  (FOLDER_ROLES as readonly string[]).includes(value ?? '');

// Like Gmail, drafts are counted by how many there are; inbox and spam by unread mail.
export const folderBadge = (role: FolderRole, counts: { total: number; unread: number }) =>
  role === 'drafts' ? counts.total : role === 'inbox' || role === 'spam' ? counts.unread : 0;

// Gmail calls its archive "All Mail"; other providers keep their own folder's name.
export const folderName = (role: FolderRole, serverName?: string) =>
  role === 'archive' && serverName ? serverName : FOLDER_LABEL[role];

// A system folder, or one of the user's labels (Gmail labels, or other providers' folders).
export type MailboxView = { role: FolderRole } | { label: string };

export const viewKey = (view: MailboxView) => ('label' in view ? `label:${view.label}` : view.role);

export const GMAIL_CATEGORIES = ['primary', 'promotions', 'social', 'updates', 'forums'] as const;
export type GmailCategory = (typeof GMAIL_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<GmailCategory, string> = {
  primary: 'Primary',
  promotions: 'Promotions',
  social: 'Social',
  updates: 'Updates',
  forums: 'Forums',
};

export const labelPath = (accountId: string, label: string) =>
  `/accounts/${accountId}/labels/${encodeURIComponent(label)}`;

// The view a list page shows, from its path; null for Starred, which spans folders.
export function viewFromPath(basePath: string): MailboxView | null {
  const label = basePath.match(/^\/accounts\/[^/]+\/labels\/([^/]+)$/);
  if (label) return { label: decodeURIComponent(label[1]!) };
  const role = basePath.split('/').at(-1);
  return isFolderRole(role) ? { role } : null;
}
