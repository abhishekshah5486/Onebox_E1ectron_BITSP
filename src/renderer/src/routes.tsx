import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router';
import type { ThreadFilter } from './api/mail';
import { GuestOnly, RequireAuth } from './auth/guards';
import { SignInPage } from './auth/SignInPage';
import { SignUpPage } from './auth/SignUpPage';
import {
  FOLDER_LABEL,
  labelPath,
  MAIL_CATEGORIES,
  MAIL_CATEGORY_LABEL,
  type FolderRole,
  type MailCategory,
} from './mail/folders';
import { AccountMailbox, UnifiedMailbox } from './mail/MailboxPage';
import { ThreadPage } from './mail/ThreadPage';
import { AppShell } from './shell/AppShell';
import { useUiVersion } from './theme/UiVersionProvider';

// Settings and the v2 console pull in Cloudscape, so they load only when needed.
const SettingsPage = lazy(() => import('./settings/SettingsPage'));
const SuggestionsPage = lazy(() => import('./suggestions/SuggestionsPage'));
const loadConsole = () => import('./console');
const ConsoleShell = lazy(() => loadConsole().then((m) => ({ default: m.ConsoleShell })));
const ConsoleUnifiedMailbox = lazy(() =>
  loadConsole().then((m) => ({ default: m.ConsoleUnifiedMailbox })),
);
const ConsoleAccountMailbox = lazy(() =>
  loadConsole().then((m) => ({ default: m.ConsoleAccountMailbox })),
);
const ConsoleThread = lazy(() => loadConsole().then((m) => ({ default: m.ConsoleThread })));

interface UnifiedProps {
  filter: ThreadFilter;
  folder?: FolderRole | null;
  tagged?: MailCategory | null;
  title: string;
  basePath: string;
}

// The pieces each interface version supplies for the same set of routes.
interface Kit {
  Shell: ComponentType;
  Unified: ComponentType<UnifiedProps>;
  Account: ComponentType;
  Thread: ComponentType<{ basePath: string }>;
}

const CLASSIC: Kit = {
  Shell: AppShell,
  Unified: UnifiedMailbox,
  Account: AccountMailbox,
  Thread: ThreadPage,
};

const CONSOLE: Kit = {
  Shell: ConsoleShell,
  Unified: ConsoleUnifiedMailbox,
  Account: ConsoleAccountMailbox,
  Thread: ConsoleThread,
};

const UNIFIED_FOLDERS: FolderRole[] = ['sent', 'drafts', 'archive', 'spam', 'trash'];

const loading = (label: string, children: ReactNode) => (
  <Suspense fallback={<div role="status" aria-label={label} />}>{children}</Suspense>
);

function AccountThread({ Thread }: { Thread: Kit['Thread'] }) {
  const { accountId = '', folder = 'inbox', label } = useParams();
  return (
    <Thread
      basePath={
        label !== undefined ? labelPath(accountId, label) : `/accounts/${accountId}/${folder}`
      }
    />
  );
}

export function AppRoutes() {
  const { version } = useUiVersion();
  const { Shell, Unified, Account, Thread } = version === 'v2' ? CONSOLE : CLASSIC;
  const unified = (key: string, props: UnifiedProps) => [
    <Route key={key} path={props.basePath} element={<Unified key={key} {...props} />} />,
    <Route
      key={`${key}-thread`}
      path={`${props.basePath}/:threadId`}
      element={<Thread basePath={props.basePath} />}
    />,
  ];

  return (
    <Routes>
      <Route element={<GuestOnly />}>
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/signup" element={<SignUpPage />} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route element={loading('Loading', <Shell />)}>
          {unified('inbox', { filter: 'all', title: 'All inboxes', basePath: '/inbox' })}
          {unified('starred', { filter: 'starred', title: 'Starred', basePath: '/starred' })}
          {UNIFIED_FOLDERS.flatMap((folder) =>
            unified(folder, {
              filter: 'all',
              folder,
              title: FOLDER_LABEL[folder],
              basePath: `/${folder}`,
            }),
          )}
          {MAIL_CATEGORIES.flatMap((category) =>
            unified(`category-${category}`, {
              filter: 'all',
              tagged: category,
              title: MAIL_CATEGORY_LABEL[category],
              basePath: `/category/${category}`,
            }),
          )}
          <Route path="/accounts/:accountId" element={<Account />} />
          <Route path="/accounts/:accountId/labels/:label" element={<Account />} />
          <Route
            path="/accounts/:accountId/labels/:label/:threadId"
            element={<AccountThread Thread={Thread} />}
          />
          <Route path="/accounts/:accountId/:folder" element={<Account />} />
          <Route
            path="/accounts/:accountId/:folder/:threadId"
            element={<AccountThread Thread={Thread} />}
          />
          <Route
            path="/suggestions"
            element={loading('Loading suggestions', <SuggestionsPage />)}
          />
          <Route path="/settings" element={loading('Loading settings', <SettingsPage />)} />
          <Route path="/settings/:tab" element={loading('Loading settings', <SettingsPage />)} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/inbox" replace />} />
    </Routes>
  );
}
