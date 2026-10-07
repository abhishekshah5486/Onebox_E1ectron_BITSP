import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { ApiClient } from '../api/client';
import type { MailboxSummary, Thread } from '../api/mail';
import { QueryProvider } from '../api/QueryProvider';
import { AuthProvider } from '../auth/AuthProvider';
import { RequireAuth } from '../auth/guards';
import { fakeApi, routedGet, testUser } from '../test/fake-api';
import { message, thread } from '../test/mail-fixtures';
import { testQueryClient } from '../test/render';
import { account } from '../test/settings-fixtures';
import { ThemeProvider } from '../theme/ThemeProvider';
import { UiVersionProvider } from '../theme/UiVersionProvider';
import { activeHref } from './ConsoleNavigation';
import { ConsoleAccountMailbox, ConsoleUnifiedMailbox } from './ConsoleMailbox';
import { ConsoleShell } from './ConsoleShell';
import { ConsoleThread } from './ConsoleThread';

const gmail = account({
  id: '11111111-1111-4111-8111-111111111111',
  emailAddress: 'abhishek.shah5486.a.very.long.name@gmail.com',
});
const restore = { restoreSession: vi.fn(async () => testUser) };

const threads = (count: number, from = 1) =>
  Array.from({ length: count }, (_, i) =>
    thread({
      id: (from + i).toString(16).padStart(64, '0'),
      subject: `Mail ${from + i}`,
      accountId: gmail.id,
    }),
  );

const pageOf = (all: Thread[]) => (path: string) => {
  const page = Number(new URLSearchParams(path.split('?')[1]).get('page') ?? '1');
  return { items: all.slice((page - 1) * 50, page * 50), page, pageSize: 50, total: all.length };
};

const summary = (overrides: Partial<MailboxSummary> = {}): MailboxSummary => ({
  accountId: gmail.id,
  folder: 'inbox',
  server: { total: 8300, unread: 12, updatedAt: '2026-10-07T10:00:00Z' },
  fetched: { conversations: 50, messages: 50 },
  history: { status: 'idle', error: null },
  hasMoreOnServer: true,
  ...overrides,
});

beforeEach(() => localStorage.setItem('onebox.ui-version', 'v2'));

function renderConsole(path: string, api: ApiClient) {
  render(
    <ThemeProvider>
      <UiVersionProvider>
        <AuthProvider api={api}>
          <QueryProvider client={testQueryClient()}>
            <MemoryRouter initialEntries={[path]}>
              <Routes>
                <Route element={<RequireAuth />}>
                  <Route element={<ConsoleShell />}>
                    <Route
                      path="/inbox"
                      element={
                        <ConsoleUnifiedMailbox filter="all" title="All inboxes" basePath="/inbox" />
                      }
                    />
                    <Route path="/inbox/:threadId" element={<ConsoleThread basePath="/inbox" />} />
                    <Route
                      path="/accounts/:accountId/:folder"
                      element={<ConsoleAccountMailbox />}
                    />
                    <Route path="/settings" element={<p>at /settings</p>} />
                  </Route>
                </Route>
              </Routes>
            </MemoryRouter>
          </QueryProvider>
        </AuthProvider>
      </UiVersionProvider>
    </ThemeProvider>,
  );
}

