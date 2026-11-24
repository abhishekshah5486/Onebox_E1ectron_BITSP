import Button from '@cloudscape-design/components/button';
import SideNavigation, {
  type SideNavigationProps,
} from '@cloudscape-design/components/side-navigation';
import { useIsFetching } from '@tanstack/react-query';
import * as tokens from '@cloudscape-design/design-tokens';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useCollections } from '../../api/hub';
import styles from './Knowledge.module.css';
import { Sparkle } from './Sparkle';

const FOLDED = 'onebox.knowledge-rail-folded';

const panelIcon = (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none">
    <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M6 2.5v11" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

function readFolded() {
  try {
    return localStorage.getItem(FOLDED) === '1';
  } catch {
    return false;
  }
}

function* hrefs(items: readonly SideNavigationProps.Item[]): Generator<string> {
  for (const item of items) {
    if ('href' in item && item.href) yield item.href;
    if ('items' in item) yield* hrefs(item.items);
  }
}

// Knowledge's own navigation, in a panel beside the page that folds to an icon.
export function KnowledgeFrame({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const collections = useCollections();
  const busy = useIsFetching({ queryKey: ['knowledge'] }) > 0;
  const [folded, setFolded] = useState(readFolded);
  const fold = (value: boolean) => {
    setFolded(value);
    try {
      localStorage.setItem(FOLDED, value ? '1' : '0');
    } catch {
      // Remembered only where storage works.
    }
  };

  const items: SideNavigationProps.Item[] = [
    { type: 'link', text: 'Search', href: '/knowledge/search' },
    { type: 'divider' },
    {
      type: 'section-group',
      title: 'Knowledge base',
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
    { type: 'divider' },
    { type: 'link', text: 'Settings', href: '/knowledge/settings' },
  ];
  // The deepest link the path starts with is the active one.
  const active =
    [...hrefs(items)]
      .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
      .sort((a, b) => b.length - a.length)[0] ?? pathname;

  return (
    <div
      className={styles.frame}
      style={
        {
          '--kb-bg': tokens.colorBackgroundContainerContent,
          '--kb-border': tokens.colorBorderDividerDefault,
        } as CSSProperties
      }
    >
      {folded ? (
        <div className={styles.collapsed}>
          <Button
            variant="icon"
            iconSvg={panelIcon}
            ariaLabel="Open knowledge navigation"
            onClick={() => fold(false)}
          />
          <Sparkle />
        </div>
      ) : (
        <nav className={styles.rail} aria-label="Knowledge">
          <div className={styles.railHeader}>
            <Sparkle />
            <span className={styles.railTitle}>Knowledge</span>
            <Button
              variant="icon"
              iconName="angle-left"
              ariaLabel="Close knowledge navigation"
              onClick={() => fold(true)}
            />
          </div>
          <div className={`${styles.flowLine} ${busy ? styles.busy : ''}`} />
          <div className={styles.railBody}>
            <SideNavigation
              activeHref={active}
              items={items}
              onFollow={(event) => {
                if (event.detail.external) return;
                event.preventDefault();
                void navigate(event.detail.href);
              }}
            />
          </div>
        </nav>
      )}
      <div>{children}</div>
    </div>
  );
}
