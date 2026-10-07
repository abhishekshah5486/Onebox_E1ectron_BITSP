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
import { useAccounts } from '../api/queries';
import { FOLDER_LABEL, FOLDER_ROLES, folderBadge, type FolderRole } from '../mail/folders';
import { countLabel } from '../mail/format';
import styles from './ConsoleNavigation.module.css';
import { useMiddleFit } from './useMiddleFit';

// Logo (16px) plus the gap after it, inside the account line.
const LOGO_SPACE = 24;

const UNIFIED: FolderRole[] = ['sent', 'drafts', 'spam', 'trash'];

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
  const byRole = new Map(folders.map((folder) => [folder.role, folder]));
  const countOf = (role: FolderRole) => {
    const counts = byRole.get(role);
    return counts ? folderBadge(role, counts) : 0;
  };
  const roles = FOLDER_ROLES.filter((role) => role === 'inbox' || byRole.has(role));
  const current = pathname.startsWith(`${base}/`);
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
                {FOLDER_LABEL[role]}
                <Count
                  value={countOf(role)}
                  label={`${role === 'drafts' ? 'drafts' : 'unread'} in ${FOLDER_LABEL[role]}`}
                />
              </NavLink>
            </li>
          ))}
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
    void navigate(event.detail.href);
  };
  const count = (role: FolderRole) => (
    <Count value={unifiedCount(role)} label={`in ${FOLDER_LABEL[role]}`} />
  );

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
              { type: 'link', text: 'Inbox', href: '/inbox', info: count('inbox') },
              { type: 'link', text: 'Starred', href: '/starred' },
              ...UNIFIED.map((role): SideNavigationProps.Link => ({
                type: 'link',
                text: FOLDER_LABEL[role],
                href: `/${role}`,
                info: count(role),
              })),
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
        items={[{ type: 'divider' }, { type: 'link', text: 'Settings', href: '/settings' }]}
      />
    </div>
  );
}
