import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { GuestOnly, RequireAuth } from './auth/guards';
import { SignInPage } from './auth/SignInPage';
import { SignUpPage } from './auth/SignUpPage';
import { MailboxPage } from './mail/MailboxPage';
import { ThreadPage } from './mail/ThreadPage';
import { AppShell } from './shell/AppShell';
import { FOLDERS } from './shell/Sidebar';

// Settings pulls in Cloudscape, so it loads only when opened.
const SettingsPage = lazy(() => import('./settings/SettingsPage'));

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<GuestOnly />}>
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/signup" element={<SignUpPage />} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          {FOLDERS.flatMap((folder) => [
            <Route
              key={folder.path}
              path={folder.path}
              element={
                <MailboxPage folder={folder.label} filter={folder.filter} basePath={folder.path} />
              }
            />,
            <Route
              key={`${folder.path}/thread`}
              path={`${folder.path}/:threadId`}
              element={<ThreadPage basePath={folder.path} />}
            />,
          ])}
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
