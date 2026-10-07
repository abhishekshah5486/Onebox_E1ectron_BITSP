import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router';
import { GuestOnly, RequireAuth } from './auth/guards';
import { SignInPage } from './auth/SignInPage';
import { SignUpPage } from './auth/SignUpPage';
import { AccountMailbox, UnifiedMailbox } from './mail/MailboxPage';
import { ThreadPage } from './mail/ThreadPage';
import { AppShell } from './shell/AppShell';

// Settings pulls in Cloudscape, so it loads only when opened.
const SettingsPage = lazy(() => import('./settings/SettingsPage'));

function AccountThread() {
  const { accountId = '' } = useParams();
  return <ThreadPage basePath={`/accounts/${accountId}`} />;
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
            element={<UnifiedMailbox filter="all" title="All inboxes" basePath="/inbox" />}
          />
          <Route path="/inbox/:threadId" element={<ThreadPage basePath="/inbox" />} />
          <Route
            path="/starred"
            element={<UnifiedMailbox filter="starred" title="Starred" basePath="/starred" />}
          />
          <Route path="/starred/:threadId" element={<ThreadPage basePath="/starred" />} />
          <Route path="/accounts/:accountId" element={<AccountMailbox />} />
          <Route path="/accounts/:accountId/:threadId" element={<AccountThread />} />
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
