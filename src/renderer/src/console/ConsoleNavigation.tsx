import Icon from '@cloudscape-design/components/icon';
import SideNavigation, {
  type SideNavigationProps,
} from '@cloudscape-design/components/side-navigation';
import * as tokens from '@cloudscape-design/design-tokens';
import { useRef, useState, type CSSProperties } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router';
import { ProviderLogo } from '../accounts/ProviderLogo';
import type { Account } from '../api/accounts';
import type { FolderCounts } from '../api/mail';
import { useAccountFolders } from '../api/mail-queries';
import { useSuggestionCount } from '../api/ai';
import { useAccounts, usePreferences } from '../api/queries';
import { navIcon } from './consoleIcons';
import {
  FOLDER_LABEL,
  FOLDER_ORDER,
  folderBadge,
  categoryKey,
  DEFAULT_SIDEBAR_HIDDEN,
  folderName,
  labelKey,
  labelPath,
  MAIL_CATEGORIES,
  MAIL_CATEGORY_LABEL,
  type FolderRole,
} from '../mail/folders';
import { countLabel } from '../mail/format';
import styles from './ConsoleNavigation.module.css';
import { useMiddleFit } from './useMiddleFit';

// Logo (16px) plus the gap after it, inside the account line.
const LOGO_SPACE = 24;

// Not a page: the link that shows or hides what Manage labels tucked away.
const MORE_HREF = '#more';

const UNIFIED: FolderRole[] = ['sent', 'drafts', 'archive', 'spam', 'trash'];

// Cloudscape tokens resolve to CSS variables, so these follow light and dark mode.
const TOKEN_VARS = {
  '--nav-text': tokens.colorTextBodyDefault,
  '--nav-muted': tokens.colorTextBodySecondary,
  '--nav-heading': tokens.colorTextHeadingDefault,
  '--nav-active': tokens.colorTextAccent,
  '--nav-hover': tokens.colorTextInteractiveHover,
  '--nav-divider': tokens.colorBorderDividerDefault,
  '--nav-focus': tokens.colorBorderItemFocused,
} as CSSProperties;

export function Count({ value, label }: { value: number; label: string }) {
  return value > 0 ? (
    <span className={styles.count} aria-label={`${value.toLocaleString()} ${label}`}>
      {countLabel(value)}
    </span>
  ) : null;
}

// Conversation pages highlight the folder they were opened from.
export const activeHref = (pathname: string) => pathname.replace(/\/[0-9a-f]{64}$/, '');

