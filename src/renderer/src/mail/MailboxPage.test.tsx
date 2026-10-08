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
import { SnackbarProvider } from '../ui/Snackbar';
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
  folder: 'inbox',
  label: null,
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
            <SnackbarProvider>
              <Gate>
                <Routes>
                  <Route
                    path="/inbox"
                    element={<UnifiedMailbox filter="all" title="All inboxes" basePath="/inbox" />}
                  />
                  <Route
                    path="/sent"
                    element={
                      <UnifiedMailbox filter="all" folder="sent" title="Sent" basePath="/sent" />
                    }
                  />
                  <Route path="/accounts/:accountId" element={<AccountMailbox />} />
                  <Route path="/accounts/:accountId/:folder" element={<AccountMailbox />} />
                  <Route path="/accounts/:accountId/labels/:label" element={<AccountMailbox />} />
                </Routes>
              </Gate>
            </SnackbarProvider>
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

  it('asks for one folder across every account', async () => {
    const get = routedGet({
      '/accounts': () => ({ items: [gmail] }),
      '/mail/threads': pageOf([]),
    });
    renderAt('/sent', fakeApi({ ...restore, get }));
    expect(await screen.findByRole('heading', { name: 'Nothing in Sent' })).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith(expect.stringMatching(/^\/mail\/threads\?.*folder=sent/));
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

  it('opens one folder of the account with its own summary', async () => {
    const get = routedGet({
      '/accounts': () => ({ items: [gmail] }),
      [`/mail/accounts/${gmail.id}/summary`]: () =>
        summary({ folder: 'spam', server: null, hasMoreOnServer: false }),
      [`/mail/accounts/${gmail.id}/threads`]: pageOf([]),
    });
    renderAt(`/accounts/${gmail.id}/spam`, fakeApi({ ...restore, get }));

    expect(await screen.findByRole('heading', { name: 'Nothing in Spam' })).toBeInTheDocument();
    expect(screen.getByText(/has not found this folder/)).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith(`/mail/accounts/${gmail.id}/summary?folder=spam`);
    expect(get).toHaveBeenCalledWith(expect.stringMatching(/threads\?.*folder=spam/));
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

describe('conversation actions', () => {
  const folders = {
    items: [
      { role: 'inbox', path: 'INBOX', name: 'INBOX', total: 2, unread: 0, updatedAt: '' },
      {
        role: 'archive',
        path: '[Gmail]/All Mail',
        name: 'All Mail',
        total: 9,
        unread: 0,
        updatedAt: '',
      },
      { role: 'label', path: 'Receipts', name: 'Receipts', total: 1, unread: 0, updatedAt: '' },
    ],
  };
  // Like the server, conversations moved out of the list stop being listed.
  const actionApi = (items: Thread[]) => {
    let listed = items;
    const post = vi.fn(async (path: string, body?: unknown) => {
      if (path.endsWith('/unsubscribe')) return { method: 'one-click', url: null };
      const { threadIds } = body as { threadIds: string[] };
      listed = listed.filter((t) => !threadIds.includes(t.id));
      return { items: [] };
    });
    const get = routedGet({
      '/accounts': () => ({ items: [gmail] }),
      [`/mail/accounts/${gmail.id}/folders`]: () => folders,
      [`/mail/accounts/${gmail.id}/summary`]: () => summary({ hasMoreOnServer: false }),
      [`/mail/accounts/${gmail.id}/threads`]: (path) => pageOf(listed)(path),
      '/mail/threads': (path) => pageOf(listed)(path),
    });
    return { api: fakeApi({ ...restore, get, post: post as ApiClient['post'] }), post, get };
  };
  const select = async (subject: string) => {
    const row = (await screen.findByText(subject)).closest('[role="row"]') as HTMLElement;
    await userEvent.click(within(row).getByRole('checkbox', { name: 'Select conversation' }));
  };

  it('archives the selected conversations and drops them from the list at once', async () => {
    const [keep, done] = threads(2);
    const { api, post } = actionApi([keep!, done!]);
    renderAt('/inbox', api);
    await select('Mail 2');
    const toolbar = screen.getByRole('toolbar', { name: 'Mail actions' });
    await userEvent.click(within(toolbar).getByRole('button', { name: 'Archive' }));

    expect(post).toHaveBeenCalledWith('/mail/threads/actions', {
      threadIds: [done!.id],
      action: 'archive',
    });
    await waitFor(() => expect(screen.queryByText('Mail 2')).not.toBeInTheDocument());
    expect(screen.getByText('Mail 1')).toBeInTheDocument();
  });

  it('reports the action and undoes it from the snackbar', async () => {
    const { api, post } = actionApi(threads(2));
    post.mockImplementation(async (path: string) =>
      path === '/mail/threads/undo' ? { items: [] } : { items: [], undoToken: 'tok-1' },
    );
    renderAt('/inbox', api);
    await select('Mail 1');
    await userEvent.click(
      within(screen.getByRole('toolbar', { name: 'Mail actions' })).getByRole('button', {
        name: 'Delete',
      }),
    );
    expect(await screen.findByText('Conversation moved to Trash.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(post).toHaveBeenCalledWith('/mail/threads/undo', { undoToken: 'tok-1' });
    expect(await screen.findByText('Action undone.')).toBeInTheDocument();
  });

  it('selects by read state from the select menu', async () => {
    const [first, second] = threads(2);
    const { api } = actionApi([{ ...first!, unreadCount: 0 }, second!]);
    renderAt('/inbox', api);
    await screen.findByText('Mail 1');
    await userEvent.click(screen.getByRole('button', { name: 'Select by' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Unread' }));
    expect(screen.getByRole('checkbox', { name: 'Select all' })).toHaveAttribute(
      'aria-checked',
      'mixed',
    );
    const rows = screen.getAllByRole('row');
    expect(rows.map((row) => row.getAttribute('aria-selected'))).toEqual(['false', 'true']);
  });

  it("moves to one of the account's labels from its folder", async () => {
    const { api, post } = actionApi(threads(1));
    renderAt(`/accounts/${gmail.id}/archive`, api);
    expect(await screen.findByRole('heading', { name: gmail.emailAddress })).toBeInTheDocument();
    expect(await screen.findByText(/All Mail/)).toBeInTheDocument();
    await select('Mail 1');
    await userEvent.click(screen.getByRole('button', { name: 'Move to' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Receipts' }));

    expect(post).toHaveBeenCalledWith('/mail/threads/actions', {
      threadIds: [threads(1)[0]!.id],
      action: 'move',
      to: { label: 'Receipts' },
      from: { role: 'archive' },
    });
  });

  it('lists a label by its path', async () => {
    const { api, get } = actionApi(threads(1));
    renderAt(`/accounts/${gmail.id}/labels/${encodeURIComponent('Work/Clients')}`, api);
    expect(await screen.findByText('Mail 1')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith(expect.stringMatching(/threads\?.*label=Work%2FClients/));
  });

  it('shows gmail tabs on the inbox and asks for the chosen one', async () => {
    const { api, get } = actionApi(threads(1));
    renderAt('/inbox', api);
    const tabs = await screen.findByRole('tablist', { name: 'Inbox categories' });
    expect(within(tabs).getByRole('tab', { name: 'Primary' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await userEvent.click(within(tabs).getByRole('tab', { name: 'Promotions' }));
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith(expect.stringMatching(/category=promotions/)),
    );
  });

  it('unsubscribes from a row after confirming in a dialog', async () => {
    const { api, post } = actionApi([thread({ ...threads(1)[0]!, canUnsubscribe: true })]);
    renderAt('/inbox', api);
    // The button only shows while the row is hovered, which jsdom cannot do.
    await userEvent.click(
      await screen.findByRole('button', { name: 'Unsubscribe from Priya', hidden: true }),
    );
    const dialog = screen.getByRole('dialog', { name: 'Unsubscribe' });
    expect(dialog).toHaveTextContent('this mailing list (Priya)');
    expect(post).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Unsubscribe' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`/mail/threads/${threads(1)[0]!.id}/unsubscribe`),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
