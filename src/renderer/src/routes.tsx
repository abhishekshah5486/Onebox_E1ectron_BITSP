import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router';
import { GuestOnly, RequireAuth } from './auth/guards';
import { SignInPage } from './auth/SignInPage';
import { SignUpPage } from './auth/SignUpPage';
import { FOLDER_LABEL, type FolderRole } from './mail/folders';
import { AccountMailbox, UnifiedMailbox } from './mail/MailboxPage';
import { ThreadPage } from './mail/ThreadPage';
import { AppShell } from './shell/AppShell';

// Settings pulls in Cloudscape, so it loads only when opened.
const SettingsPage = lazy(() => import('./settings/SettingsPage'));

const UNIFIED_FOLDERS: FolderRole[] = ['sent', 'drafts', 'spam', 'trash'];

function AccountThread() {
  const { accountId = '', folder = 'inbox' } = useParams();
  return <ThreadPage basePath={`/accounts/${accountId}/${folder}`} />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<GuestOnly />}>
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/signup" element={<SignUpPage />} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route
            path="/inbox"
            element={
              <UnifiedMailbox key="inbox" filter="all" title="All inboxes" basePath="/inbox" />
            }
          />
          <Route path="/inbox/:threadId" element={<ThreadPage basePath="/inbox" />} />
          <Route
            path="/starred"
            element={
              <UnifiedMailbox key="starred" filter="starred" title="Starred" basePath="/starred" />
            }
          />
          <Route path="/starred/:threadId" element={<ThreadPage basePath="/starred" />} />
          {UNIFIED_FOLDERS.flatMap((folder) => [
            <Route
              key={folder}
              path={`/${folder}`}
              element={
                <UnifiedMailbox
                  key={folder}
                  filter="all"
                  folder={folder}
                  title={FOLDER_LABEL[folder]}
                  basePath={`/${folder}`}
                />
              }
            />,
            <Route
              key={`${folder}-thread`}
              path={`/${folder}/:threadId`}
              element={<ThreadPage basePath={`/${folder}`} />}
            />,
          ])}
          <Route path="/accounts/:accountId" element={<AccountMailbox />} />
          <Route path="/accounts/:accountId/:folder" element={<AccountMailbox />} />
          <Route path="/accounts/:accountId/:folder/:threadId" element={<AccountThread />} />
          <Route
            path="/settings"
            element={
              <Suspense fallback={<div role="status" aria-label="Loading settings" />}>
                <SettingsPage />
              </Suspense>
            }
          />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/inbox" replace />} />
    </Routes>
  );
}