describe('v2 console', () => {
  it('shows every account with its full email address and the folders found on its server', async () => {
    renderConsole(
      '/inbox',
      fakeApi({
        ...restore,
        get: routedGet({
          '/accounts': () => ({ items: [gmail] }),
          [`/mail/accounts/${gmail.id}/folders`]: () => ({
            items: [
              { role: 'inbox', path: 'INBOX', total: 8300, unread: 4976, updatedAt: '' },
              { role: 'spam', path: '[Gmail]/Spam', total: 5, unread: 5, updatedAt: '' },
            ],
          }),
        }),
      }),
    );
    const nav = (await screen.findByText('Console Home')).closest('nav')!;
    expect(await within(nav).findByText(gmail.emailAddress)).toBeInTheDocument();
    const spam = await within(nav).findAllByRole('link', { name: /Spam/ });
    expect(spam.map((link) => link.getAttribute('href'))).toContain(`/accounts/${gmail.id}/spam`);
    expect(within(nav).getAllByText('4,976').length).toBeGreaterThan(0);
  });

  it('lists conversations in a table and opens one on click', async () => {
    const get = routedGet({
      '/accounts': () => ({ items: [gmail] }),
      '/mail/threads/': () => ({
        thread: threads(1)[0],
        messages: [
          message({
            subject: 'Mail 1',
            textBody: 'Hello from the console',
            cc: [{ name: 'Ravi', address: 'ravi@acme.example' }],
            receivedAt: '2026-10-07T17:06:30.000Z',
          }),
        ],
      }),
      '/mail/threads?': pageOf(threads(3)),
    });
    renderConsole(
      '/inbox',
      fakeApi({ ...restore, get, patch: vi.fn(async () => threads(1)[0]) as ApiClient['patch'] }),
    );

    const table = await screen.findByRole('table', { name: 'All inboxes conversations' });
    expect(await within(table).findByText('Mail 1')).toBeInTheDocument();
    expect(within(table).getAllByText(gmail.emailAddress)).toHaveLength(3);

    await userEvent.click(within(table).getByText('Mail 1'));
    expect(await screen.findByText('Hello from the console')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Priya/, expanded: true })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Show details' }));
    expect(await screen.findByText('Ravi <ravi@acme.example>')).toBeInTheDocument();
    expect(screen.getByText(/2026-10-07 17:06 UTC/)).toBeInTheDocument();
  });

  it('shows read rows apart from unread ones', async () => {
    renderConsole(
      '/inbox',
      fakeApi({
        ...restore,
        get: routedGet({
          '/accounts': () => ({ items: [gmail] }),
          '/mail/threads?': pageOf([
            thread({ id: '1'.padStart(64, '0'), subject: 'Unread one', unreadCount: 1 }),
            thread({ id: '2'.padStart(64, '0'), subject: 'Read one', unreadCount: 0 }),
          ]),
        }),
      }),
    );
    expect((await screen.findByText('Unread one')).closest('[data-unread]')).not.toBeNull();
    expect(screen.getByText('Read one').closest('[data-unread]')).toBeNull();
  });

  it('pages an account folder back through older mail on the server', async () => {
    let stored = threads(50);
    let status: MailboxSummary['history']['status'] = 'idle';
    const post = vi.fn(async () => {
      status = 'fetching';
      setTimeout(() => {
        stored = [...stored, ...threads(50, 51)];
        status = 'idle';
      }, 50);
      return summary({ history: { status: 'fetching', error: null } });
    });
    const get = routedGet({
      '/accounts': () => ({ items: [gmail] }),
      [`/mail/accounts/${gmail.id}/summary`]: () =>
        summary({
          fetched: { conversations: stored.length, messages: stored.length },
          history: { status, error: null },
        }),
      [`/mail/accounts/${gmail.id}/threads`]: (path) => pageOf(stored)(path),
    });
    renderConsole(
      `/accounts/${gmail.id}/inbox`,
      fakeApi({ ...restore, get, post: post as ApiClient['post'] }),
    );

    expect(await screen.findByText('(8,300, 12 unread)')).toBeInTheDocument();
    await screen.findByText('Mail 1');
    await userEvent.click(screen.getByRole('button', { name: 'Older' }));
    expect(await screen.findByText('Mail 51', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith(`/mail/accounts/${gmail.id}/history?folder=inbox`);
  });

  it('highlights the folder a conversation was opened from', () => {
    expect(activeHref(`/accounts/a/spam/${'f'.repeat(64)}`)).toBe('/accounts/a/spam');
    expect(activeHref('/inbox')).toBe('/inbox');
  });
});
