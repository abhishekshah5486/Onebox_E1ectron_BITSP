import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import { QueryProvider } from '../api/QueryProvider';
import { AuthProvider } from '../auth/AuthProvider';
import { RequireAuth } from '../auth/guards';
import { UnifiedMailbox } from '../mail/MailboxPage';
import { account } from '../test/settings-fixtures';
import { fakeApi, routedGet, testUser } from '../test/fake-api';
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
                  <Route
                    path="/inbox"
                    element={<UnifiedMailbox filter="all" title="All inboxes" basePath="/inbox" />}
                  />
                  <Route
                    path="/starred"
                    element={
                      <UnifiedMailbox filter="starred" title="Starred" basePath="/starred" />
                    }
                  />
                  <Route path="/accounts/:accountId" element={<p>account page</p>} />
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

const work = account({
  id: '22222222-2222-4222-8222-222222222222',
  provider: 'OUTLOOK',
  displayName: 'Work',
  emailAddress: 'me@corp.example',
});
const broken = account({
  id: '33333333-3333-4333-8333-333333333333',
  status: 'AUTH_FAILED',
  displayName: 'Old',
});

describe('AppShell', () => {
  it('shows All inboxes active and an empty inbox when nothing is connected', async () => {
    await renderShell();
    const nav = screen.getByRole('navigation', { name: 'Mailboxes' });

    expect(within(nav).getByRole('link', { name: /All inboxes/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).queryByText('Accounts')).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Your inbox is empty' })).toBeInTheDocument();
  });

  it('lists each account with its logo, server unread count and problems', async () => {
    await renderShell(
      fakeApi({
        restoreSession: vi.fn(async () => testUser),
        get: routedGet({
          '/accounts': () => ({ items: [work, broken] }),
          [`/mail/accounts/${work.id}/summary`]: () => ({
            accountId: work.id,
            server: { total: 500, unread: 7, updatedAt: '2026-10-07T10:00:00Z' },
            fetched: { conversations: 50, messages: 50 },
            history: { status: 'idle', error: null },
            hasMoreOnServer: true,
          }),
          [`/mail/accounts/${broken.id}/summary`]: () => ({
            accountId: broken.id,
            server: null,
            fetched: { conversations: 0, messages: 0 },
            history: { status: 'idle', error: null },
            hasMoreOnServer: false,
          }),
        }),
      }),
    );
    const nav = screen.getByRole('navigation', { name: 'Mailboxes' });
    const workLink = await within(nav).findByRole('link', { name: /Work/ });

    expect(within(workLink).getByRole('img', { name: 'Outlook' })).toBeInTheDocument();
    expect(await within(workLink).findByLabelText('7 unread in Work')).toBeInTheDocument();
    expect(await within(nav).findByLabelText('7 unread in all inboxes')).toBeInTheDocument();
    expect(
      within(within(nav).getByRole('link', { name: /Old/ })).getByLabelText('Needs attention'),
    ).toBeInTheDocument();

    await userEvent.click(workLink);
    expect(screen.getByText('account page')).toBeInTheDocument();
  });

  it('navigates to Starred', async () => {
    await renderShell();
    await userEvent.click(screen.getByRole('link', { name: /Starred/ }));
    expect(
      await screen.findByRole('heading', { name: 'No starred conversations' }),
    ).toBeInTheDocument();
  });

  it('collapses the sidebar to icons', async () => {
    await renderShell();
    await userEvent.click(screen.getByRole('button', { name: 'Main menu' }));

    const nav = screen.getByRole('navigation', { name: 'Mailboxes' });
    expect(within(nav).queryByText('All inboxes')).not.toBeInTheDocument();
    expect(within(nav).getByTitle('All inboxes')).toBeInTheDocument();
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
