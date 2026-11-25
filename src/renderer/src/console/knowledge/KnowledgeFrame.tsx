import Button from '@cloudscape-design/components/button';
import Icon from '@cloudscape-design/components/icon';
import SideNavigation, {
  type SideNavigationProps,
} from '@cloudscape-design/components/side-navigation';
import * as tokens from '@cloudscape-design/design-tokens';
import { useIsFetching } from '@tanstack/react-query';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useCollections } from '../../api/hub';
import { useKnowledgeSources } from '../../api/knowledge';
import { useAccounts } from '../../api/queries';
import styles from './Knowledge.module.css';
import { KnowledgeLogo } from './Sparkle';

const FOLDED = 'onebox.knowledge-rail-folded';

const panelIcon = (
  <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="1" y="2" width="14" height="12" rx="1.5" />
    <path d="M6 2v12" />
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

// How tall the console's bar is, so the panel sits right under it.
function useTopOffset() {
  const [top, setTop] = useState(56);
  useEffect(() => {
    const bar = document.getElementById('onebox-top-nav');
    if (!bar || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setTop(bar.offsetHeight));
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);
  return top;
}

const count = (n: number | undefined) =>
  n ? <span className={styles.count}>{n.toLocaleString()}</span> : undefined;

// Knowledge's own navigation: a panel flush against the console's, folding to an icon.
export function KnowledgeFrame({
  recent,
  breadcrumbs,
  deep = false,
  children,
}: {
  recent: string[];
  breadcrumbs: ReactNode;
  // A page darker than its containers (search), rather than the console's own.
  // A darker page behind containers; 'neutral' in the console home's greys.
  deep?: boolean | 'neutral';
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const collections = useCollections();
  const sources = useKnowledgeSources();
  const accounts = useAccounts();
  const busy = useIsFetching({ queryKey: ['knowledge'] }) > 0;
  const top = useTopOffset();
  const [folded, setFolded] = useState(readFolded);
  const fold = (value: boolean) => {
    setFolded(value);
    try {
      localStorage.setItem(FOLDED, value ? '1' : '0');
    } catch {
      // Remembered only where storage works.
    }
  };

  const records = new Map((sources.data ?? []).map((s) => [s.sourceId, s.records]));
  const total = (sources.data ?? []).reduce((n, s) => n + s.records, 0);
  const mailboxes = (sources.data ?? []).filter((s) => s.sourceType === 'mail');
  const email = new Map((accounts.data ?? []).map((a) => [a.id, a.emailAddress]));

  const items: SideNavigationProps.Item[] = [
    {
      type: 'link',
      text: 'All records',
      href: '/knowledge/records',
      icon: <Icon name="view-full" />,
      info: count(total),
    },
    {
      type: 'expandable-link-group',
      text: 'Collections',
      href: '/knowledge/collections',
      icon: <Icon name="folder-open" />,
      defaultExpanded: true,
      // Uploaded collections, then each synced mailbox (read-only, kept in sync with mail).
      items: [
        ...(collections.data ?? []).map((c) => ({
          type: 'link' as const,
          text: c.name,
          href: `/knowledge/collections/${c.id}`,
          icon: <Icon name="folder" />,
          info: count(records.get(c.id)),
        })),
        ...mailboxes.map((m) => ({
          type: 'link' as const,
          text: mailboxes.length === 1 ? 'Mail' : (email.get(m.sourceId) ?? 'Mail'),
          href: `/knowledge/mail/${m.sourceId}`,
          icon: <Icon name="envelope" />,
          info: count(m.records),
        })),
      ],
    },
    {
      type: 'link',
      text: 'Recently deleted',
      href: '/knowledge/trash',
      icon: <Icon name="remove" />,
    },
    ...(recent.length > 0
      ? [
          { type: 'divider' as const },
          {
            type: 'section' as const,
            text: 'Your searches',
            items: recent.map((q) => ({
              type: 'link' as const,
              text: q,
              href: `/knowledge/search?${new URLSearchParams({ q })}`,
              icon: <Icon name="search" />,
            })),
          },
        ]
      : []),
    { type: 'divider' },
    { type: 'link', text: 'Settings', href: '/knowledge/settings', icon: <Icon name="settings" /> },
  ];
  const here = pathname + search;
  // The exact link (a past search), else the deepest link the path starts with.
  const active =
    [...hrefs(items)].find((href) => href === here) ??
    [...hrefs(items)]
      .filter(
        (href) => !href.includes('?') && (pathname === href || pathname.startsWith(`${href}/`)),
      )
      .sort((a, b) => b.length - a.length)[0] ??
    pathname;

  return (
    <div
      className={styles.frame}
      style={
        {
          '--kb-top': `${top}px`,
          '--kb-panel': tokens.colorBackgroundLayoutPanelContent,
          '--kb-border': tokens.colorBorderDividerDefault,
          '--kb-link': tokens.colorTextLinkDefault,
        } as CSSProperties
      }
    >
      {folded ? (
        <div className={styles.folded}>
          <Button
            variant="icon"
            iconSvg={panelIcon}
            ariaLabel="Open knowledge navigation"
            onClick={() => fold(false)}
          />
          <Button
            variant="icon"
            iconName="gen-ai"
            ariaLabel="New search"
            onClick={() => void navigate('/knowledge/search')}
          />
        </div>
      ) : (
        <nav className={styles.rail} aria-label="Knowledge">
          <div className={styles.railHeader}>
            <KnowledgeLogo size={24} />
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
            <div className={styles.newSearch}>
              <Button
                variant="primary"
                fullWidth
                iconName="gen-ai"
                onClick={() => void navigate('/knowledge/search')}
              >
                New search
              </Button>
            </div>
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
      <div
        className={`${styles.main} ${deep ? styles.deep : ''} ${deep === 'neutral' ? styles.neutral : ''}`}
      >
        <div className={styles.crumbs}>{breadcrumbs}</div>
        {children}
      </div>
    </div>
  );
}
