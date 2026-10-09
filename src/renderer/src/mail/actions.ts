import type { ActionRequest, FolderCounts, MailboxTarget } from '../api/mail';
import type { IconName } from '../ui/Icon';
import { FOLDER_ORDER, folderName, type MailboxView } from './folders';

export type ActionSpec = Omit<ActionRequest, 'threadIds'>;

export interface ActionItem {
  id: string;
  label: string;
  icon: IconName;
  request: ActionSpec;
}

const roleOf = (view: MailboxView | null) => (view && 'role' in view ? view.role : null);

// Gmail-style toolbar for a view; `null` is a view spanning folders, like Starred.
export function folderActions(view: MailboxView | null): ActionItem[] {
  const from = view ?? undefined;
  const toInbox = (label: string): ActionItem => ({
    id: 'inbox',
    label,
    icon: 'inbox',
    request: { action: 'move', to: { role: 'inbox' }, ...(from && { from }) },
  });
  const archive: ActionItem = {
    id: 'archive',
    label: 'Archive',
    icon: 'archive',
    request: { action: 'archive' },
  };
  const spam: ActionItem = {
    id: 'spam',
    label: 'Report spam',
    icon: 'report',
    request: { action: 'move', to: { role: 'spam' }, ...(from && { from }) },
  };
  const trash: ActionItem = {
    id: 'trash',
    label: 'Delete',
    icon: 'delete',
    request: { action: 'trash' },
  };
  const forever: ActionItem = {
    id: 'delete',
    label: 'Delete forever',
    icon: 'deleteForever',
    request: { action: 'delete' },
  };

  switch (roleOf(view)) {
    case 'inbox':
      return [archive, spam, trash];
    case 'spam':
      return [toInbox('Not spam'), forever];
    case 'trash':
      return [toInbox('Move to Inbox'), forever];
    case 'archive':
      return [toInbox('Move to Inbox'), spam, trash];
    case 'sent':
    case 'drafts':
      return [trash];
    default:
      // Starred, or a label.
      return view ? [toInbox('Move to Inbox'), archive, trash] : [archive, trash];
  }
}

export interface MoveTarget {
  key: string;
  label: string;
  target: MailboxTarget;
}

const sameView = (view: MailboxView | null, target: MailboxTarget) =>
  !!view &&
  ('role' in view && 'role' in target
    ? view.role === target.role
    : 'label' in view && 'label' in target && view.label === target.label);

// Folders, then the account's labels; labels only make sense within one account.
export function moveTargets(
  view: MailboxView | null,
  folders: FolderCounts[] | null,
): MoveTarget[] {
  const names = new Map((folders ?? []).map((folder) => [folder.role, folder.name]));
  const system = FOLDER_ORDER.filter((role) => role !== 'sent' && role !== 'drafts').map(
    (role): MoveTarget => ({
      key: role,
      label: folderName(role, names.get(role)),
      target: { role },
    }),
  );
  const labels = (folders ?? [])
    .filter((folder) => folder.role === 'label')
    .map((folder): MoveTarget => ({
      key: `label:${folder.path}`,
      label: folder.name,
      target: { label: folder.path },
    }));
  return [...system, ...labels].filter((item) => !sameView(view, item.target));
}

export const moveRequest = (view: MailboxView | null, target: MailboxTarget): ActionSpec => ({
  action: 'move',
  to: target,
  ...(view && { from: view }),
});
