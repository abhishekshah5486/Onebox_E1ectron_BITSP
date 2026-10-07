import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { fakeApi, testUser } from '../test/fake-api';
import { thread } from '../test/mail-fixtures';
import { renderPage } from '../test/render';
import { MailboxPage } from './MailboxPage';

function Inbox() {
  return useAuth().state.status === 'authenticated' ? <MailboxPage folder="Inbox" /> : null;
}

function setup(get: (path: string) => unknown, overrides: Partial<ApiClient> = {}) {
  const api = fakeApi({
    restoreSession: vi.fn(async () => testUser),
    get: vi.fn(async (path: string) => get(path)) as ApiClient['get'],
    ...overrides,
  });
  renderPage(<Inbox />, { path: '/inbox', api, extraRoutes: [`/inbox/${'a'.repeat(64)}`] });
  return api;
}

const page = (items: ReturnType<typeof thread>[], nextCursor: string | null = null) => ({
  items,
  nextCursor,
});

describe('MailboxPage', () => {
  it('lists conversations with sender, subject, snippet and unread state', async () => {
    renderPage(<Inbox />, {
      path: '/inbox',
      api: fakeApi({
        restoreSession: vi.fn(async () => testUser),
        get: vi.fn(async (path: string) =>
          path.startsWith('/mail/threads')
            ? page([
                thread(),
                thread({ id: 'b'.repeat(64), unreadCount: 0, messageCount: 3, subject: 'Invoice' }),
              ])
            : { items: [] },
        ) as ApiClient['get'],
      }),
    });

    const rows = await screen.findAllByRole('row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAccessibleName('Unread, Priya, Demo next week?');
    expect(rows[1]).toHaveAccessibleName('Priya, Invoice');
    expect(within(rows[1]!).getByText('3')).toBeInTheDocument();
    expect(within(rows[0]!).getByText(/Are you free on Tuesday/)).toBeInTheDocument();
  });

  it('stars a conversation without opening it', async () => {
    const patch = vi.fn(async () => thread({ isStarred: true }));
    renderPage(<Inbox />, {
      path: '/inbox',
      api: fakeApi({
        restoreSession: vi.fn(async () => testUser),
        get: vi.fn(async (path: string) =>
          path.startsWith('/mail/threads') ? page([thread()]) : { items: [] },
        ) as ApiClient['get'],
        patch: patch as ApiClient['patch'],
      }),
      extraRoutes: [`/inbox/${'a'.repeat(64)}`],
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Not starred' }));
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(`/mail/threads/${'a'.repeat(64)}`, { isStarred: true }),
    );
    expect(screen.queryByText(`at /inbox/${'a'.repeat(64)}`)).not.toBeInTheDocument();
  });

  it('opens a conversation on click', async () => {
    renderPage(<Inbox />, {
      path: '/inbox',
      api: fakeApi({
        restoreSession: vi.fn(async () => testUser),
        get: vi.fn(async (path: string) =>
          path.startsWith('/mail/threads') ? page([thread()]) : { items: [] },
        ) as ApiClient['get'],
      }),
      extraRoutes: [`/inbox/${'a'.repeat(64)}`],
    });
    await userEvent.click(await screen.findByRole('row'));
    expect(await screen.findByText(`at /inbox/${'a'.repeat(64)}`)).toBeInTheDocument();
  });

  it('loads older conversations with the cursor', async () => {
    const get = vi.fn(async (path: string) => {
      if (!path.startsWith('/mail/threads')) return { items: [] };
      return path.includes('cursor=c1')
        ? page([thread({ id: 'c'.repeat(64), subject: 'Older one' })])
        : page([thread()], 'c1');
    });
    renderPage(<Inbox />, {
      path: '/inbox',
      api: fakeApi({ restoreSession: vi.fn(async () => testUser), get: get as ApiClient['get'] }),
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Load older conversations' }));
    expect(await screen.findByText('Older one')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(2);
  });

  it('shows a caught-up message when accounts exist but nothing is waiting', async () => {
    setup((path) =>
      path.startsWith('/mail/threads')
        ? page([])
        : path === '/accounts'
          ? { items: [{ id: 'a' }] }
          : { items: [] },
    );
    expect(
      await screen.findByRole('heading', { name: 'You are all caught up' }),
    ).toBeInTheDocument();
  });
});
