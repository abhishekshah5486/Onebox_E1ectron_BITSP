import Badge from '@cloudscape-design/components/badge';
import SideNavigation, {
  type SideNavigationProps,
} from '@cloudscape-design/components/side-navigation';
import { useLocation, useNavigate } from 'react-router';
import { ProviderLogo } from '../accounts/ProviderLogo';
import type { Account } from '../api/accounts';
import type { FolderCounts } from '../api/mail';
import { useAccountFolders } from '../api/mail-queries';
import { useAccounts } from '../api/queries';
import { FOLDER_LABEL, FOLDER_ROLES, folderBadge, type FolderRole } from '../mail/folders';

const UNIFIED: FolderRole[] = ['sent', 'drafts', 'spam', 'trash'];

const counter = (count: number) =>
  count > 0 ? <Badge color="blue">{count.toLocaleString()}</Badge> : undefined;

// Conversation pages highlight the folder they were opened from.
export const activeHref = (pathname: string) => pathname.replace(/\/[0-9a-f]{64}$/, '');

function accountGroup(account: Account, folders: FolderCounts[]): SideNavigationProps.LinkGroup {
  const byRole = new Map(folders.map((folder) => [folder.role, folder]));
  const countOf = (role: FolderRole) => {
    const counts = byRole.get(role);
    return counts ? folderBadge(role, counts) : 0;
  };
  return {
    type: 'link-group',
    text: account.emailAddress,
    href: `/accounts/${account.id}/inbox`,
    icon: <ProviderLogo provider={account.provider} size={16} />,
    ...(account.status !== 'CONNECTED' && { info: <Badge color="red">Needs attention</Badge> }),
    items: FOLDER_ROLES.filter((role) => role === 'inbox' || byRole.has(role)).map((role) => ({
      type: 'link',
      text: FOLDER_LABEL[role],
      href: `/accounts/${account.id}/${role}`,
      info: counter(countOf(role)),
    })),
  };
}

export function ConsoleNavigation() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const accounts = useAccounts().data ?? [];
  const folderQueries = useAccountFolders(accounts.map((account) => account.id));
  const foldersOf = (i: number) => folderQueries[i]?.data?.items ?? [];
  const unifiedCount = (role: FolderRole) =>
    accounts.reduce(
      (sum, _, i) =>
        sum + foldersOf(i).reduce((n, f) => n + (f.role === role ? folderBadge(role, f) : 0), 0),
      0,
    );

  const items: SideNavigationProps.Item[] = [
    {
      type: 'section-group',
      title: 'All accounts',
      items: [
        { type: 'link', text: 'Inbox', href: '/inbox', info: counter(unifiedCount('inbox')) },
        { type: 'link', text: 'Starred', href: '/starred' },
        ...UNIFIED.map((role): SideNavigationProps.Link => ({
          type: 'link',
          text: FOLDER_LABEL[role],
          href: `/${role}`,
          info: counter(unifiedCount(role)),
        })),
      ],
    },
    ...(accounts.length > 0
      ? [
          {
            type: 'section-group' as const,
            title: 'Accounts',
            items: accounts.map((account, i) => accountGroup(account, foldersOf(i))),
          },
        ]
      : []),
    { type: 'divider' },
    { type: 'link', text: 'Settings', href: '/settings' },
  ];

  return (
    <SideNavigation
      header={{ text: 'Console Home', href: '/inbox' }}
      activeHref={activeHref(pathname)}
      items={items}
      onFollow={(event) => {
        if (event.detail.external) return;
        event.preventDefault();
        void navigate(event.detail.href);
      }}
    />
  );
}
