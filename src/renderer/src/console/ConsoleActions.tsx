import Button, { type ButtonProps } from '@cloudscape-design/components/button';
import ButtonDropdown from '@cloudscape-design/components/button-dropdown';
import SpaceBetween from '@cloudscape-design/components/space-between';
import type { ActionRequest, FolderCounts, Thread } from '../api/mail';
import {
  folderActions,
  moveRequest,
  moveTargets,
  type ActionItem,
  type ActionSpec,
} from '../mail/actions';
import type { MailboxView } from '../mail/folders';
import { CONSOLE_ICONS } from './consoleIcons';

// Cloudscape's own icon where one fits, else one drawn in its style.
export function actionIcon(item: ActionItem): Pick<ButtonProps, 'iconName' | 'iconSvg'> {
  switch (item.id) {
    case 'trash':
      return { iconName: 'remove' };
    case 'archive':
      return { iconSvg: CONSOLE_ICONS.archive };
    case 'spam':
      return { iconSvg: CONSOLE_ICONS.spam };
    case 'delete':
      return { iconSvg: CONSOLE_ICONS.deleteForever };
    default:
      return { iconSvg: CONSOLE_ICONS.inbox };
  }
}

// The toolbar of a list or conversation: this folder's actions, Move to, and read/star.
export function ConsoleActions({
  view,
  folders,
  selected,
  onAction,
  extraFlags = true,
}: {
  view: MailboxView | null;
  folders: FolderCounts[] | null;
  selected: Thread[];
  onAction: (request: ActionSpec) => void;
  extraFlags?: boolean;
}) {
  const none = selected.length === 0;
  const targets = moveTargets(view, folders);
  const flags: { id: ActionRequest['action']; text: string }[] = [
    { id: 'read', text: 'Mark as read' },
    { id: 'unread', text: 'Mark as unread' },
    { id: 'star', text: 'Add star' },
    { id: 'unstar', text: 'Remove star' },
  ];

  // Its own SpaceBetween: Cloudscape spaces direct children only, not a fragment's.
  return (
    <SpaceBetween direction="horizontal" size="xs">
      {folderActions(view).map((item) => (
        <Button
          key={item.id}
          disabled={none}
          {...actionIcon(item)}
          onClick={() => onAction(item.request)}
        >
          {item.label}
        </Button>
      ))}
      <ButtonDropdown
        disabled={none}
        items={targets.map((target) => ({ id: target.key, text: target.label }))}
        onItemClick={({ detail }) => {
          const target = targets.find((item) => item.key === detail.id);
          if (target) onAction(moveRequest(view, target.target));
        }}
      >
        Move to
      </ButtonDropdown>
      {extraFlags && (
        <ButtonDropdown
          disabled={none}
          items={flags}
          onItemClick={({ detail }) => onAction({ action: detail.id as ActionRequest['action'] })}
        >
          More
        </ButtonDropdown>
      )}
    </SpaceBetween>
  );
}