function AccountItem({ account, folders }: { account: Account; folders: FolderCounts[] }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const base = `/accounts/${account.id}`;
  const byRole = new Map(
    folders.flatMap((folder) => (folder.role === 'label' ? [] : [[folder.role, folder] as const])),
  );
  const hidden = new Set(usePreferences().data?.sidebarHidden ?? DEFAULT_SIDEBAR_HIDDEN);
  const [moreOpen, setMoreOpen] = useState(false);
  const allLabels = folders.filter((folder) => folder.role === 'label');
  const isHiddenLabel = (path: string) => hidden.has(labelKey(account.id, path));
  const countOf = (role: FolderRole) => {
    const counts = byRole.get(role);
    return counts ? folderBadge(role, counts) : 0;
  };
  const present = FOLDER_ORDER.filter((role) => role === 'inbox' || byRole.has(role));
  const isHiddenRole = (role: FolderRole) => role !== 'inbox' && hidden.has(role);
  const current = pathname.startsWith(`${base}/`);
  // Like v1: what Manage labels hides waits behind More, and opens itself when it is the page shown.
  const showMore =
    moreOpen ||
    present.some((role) => isHiddenRole(role) && pathname.startsWith(`${base}/${role}`)) ||
    allLabels.some(
      (label) =>
        isHiddenLabel(label.path) && pathname.startsWith(labelPath(account.id, label.path)),
    );
  const roles = present.filter((role) => showMore || !isHiddenRole(role));
  const labels = allLabels.filter((label) => showMore || !isHiddenLabel(label.path));
  const hasMore =
    present.some(isHiddenRole) || allLabels.some((label) => isHiddenLabel(label.path));
  const trailing = useRef<HTMLSpanElement>(null);
  const [line, label] = useMiddleFit<HTMLDivElement>(account.emailAddress, LOGO_SPACE, trailing);

  return (
    <li>
      <div className={`${styles.account} ${current && !open ? styles.current : ''}`}>
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={open}
          aria-label={`${open ? 'Hide' : 'Show'} folders for ${account.emailAddress}`}
          onClick={() => setOpen(!open)}
        >
          <Icon name={open ? 'angle-down' : 'angle-right'} size="small" />
        </button>
        <div ref={line} className={styles.line}>
          <button
            type="button"
            className={styles.name}
            title={account.emailAddress}
            onClick={() => {
              setOpen(true);
              void navigate(`${base}/inbox`);
            }}
          >
            <ProviderLogo provider={account.provider} size={16} />
            <span>{label}</span>
          </button>
          <span ref={trailing} className={styles.trailing}>
            {account.status !== 'CONNECTED' ? (
              <span className={styles.problem} title="Needs attention" aria-label="Needs attention">
                !
              </span>
            ) : (
              !open && (
                <Count value={countOf('inbox')} label={`unread in ${account.emailAddress}`} />
              )
            )}
          </span>
        </div>
      </div>
      {open && (
        <ul className={styles.folders} aria-label={`${account.emailAddress} folders`}>
          {roles.map((role) => (
            <li key={role}>
              <NavLink
                to={`${base}/${role}`}
                className={({ isActive }) =>
                  `${styles.folder} ${isActive || activeHref(pathname) === `${base}/${role}` ? styles.active : ''}`
                }
              >
                <span className={styles.folderIcon}>{navIcon(role)}</span>
                <span className={styles.labelName}>{folderName(role, byRole.get(role)?.name)}</span>
                <Count
                  value={countOf(role)}
                  label={`${role === 'drafts' ? 'drafts' : 'unread'} in ${FOLDER_LABEL[role]}`}
                />
              </NavLink>
            </li>
          ))}
          {labels.length > 0 && (
            <li className={styles.labelsHeading} aria-hidden="true">
              Labels
            </li>
          )}
          {labels.map((label) => {
            const to = labelPath(account.id, label.path);
            return (
              <li key={label.path}>
                <NavLink
                  to={to}
                  title={label.name}
                  className={({ isActive }) =>
                    `${styles.folder} ${isActive || activeHref(pathname) === to ? styles.active : ''}`
                  }
                >
                  <span className={styles.folderIcon}>{navIcon('labels')}</span>
                  <span className={styles.labelName}>{label.name}</span>
                  <Count value={label.unread} label={`unread in ${label.name}`} />
                </NavLink>
              </li>
            );
          })}
          {hasMore && (
            <li>
              <button
                type="button"
                className={`${styles.folder} ${styles.more}`}
                aria-expanded={showMore}
                onClick={() => setMoreOpen(!showMore)}
              >
                <span className={styles.folderIcon}>
                  <Icon name={showMore ? 'angle-up' : 'angle-down'} />
                </span>
                {showMore ? 'Less' : 'More'}
              </button>
            </li>
          )}
        </ul>
      )}
    </li>
  );
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
  const follow: SideNavigationProps['onFollow'] = (event) => {
    if (event.detail.external) return;
    event.preventDefault();
    if (event.detail.href === MORE_HREF) {
      setMoreOpen(!showMore);
      return;
    }
    void navigate(event.detail.href);
  };
  const count = (role: FolderRole) => (
    <Count value={unifiedCount(role)} label={`in ${FOLDER_LABEL[role]}`} />
  );
  const hidden = new Set(usePreferences().data?.sidebarHidden ?? DEFAULT_SIDEBAR_HIDDEN);
  const suggestionCount = useSuggestionCount().data?.count ?? 0;
  const [moreOpen, setMoreOpen] = useState(false);
  const entries: (SideNavigationProps.Link & { key: string })[] = [
    { key: 'starred', type: 'link', text: 'Starred', href: '/starred' },
    ...UNIFIED.filter((role) => role === 'sent' || role === 'drafts').map((role) => ({
      key: role,
      type: 'link' as const,
      text: FOLDER_LABEL[role],
      href: `/${role}`,
      info: count(role),
    })),
    ...MAIL_CATEGORIES.map((category) => ({
      key: categoryKey(category),
      type: 'link' as const,
      text: MAIL_CATEGORY_LABEL[category],
      href: `/category/${category}`,
    })),
    ...UNIFIED.filter((role) => role !== 'sent' && role !== 'drafts').map((role) => ({
      key: role,
      type: 'link' as const,
      text: FOLDER_LABEL[role],
      href: `/${role}`,
      info: count(role),
    })),
  ];
  const showMore =
    moreOpen || entries.some((entry) => hidden.has(entry.key) && pathname.startsWith(entry.href));
  const link = ({ key, ...entry }: SideNavigationProps.Link & { key: string }) => ({
    ...entry,
    icon: navIcon(key),
  });

  return (
    <div style={TOKEN_VARS}>
      <SideNavigation
        header={{ text: 'Console Home', href: '/inbox' }}
        activeHref={activeHref(pathname)}
        onFollow={follow}
        items={[
          {
            type: 'section-group',
            title: 'All accounts',
            items: [
              link({
                key: 'inbox',
                type: 'link',
                text: 'Inbox',
                href: '/inbox',
                info: count('inbox'),
              }),
              link({
                key: 'suggestions',
                type: 'link',
                text: 'Suggestions',
                href: '/suggestions',
                info: <Count value={suggestionCount} label="suggestions waiting" />,
              }),
              ...entries.filter((entry) => showMore || !hidden.has(entry.key)).map(link),
              ...(entries.some((entry) => hidden.has(entry.key))
                ? [
                    {
                      type: 'link' as const,
                      text: showMore ? 'Less' : 'More',
                      href: MORE_HREF,
                      icon: <Icon name={showMore ? 'angle-up' : 'angle-down'} />,
                    },
                  ]
                : []),
            ],
          },
        ]}
      />
      {accounts.length > 0 && (
        <section className={styles.accounts} aria-labelledby="console-accounts">
          <h3 id="console-accounts" className={styles.heading}>
            Accounts
          </h3>
          <ul>
            {accounts.map((account, i) => (
              <AccountItem key={account.id} account={account} folders={foldersOf(i)} />
            ))}
          </ul>
        </section>
      )}
      <SideNavigation
        activeHref={activeHref(pathname)}
        onFollow={follow}
        items={[
          { type: 'divider' },
          {
            type: 'link',
            text: 'Manage labels',
            href: '/settings/labels',
            icon: navIcon('labels'),
          },
          { type: 'link', text: 'Settings', href: '/settings', icon: navIcon('settings') },
        ]}
      />
    </div>
  );
}
