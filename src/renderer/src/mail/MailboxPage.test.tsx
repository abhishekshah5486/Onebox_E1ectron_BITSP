import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { ApiClient } from '../api/client';
import type { MailboxSummary, Thread } from '../api/mail';
import { QueryProvider } from '../api/QueryProvider';
import { AuthProvider, useAuth } from '../auth/AuthProvider';
import { fakeApi, routedGet, testUser } from '../test/fake-api';
import { thread } from '../test/mail-fixtures';
import { testQueryClient } from '../test/render';
import { account } from '../test/settings-fixtures';
import { ThemeProvider } from '../theme/ThemeProvider';
import { AccountMailbox, UnifiedMailbox } from './MailboxPage';

const gmail = account({ id: '11111111-1111-4111-8111-111111111111', emailAddress: 'me@gmail.com' });
const restore = { restoreSession: vi.fn(async () => testUser) };

// Builds `count` conversations with distinct ids and numbered subjects.
const threads = (count: number, from = 1) =>
  Array.from({ length: count }, (_, i) =>
    thread({
      id: (from + i).toString(16).padStart(64, '0'),
      subject: `Mail ${from + i}`,
      accountId: gmail.id,
    }),
  );

// Serves `all` as a stored list, paged like the real API.
const pageOf = (all: Thread[]) => (path: string) => {
  const page = Number(new URLSearchParams(path.split('?')[1]).get('page') ?? '1');
  return { items: all.slice((page - 1) * 50, page * 50), page, pageSize: 50, total: all.length };
};

const summary = (overrides: Partial<MailboxSummary> = {}): MailboxSummary => ({
  accountId: gmail.id,
  server: { total: 8300, unread: 12, updatedAt: '2026-10-07T10:00:00Z' },
  fetched: { conversations: 50, messages: 50 },
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
              </Routes>
            </Gate>
          </MemoryRouter>
        </QueryProvider>
      </AuthProvider>
    </ThemeProvider>,
  );
}

const older = () => screen.getByRole('button', { name: 'Older' });

describe('UnifiedMailbox', () => {
  it('tags each conversation with its account and pages through fetched mail', async () => {
    renderAt(
      '/inbox',
      fakeApi({
        ...restore,
        get: routedGet({
          '/accounts': () => ({ items: [gmail] }),
          '/mail/threads': pageOf(threads(60)),
        }),
      }),
    );
    const firstRow = (await screen.findAllByRole('row'))[0]!;
    expect(within(firstRow).getByRole('img', { name: 'Gmail' })).toBeInTheDocument();
    expect(screen.getByText('1–50 of 60')).toBeInTheDocument();

    await userEvent.click(older());
    expect(await screen.findByText('51–60 of 60')).toBeInTheDocument();
    expect(screen.getByText(/Open an account to load older mail/)).toBeInTheDocument();
    expect(older()).toBeDisabled();
  });
});

describe('AccountMailbox', () => {
  it('shows the range against the server total and the email address as the title', async () => {
    renderAt(
      `/accounts/${gmail.id}`,
      fakeApi({
        ...restore,
        get: routedGet({
          '/accounts': () => ({ items: [gmail] }),
          [`/mail/accounts/${gmail.id}/summary`]: () => summary(),
          [`/mail/accounts/${gmail.id}/threads`]: pageOf(threads(50)),
        }),
      }),
    );
    expect(await screen.findByText('1–50 of 8,300')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'me@gmail.com' })).toBeInTheDocument();
  });

  it('opens an already stored page without asking the server', async () => {
    const post = vi.fn();
    renderAt(
      `/accounts/${gmail.id}`,
      fakeApi({
        ...restore,
        post: post as ApiClient['post'],
        get: routedGet({
          '/accounts': () => ({ items: [gmail] }),
          [`/mail/accounts/${gmail.id}/summary`]: () =>
            summary({ fetched: { conversations: 120, messages: 120 } }),
          [`/mail/accounts/${gmail.id}/threads`]: pageOf(threads(120)),
        }),
      }),
    );
    await screen.findByText('Mail 1');
    await userEvent.click(older());
    expect(await screen.findByText('51–100 of 8,300')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('fetches older mail batch by batch until the next page is full', async () => {
    let stored = threads(50);
    let status: MailboxSummary['history']['status'] = 'idle';
    const post = vi.fn(async () => {
      status = 'fetching';
      setTimeout(() => {
        stored = [...stored, ...threads(30, stored.length + 1)];
        status = 'idle';
      }, 100);
      return summary({ history: { status: 'fetching', error: null } });
    });
    renderAt(
      `/accounts/${gmail.id}`,
      fakeApi({
        ...restore,
        post: post as ApiClient['post'],
        get: routedGet({
          '/accounts': () => ({ items: [gmail] }),
          [`/mail/accounts/${gmail.id}/summary`]: () =>
            summary({
              fetched: { conversations: stored.length, messages: stored.length },
              history: { status, error: null },
            }),
          [`/mail/accounts/${gmail.id}/threads`]: (path) => pageOf(stored)(path),
        }),
      }),
    );

    await screen.findByText('Mail 1');
    await userEvent.click(older());
    expect(
      await screen.findByRole('status', { name: 'Loading older mail from Gmail…' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('51–100 of 8,300', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('says something went wrong and offers a retry when the fetch fails', async () => {
    const post = vi.fn(async () => summary({ history: { status: 'fetching', error: null } }));
    renderAt(
      `/accounts/${gmail.id}`,
      fakeApi({
        ...restore,
        post: post as ApiClient['post'],
        get: routedGet({
          '/accounts': () => ({ items: [gmail] }),
          [`/mail/accounts/${gmail.id}/summary`]: () =>
            post.mock.calls.length > 0
              ? summary({ history: { status: 'error', error: 'Could not fetch older mail.' } })
              : summary(),
          [`/mail/accounts/${gmail.id}/threads`]: pageOf(threads(50)),
        }),
      }),
    );

    await screen.findByText('Mail 1');
    await userEvent.click(older());
    const alert = await screen.findByRole('alert', {}, { timeout: 5000 });
    expect(alert).toHaveTextContent('Something went wrong while loading older mail.');
    expect(within(alert).getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.getByText('1–50 of 8,300')).toBeInTheDocument();
  });

  it('shows the remaining mail on the last page and disables Older', async () => {
    renderAt(
      `/accounts/${gmail.id}`,
      fakeApi({
        ...restore,
        get: routedGet({
          '/accounts': () => ({ items: [gmail] }),
          [`/mail/accounts/${gmail.id}/summary`]: () =>
            summary({ hasMoreOnServer: false, history: { status: 'complete', error: null } }),
          [`/mail/accounts/${gmail.id}/threads`]: pageOf(threads(12)),
        }),
      }),
    );
    expect(await screen.findByText(/reached the oldest email/)).toBeInTheDocument();
    await waitFor(() => expect(older()).toBeDisabled());
  });

  it('warns when the account needs attention', async () => {
    renderAt(
      `/accounts/${gmail.id}`,
      fakeApi({
        ...restore,
        get: routedGet({
          '/accounts': () => ({ items: [{ ...gmail, status: 'AUTH_FAILED' as const }] }),
          [`/mail/accounts/${gmail.id}/summary`]: () => summary(),
          [`/mail/accounts/${gmail.id}/threads`]: pageOf(threads(5)),
        }),
      }),
    );
    expect(await screen.findByText(/rejected this account’s password/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Fix in Settings' })).toBeInTheDocument();
  });
});
