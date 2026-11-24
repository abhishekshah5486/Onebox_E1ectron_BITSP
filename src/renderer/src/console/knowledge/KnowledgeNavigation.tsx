import SideNavigation, {
  type SideNavigationProps,
} from '@cloudscape-design/components/side-navigation';
import { useLocation, useNavigate } from 'react-router';
import { useCollections } from '../../api/hub';

// Knowledge's own navigation, as a console service has.
export function KnowledgeNavigation() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const collections = useCollections();

  const items: SideNavigationProps.Item[] = [
    { type: 'link', text: 'Search', href: '/knowledge/search' },
    { type: 'divider' },
    {
      type: 'section',
      text: 'Knowledge base',
      items: [
        {
          type: 'expandable-link-group',
          text: 'Collections',
          href: '/knowledge/collections',
          defaultExpanded: true,
          items: (collections.data ?? []).map((c) => ({
            type: 'link' as const,
            text: c.name,
            href: `/knowledge/collections/${c.id}`,
          })),
        },
        { type: 'link', text: 'All records', href: '/knowledge/records' },
        { type: 'link', text: 'Recently deleted', href: '/knowledge/trash' },
      ],
    },
    { type: 'link', text: 'Settings', href: '/knowledge/settings' },
    { type: 'divider' },
    { type: 'link', text: 'Mail', href: '/inbox' },
  ];

  // The deepest link the path starts with is the active one.
  const active =
    [...flatten(items)]
      .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
      .sort((a, b) => b.length - a.length)[0] ?? pathname;

  return (
    <SideNavigation
      header={{ text: 'Knowledge', href: '/knowledge' }}
      activeHref={active}
      items={items}
      onFollow={(event) => {
        if (event.detail.external) return;
        event.preventDefault();
        void navigate(event.detail.href);
      }}
    />
  );
}

function* flatten(items: readonly SideNavigationProps.Item[]): Generator<string> {
  for (const item of items) {
    if ('href' in item && item.href) yield item.href;
    if ('items' in item) yield* flatten(item.items);
  }
}
