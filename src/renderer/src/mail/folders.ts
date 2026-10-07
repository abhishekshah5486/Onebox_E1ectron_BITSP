import type { IconName } from '../ui/Icon';

export const FOLDER_ROLES = ['inbox', 'sent', 'drafts', 'spam', 'trash'] as const;
export type FolderRole = (typeof FOLDER_ROLES)[number];

export const FOLDER_LABEL: Record<FolderRole, string> = {
  inbox: 'Inbox',
  sent: 'Sent',
  drafts: 'Drafts',
  spam: 'Spam',
  trash: 'Trash',
};

export const FOLDER_ICON: Record<FolderRole, IconName> = {
  inbox: 'inbox',
  sent: 'send',
  drafts: 'draft',
  spam: 'report',
  trash: 'delete',
};

export const isFolderRole = (value: string | undefined): value is FolderRole =>
  (FOLDER_ROLES as readonly string[]).includes(value ?? '');

// Like Gmail, drafts are counted by how many there are; other folders by unread mail.
export const folderBadge = (role: FolderRole, counts: { total: number; unread: number }) =>
  role === 'drafts' ? counts.total : role === 'sent' || role === 'trash' ? 0 : counts.unread;
