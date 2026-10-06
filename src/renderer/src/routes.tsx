import { Navigate, Route, Routes } from 'react-router';
import { GuestOnly, RequireAuth } from './auth/guards';
import { SignInPage } from './auth/SignInPage';
import { SignUpPage } from './auth/SignUpPage';
import { MailboxPage } from './mail/MailboxPage';
import { SettingsPage } from './settings/SettingsPage';
import { AppShell } from './shell/AppShell';
import { FOLDERS } from './shell/Sidebar';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<GuestOnly />}>
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/signup" element={<SignUpPage />} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          {FOLDERS.map((folder) => (
            <Route
              key={folder.path}
              path={folder.path}
              element={<MailboxPage folder={folder.label} />}
            />
          ))}
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/inbox" replace />} />
    </Routes>
  );
}
