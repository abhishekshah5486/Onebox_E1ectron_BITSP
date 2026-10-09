import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { ApiClient } from '../api/client';
import { QueryProvider } from '../api/QueryProvider';
import { AuthProvider, useAuth } from '../auth/AuthProvider';
import { fakeApi, testUser } from '../test/fake-api';
import { message, thread } from '../test/mail-fixtures';
import { testQueryClient } from '../test/render';
import { ThemeProvider } from '../theme/ThemeProvider';
import { buildSrcDoc } from './EmailFrame';
import { rememberList } from './listContext';
import { ThreadPage } from './ThreadPage';

const id = 'a'.repeat(64);
const post = vi.fn(async (path: string) =>
  path.endsWith('/unsubscribe')
    ? { method: 'link', url: 'https://news.example/out' }
    : { items: [] },
);

function WhenSignedIn() {
  return useAuth().state.status === 'authenticated' ? <ThreadPage /> : null;
}

function setup(data: {
  thread: ReturnType<typeof thread>;
  messages: ReturnType<typeof message>[];
}) {
  post.mockClear();
  const patch = vi.fn(async (_path: string, body: object) => ({
    ...data.thread,
    ...body,
    unreadCount: 0,
  }));
  render(
    <ThemeProvider>
      <AuthProvider
        api={fakeApi({
          restoreSession: vi.fn(async () => testUser),
          get: vi.fn(async (path: string) =>
            path === `/mail/threads/${id}` ? data : { items: [], nextCursor: null },
          ) as ApiClient['get'],
          patch: patch as ApiClient['patch'],
          post: post as ApiClient['post'],
        })}
      >
        <QueryProvider client={testQueryClient()}>
          <MemoryRouter initialEntries={[`/inbox/${id}`]}>
            <Routes>
              <Route path="/inbox/:threadId" element={<WhenSignedIn />} />
              <Route path="/inbox" element={<p>at /inbox</p>} />
            </Routes>
          </MemoryRouter>
        </QueryProvider>
      </AuthProvider>
    </ThemeProvider>,
  );
  return patch;
}

describe('ThreadPage', () => {
  it('shows the conversation and marks it read once', async () => {
    const patch = setup({ thread: thread(), messages: [message({ isRead: false })] });

    expect(await screen.findByRole('heading', { name: 'Demo next week?' })).toBeInTheDocument();
    expect(screen.getByText('Are you free on Tuesday?')).toBeInTheDocument();
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(`/mail/threads/${id}`, { isRead: true }),
    );
    expect(patch).toHaveBeenCalledTimes(1);
  });

  it('leaves an already-read conversation alone', async () => {
    const patch = setup({ thread: thread({ unreadCount: 0 }), messages: [message()] });
    await screen.findByRole('heading', { name: 'Demo next week?' });
    expect(patch).not.toHaveBeenCalled();
  });

  it('collapses earlier read messages and expands them on click', async () => {
    setup({
      thread: thread({ unreadCount: 0, messageCount: 2 }),
      messages: [
        message({ id: 'm1', textBody: 'First full body', snippet: 'First snippet' }),
        message({
          id: 'm2',
          textBody: 'Latest full body',
          from: { name: 'Me', address: 'me@gmail.com' },
        }),
      ],
    });

    expect(await screen.findByText('Latest full body')).toBeInTheDocument();
    expect(screen.queryByText('First full body')).not.toBeInTheDocument();

    const first = screen.getByRole('article', { name: 'Message from Priya' });
    await userEvent.click(within(first).getByRole('button', { expanded: false }));
    expect(screen.getByText('First full body')).toBeInTheDocument();
  });

  it('hides remote images until the user allows them', async () => {
    setup({
      thread: thread({ unreadCount: 0 }),
      messages: [
        message({
          htmlBody: '<p>Promo</p><img src="https://t.example/p.gif">',
          hasRemoteImages: true,
        }),
      ],
    });

    const frame = await screen.findByTitle('Email content');
    expect(frame.getAttribute('sandbox')).not.toContain('allow-scripts');
    expect(frame.getAttribute('srcdoc')).toContain('img-src data:;');

    await userEvent.click(screen.getByRole('button', { name: 'Show images' }));
    expect(screen.getByTitle('Email content').getAttribute('srcdoc')).toContain(
      'img-src https: data:;',
    );
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('stars from the message header and goes back to the list', async () => {
    const patch = setup({ thread: thread({ unreadCount: 0 }), messages: [message()] });
    await userEvent.click(await screen.findByRole('button', { name: 'Not starred' }));
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(`/mail/threads/${id}`, { isStarred: true }),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Back to list' }));
    expect(await screen.findByText('at /inbox')).toBeInTheDocument();
  });
});

describe('ThreadPage actions', () => {
  it('shows where the conversation sits in its list and steps to the next one', async () => {
    rememberList({
      basePath: '/inbox',
      ids: ['b'.repeat(64), id, 'c'.repeat(64)],
      offset: 50,
      total: 120,
    });
    setup({ thread: thread({ unreadCount: 0 }), messages: [message()] });
    expect(await screen.findByText('52 of 120')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Newer' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Older' })).toBeEnabled();
  });

  it('archives from the inbox label chip', async () => {
    setup({ thread: thread({ unreadCount: 0 }), messages: [message()] });
    await userEvent.click(await screen.findByRole('button', { name: 'Remove label Inbox' }));
    expect(post).toHaveBeenCalledWith('/mail/threads/actions', {
      threadIds: [id],
      action: 'archive',
    });
  });

  it('archives from the toolbar and goes back to the list', async () => {
    setup({ thread: thread({ unreadCount: 0 }), messages: [message()] });
    await userEvent.click(await screen.findByRole('button', { name: 'Archive' }));
    expect(post).toHaveBeenCalledWith('/mail/threads/actions', {
      threadIds: [id],
      action: 'archive',
    });
    expect(await screen.findByText('at /inbox')).toBeInTheDocument();
  });

  it("opens the sender's unsubscribe page when one-click is not offered", async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    setup({ thread: thread({ unreadCount: 0, canUnsubscribe: true }), messages: [message()] });
    await userEvent.click(await screen.findByRole('button', { name: 'Unsubscribe from Priya' }));
    await userEvent.click(
      within(screen.getByRole('dialog', { name: 'Unsubscribe' })).getByRole('button', {
        name: 'Unsubscribe',
      }),
    );

    await waitFor(() =>
      expect(open).toHaveBeenCalledWith(
        'https://news.example/out',
        '_blank',
        'noopener,noreferrer',
      ),
    );
    open.mockRestore();
  });

  it('shows who sent and signed the message in the details', async () => {
    setup({
      thread: thread({ unreadCount: 0 }),
      messages: [
        message({
          to: [{ name: '', address: 'me@gmail.com' }],
          authentication: { mailedBy: 'acme.example', signedBy: 'acme.example', encrypted: true },
        }),
      ],
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Show details' }));
    const details = screen.getByRole('dialog', { name: 'Message details' });
    expect(details).toHaveTextContent('mailed-by:acme.example');
    expect(details).toHaveTextContent('Standard encryption (TLS)');
  });
});

describe('buildSrcDoc', () => {
  it('blocks scripts and remote images by default', () => {
    const doc = buildSrcDoc('<p>Hi</p>', false);
    expect(doc).toContain("default-src 'none'");
    expect(doc).toContain('img-src data:;');
    expect(doc).not.toContain('script-src');
  });
});
