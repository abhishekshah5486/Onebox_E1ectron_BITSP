import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import { QueryProvider } from '../api/QueryProvider';
import { AuthProvider } from '../auth/AuthProvider';
import { RequireAuth } from '../auth/guards';
import { MailboxPage } from '../mail/MailboxPage';
import { fakeApi, testUser } from '../test/fake-api';
import { testQueryClient } from '../test/render';
import { ThemeProvider } from '../theme/ThemeProvider';
import { AppShell } from './AppShell';

beforeEach(() => localStorage.clear());

async function renderShell(api = fakeApi({ restoreSession: vi.fn(async () => testUser) })) {
  render(
    <ThemeProvider>
      <AuthProvider api={api}>
        <QueryProvider client={testQueryClient()}>
          <MemoryRouter initialEntries={['/inbox']}>
            <Routes>
              <Route element={<RequireAuth />}>
                <Route element={<AppShell />}>
                  <Route path="/inbox" element={<MailboxPage folder="Inbox" />} />
                  <Route path="/sent" element={<MailboxPage folder="Sent" filter={null} />} />
                </Route>
              </Route>
              <Route path="/settings" element={<p>at /settings</p>} />
            </Routes>
          </MemoryRouter>
        </QueryProvider>
      </AuthProvider>
    </ThemeProvider>,
  );
  // The shell needs an authenticated user; wait for the session to restore.
  await screen.findByRole('button', { name: `Account: ${testUser.name}` });
  return api;
}

describe('AppShell', () => {
  it('shows the folders with Inbox active and an empty inbox', async () => {
    await renderShell();
    const nav = screen.getByRole('navigation', { name: 'Mail folders' });

    expect(within(nav).getByRole('link', { name: /Inbox/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getAllByRole('link')).toHaveLength(5);
    expect(await screen.findByRole('heading', { name: 'Your inbox is empty' })).toBeInTheDocument();
  });

  it('navigates between folders', async () => {
    await renderShell();
    await userEvent.click(screen.getByRole('link', { name: /Sent/ }));
    expect(screen.getByRole('heading', { name: 'Sent is not synced yet' })).toBeInTheDocument();
  });

  it('collapses the sidebar to icons', async () => {
    await renderShell();
    await userEvent.click(screen.getByRole('button', { name: 'Main menu' }));

    const nav = screen.getByRole('navigation', { name: 'Mail folders' });
    expect(within(nav).queryByText('Inbox')).not.toBeInTheDocument();
    expect(within(nav).getByTitle('Inbox')).toBeInTheDocument();
  });

  it('cycles the theme from the top bar', async () => {
    await renderShell();
    const toggle = () => screen.getByRole('button', { name: /^Theme:/ });

    await userEvent.click(toggle());
    expect(toggle()).toHaveAccessibleName('Theme: Light. Switch to Dark');
    await userEvent.click(toggle());
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('opens the account menu and signs out', async () => {
    const logout = vi.fn(async () => {});
    await renderShell(fakeApi({ restoreSession: vi.fn(async () => testUser), logout }));

    await userEvent.click(screen.getByRole('button', { name: `Account: ${testUser.name}` }));
    const menu = screen.getByRole('dialog', { name: 'Account' });
    expect(within(menu).getByText(testUser.email)).toBeInTheDocument();

    await userEvent.click(within(menu).getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(logout).toHaveBeenCalledOnce());
  });

  it('links the empty state and settings button to settings', async () => {
    await renderShell();
    expect(await screen.findByRole('link', { name: 'Connect an account' })).toHaveAttribute(
      'href',
      '/settings',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByText('at /settings')).toBeInTheDocument();
  });
});
