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
import { ThreadPage } from './ThreadPage';

const id = 'a'.repeat(64);

function WhenSignedIn() {
  return useAuth().state.status === 'authenticated' ? <ThreadPage /> : null;
}

function setup(data: {
  thread: ReturnType<typeof thread>;
  messages: ReturnType<typeof message>[];
}) {
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

  it('stars from the toolbar and goes back to the list', async () => {
    const patch = setup({ thread: thread({ unreadCount: 0 }), messages: [message()] });
    await userEvent.click(await screen.findByRole('button', { name: 'Star' }));
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(`/mail/threads/${id}`, { isStarred: true }),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Back to list' }));
    expect(await screen.findByText('at /inbox')).toBeInTheDocument();
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
