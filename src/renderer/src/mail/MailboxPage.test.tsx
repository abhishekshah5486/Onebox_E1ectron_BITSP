import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { ApiClient } from '../api/client';
import type { MailboxSummary } from '../api/mail';
import { QueryProvider } from '../api/QueryProvider';
import { AuthProvider, useAuth } from '../auth/AuthProvider';
import { fakeApi, routedGet, testUser } from '../test/fake-api';
import { thread } from '../test/mail-fixtures';
import { testQueryClient } from '../test/render';
import { account } from '../test/settings-fixtures';
import { ThemeProvider } from '../theme/ThemeProvider';
import { AccountMailbox, UnifiedMailbox } from './MailboxPage';

const gmail = account({ id: '11111111-1111-4111-8111-111111111111', displayName: 'Personal' });
const page = (
  items: ReturnType<typeof thread>[],
  nextCursor: string | null = null,
  endCursor = 'end',
) => ({
  items,
  nextCursor,
  prevCursor: null,
  endCursor: items.length ? endCursor : null,
});
const summary = (overrides: Partial<MailboxSummary> = {}): MailboxSummary => ({
  accountId: gmail.id,
  server: { total: 8300, unread: 12, updatedAt: '2026-10-07T10:00:00Z' },
  fetched: { conversations: 2, messages: 2 },
  history: { status: 'idle', error: null },
  hasMoreOnServer: true,
  ...overrides,
});

function Gate({ children }: { children: React.ReactNode }) {
  return useAuth().state.status === 'authenticated' ? <>{children}</> : null;
}

function renderAt(path: string, api: ApiClient) {
  render(
    <ThemeProvider>
      <AuthProvider api={api}>
        <QueryProvider client={testQueryClient()}>
          <MemoryRouter initialEntries={[path]}>
            <Gate>
              <Routes>
                <Route
                  path="/inbox"
                  element={<UnifiedMailbox filter="all" title="All inboxes" basePath="/inbox" />}
                />
                <Route path="/accounts/:accountId" element={<AccountMailbox />} />
                <Route path="*" element={<p>elsewhere</p>} />
              </Routes>
            </Gate>
          </MemoryRouter>
        </QueryProvider>
      </AuthProvider>
    </ThemeProvider>,
  );
}

const restore = { restoreSession: vi.fn(async () => testUser) };

describe('UnifiedMailbox', () => {
  it('tags each conversation with the mailbox it came from', async () => {
    renderAt(
      '/inbox',
      fakeApi({
        ...restore,
        get: routedGet({
          '/accounts': () => ({ items: [gmail] }),
          '/mail/threads': () => page([thread({ accountId: gmail.id })]),
        }),
      }),
    );
    const row = await screen.findByRole('row');
    expect(within(row).getByRole('img', { name: 'Gmail' })).toBeInTheDocument();
    expect(within(row).getByTitle('Personal')).toBeInTheDocument();
  });

  it('pages through fetched mail and explains where it ends', async () => {
    const get = routedGet({
      '/accounts': () => ({ items: [gmail] }),
      '/mail/threads': (path) =>
        path.includes('cursor=c1')
          ? page([thread({ id: 'b'.repeat(64), subject: 'Older' })])
          : page([thread({ subject: 'Newest' })], 'c1'),
    });
    renderAt('/inbox', fakeApi({ ...restore, get }));

    await screen.findByText('Newest');
    await userEvent.click(screen.getByRole('button', { name: 'Older' }));
    expect(await screen.findByText('Older')).toBeInTheDocument();
    expect(screen.getByText('51–51')).toBeInTheDocument();
    expect(screen.getByText(/Open an account to load older mail/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Older' })).toBeDisabled();
  });
});

describe('AccountMailbox', () => {
  it('shows the Gmail-style range with the server total', async () => {
    renderAt(
      `/accounts/${gmail.id}`,
      fakeApi({
        ...restore,
        get: routedGet({
          '/accounts': () => ({ items: [gmail] }),
          [`/mail/accounts/${gmail.id}/summary`]: () => summary(),
          [`/mail/accounts/${gmail.id}/threads`]: () =>
            page([thread(), thread({ id: 'c'.repeat(64) })]),
        }),
      }),
    );
    expect(await screen.findByText('1–2 of 8,300')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Personal' })).toBeInTheDocument();
  });

  it('fetches older mail from the server when stored mail runs out', async () => {
    let status: 'idle' | 'fetching' = 'idle';
    const post = vi.fn(async () => {
      status = 'fetching';
      setTimeout(() => (status = 'idle'), 300);
      return summary({ history: { status: 'fetching', error: null } });
    });
    const get = routedGet({
      '/accounts': () => ({ items: [gmail] }),
      [`/mail/accounts/${gmail.id}/summary`]: () => summary({ history: { status, error: null } }),
      [`/mail/accounts/${gmail.id}/threads`]: (path) =>
        path.includes('cursor=end-1')
          ? page([thread({ id: 'd'.repeat(64), subject: 'From the archive' })], null, 'end-2')
          : page([thread({ subject: 'Recent' })], null, 'end-1'),
    });
    renderAt(
      `/accounts/${gmail.id}`,
      fakeApi({ ...restore, get, post: post as ApiClient['post'] }),
    );

    await screen.findByText('Recent');
    await userEvent.click(screen.getByRole('button', { name: 'Older' }));

    expect(post).toHaveBeenCalledWith(`/mail/accounts/${gmail.id}/history`);
    expect(
      await screen.findByRole('status', { name: 'Fetching older mail from Gmail…' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('From the archive', {}, { timeout: 5000 })).toBeInTheDocument();
  });

  it('offers a retry when fetching older mail failed', async () => {
    renderAt(
      `/accounts/${gmail.id}`,
      fakeApi({
        ...restore,
        get: routedGet({
          '/accounts': () => ({ items: [gmail] }),
          [`/mail/accounts/${gmail.id}/summary`]: () =>
            summary({
              history: { status: 'error', error: 'Could not fetch older mail. Try again.' },
            }),
          [`/mail/accounts/${gmail.id}/threads`]: () => page([thread()]),
        }),
      }),
    );
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not fetch older mail');
    expect(within(alert).getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('warns when the account needs attention', async () => {
    const broken = { ...gmail, status: 'AUTH_FAILED' as const };
    renderAt(
      `/accounts/${gmail.id}`,
      fakeApi({
        ...restore,
        get: routedGet({
          '/accounts': () => ({ items: [broken] }),
          [`/mail/accounts/${gmail.id}/summary`]: () => summary(),
          [`/mail/accounts/${gmail.id}/threads`]: () => page([thread()]),
        }),
      }),
    );
    expect(await screen.findByText(/rejected this account’s password/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Fix in Settings' })).toBeInTheDocument();
  });

  it('disables Older at the very end of the mailbox', async () => {
    renderAt(
      `/accounts/${gmail.id}`,
      fakeApi({
        ...restore,
        get: routedGet({
          '/accounts': () => ({ items: [gmail] }),
          [`/mail/accounts/${gmail.id}/summary`]: () =>
            summary({ hasMoreOnServer: false, history: { status: 'complete', error: null } }),
          [`/mail/accounts/${gmail.id}/threads`]: () => page([thread()]),
        }),
      }),
    );
    expect(await screen.findByText(/reached the oldest message/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Older' })).toBeDisabled());
  });
});
