import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { ApiClient } from '../api/client';
import type { Message } from '../api/mail';
import { QueryProvider } from '../api/QueryProvider';
import { AuthProvider } from '../auth/AuthProvider';
import { RequireAuth } from '../auth/guards';
import { ConsoleCompose } from '../console/ConsoleCompose';
import { FlashProvider } from '../settings/flash';
import { AppShell } from '../shell/AppShell';
import { fakeApi, routedGet, testUser } from '../test/fake-api';
import { testQueryClient } from '../test/render';
import { account } from '../test/settings-fixtures';
import { ThemeProvider } from '../theme/ThemeProvider';
import { UiVersionProvider } from '../theme/UiVersionProvider';
import { SnackbarProvider } from '../ui/Snackbar';
import { ComposeProvider } from './ComposeProvider';
import { InlineReply } from './InlineReply';

const queued = {
  id: 'o1',
  accountId: 'a1',
  threadId: null,
  to: [],
  subject: 'Pricing',
  status: 'scheduled',
  error: null,
  sendAt: new Date().toISOString(),
  sentAt: null,
  createdAt: new Date().toISOString(),
};

const api = (post = vi.fn(async (path: string) => (path === '/mail/send' ? queued : {}))) => ({
  post,
  api: fakeApi({
    restoreSession: vi.fn(async () => testUser),
    get: routedGet({ '/accounts': () => ({ items: [account()] }) }),
    post: post as unknown as ApiClient['post'],
    put: vi.fn(async (_path: string, body: unknown) => body) as unknown as ApiClient['put'],
  }),
});

function renderApp(client: ApiClient, ui: React.ReactNode, path = '/inbox') {
  return render(
    <ThemeProvider>
      <UiVersionProvider>
        <AuthProvider api={client}>
          <QueryProvider client={testQueryClient()}>
            <MemoryRouter initialEntries={[path]}>
              <Routes>
                <Route element={<RequireAuth />}>
                  <Route path="*" element={ui} />
                </Route>
              </Routes>
            </MemoryRouter>
          </QueryProvider>
        </AuthProvider>
      </UiVersionProvider>
    </ThemeProvider>,
  );
}

const body = () => screen.getByRole('textbox', { name: 'Message body' });

beforeEach(() => localStorage.clear());

describe('compose in v1', () => {
  it('writes a message in a window, sends it, and undo brings it back', async () => {
    const { api: client, post } = api(
      vi.fn(async (path: string) =>
        path === '/mail/send'
          ? queued
          : {
              id: 'd2',
              accountId: 'a1',
              to: [{ name: null, address: 'priya@acme.example' }],
              cc: [],
              bcc: [],
              subject: 'Pricing',
              html: '<p>Hi</p>',
              text: 'Hi',
              attachments: [],
              replyTo: null,
              note: null,
              updatedAt: new Date().toISOString(),
            },
      ),
    );
    renderApp(client, <AppShell />);
    await userEvent.click(await screen.findByRole('button', { name: 'Compose' }));
    const window = within(await screen.findByRole('dialog', { name: 'New Message' }));

    await userEvent.type(
      window.getByRole('textbox', { name: 'To' }),
      'Priya <priya@acme.example>,',
    );
    expect(window.getByText('Priya')).toBeInTheDocument();
    await userEvent.type(window.getByRole('textbox', { name: 'Subject' }), 'Pricing');
    await userEvent.type(body(), 'Hi Priya');
    expect(screen.getByRole('dialog', { name: 'Pricing' })).toBeInTheDocument();
    await userEvent.click(window.getByRole('button', { name: 'Send' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        '/mail/send',
        expect.objectContaining({
          accountId: 'a1',
          to: [{ name: 'Priya', address: 'priya@acme.example' }],
          subject: 'Pricing',
          text: 'Hi Priya',
        }),
      ),
    );
    expect(screen.queryByRole('dialog', { name: 'Pricing' })).toBeNull();
    expect(await screen.findByText('Message sent.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(post).toHaveBeenCalledWith('/mail/outbox/o1/cancel');
    expect(await screen.findByRole('dialog', { name: 'Pricing' })).toBeInTheDocument();
  });

  it('saves a draft shortly after typing, and needs a recipient to send', async () => {
    const { api: client, post } = api();
    renderApp(client, <AppShell />);
    await userEvent.click(await screen.findByRole('button', { name: 'Compose' }));
    const window = within(await screen.findByRole('dialog', { name: 'New Message' }));
    await userEvent.type(window.getByRole('textbox', { name: 'Subject' }), 'Notes');

    await waitFor(
      () =>
        expect(client.put).toHaveBeenCalledWith(
          expect.stringMatching(/^\/mail\/drafts\/[0-9a-f-]{36}$/),
          expect.objectContaining({ subject: 'Notes' }),
        ),
      { timeout: 3_000 },
    );
    expect(
      await within(screen.getByRole('dialog', { name: 'Notes' })).findByText('Draft saved'),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Add at least one recipient.')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalledWith('/mail/send', expect.anything());
  });

  it('shares a file too big to attach from cloud storage by link', async () => {
    const { api: client } = api();
    client.get = routedGet({
      '/accounts': () => ({ items: [account()] }),
      '/settings/storage': () => ({
        providers: ['GOOGLE_DRIVE'],
        accounts: [
          {
            id: 'g1',
            provider: 'GOOGLE_DRIVE',
            email: 'me@gmail.com',
            defaultPath: 'OneBox',
            connectedAt: '2026-10-01T00:00:00Z',
            updatedAt: '2026-10-01T00:00:00Z',
          },
        ],
        failures: [],
      }),
    });
    client.upload = vi.fn(async (_path: string, file: File) => ({
      name: file.name,
      link: 'https://drive.example/big',
      provider: 'GOOGLE_DRIVE',
      sizeBytes: file.size,
    })) as unknown as ApiClient['upload'];
    renderApp(client, <AppShell />);
    await userEvent.click(await screen.findByRole('button', { name: 'Compose' }));
    await screen.findByRole('dialog', { name: 'New Message' });

    const big = new File([new Uint8Array(26 * 1024 * 1024)], 'video.mp4', { type: 'video/mp4' });
    await userEvent.upload(screen.getByLabelText('Files to attach'), big);
    const ask = within(
      await screen.findByRole('dialog', { name: 'Large files must be shared with Google Drive' }),
    );
    await userEvent.click(ask.getByRole('button', { name: 'OK, got it' }));
    await waitFor(() =>
      expect(client.upload).toHaveBeenCalledWith(
        '/mail/uploads/cloud',
        big,
        expect.objectContaining({ headers: { 'x-storage-account': 'g1' } }),
      ),
    );
    await waitFor(() => expect(body().innerHTML).toContain('https://drive.example/big'));
  });

  it('replies to everyone right under the conversation', async () => {
    const { api: client, post } = api();
    const message: Message = {
      id: 'm1',
      accountId: 'a1',
      from: { name: 'Priya', address: 'priya@acme.example' },
      to: [
        { name: 'Me', address: 'me@gmail.com' },
        { name: 'Sam', address: 'sam@acme.example' },
      ],
      cc: [],
      replyTo: [],
      subject: 'Pricing',
      snippet: '',
      textBody: 'Can you send pricing?',
      htmlBody: null,
      hasRemoteImages: false,
      attachments: [],
      isRead: true,
      isStarred: false,
      receivedAt: '2026-10-08T10:00:00.000Z',
      sentAt: null,
      authentication: null,
    };
    renderApp(
      client,
      <SnackbarProvider>
        <ComposeProvider>
          <InlineReply message={message} />
        </ComposeProvider>
      </SnackbarProvider>,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Reply all' }));
    const reply = within(screen.getByRole('region', { name: 'Reply all' }));
    // Who it goes to shows in one line until clicked, then as chips.
    await userEvent.click(reply.getByRole('button', { name: 'Priya, Sam' }));
    expect(reply.getByText('Priya')).toBeInTheDocument();
    expect(reply.getByText('Sam')).toBeInTheDocument();
    expect(body().innerHTML).toContain('Can you send pricing?');
    // The subject follows the conversation, so it isn't asked for.
    expect(reply.queryByRole('textbox', { name: 'Subject' })).toBeNull();

    await userEvent.click(reply.getByRole('button', { name: 'Send' }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        '/mail/send',
        expect.objectContaining({
          subject: 'Re: Pricing',
          replyTo: { messageId: 'm1', mode: 'replyAll' },
          cc: [{ name: 'Sam', address: 'sam@acme.example' }],
        }),
      ),
    );
    expect(await screen.findByRole('button', { name: 'Reply' })).toBeInTheDocument();
  });
});

describe('compose in v2', () => {
  beforeEach(() => localStorage.setItem('onebox.ui-version', 'v2'));
  afterEach(() => localStorage.removeItem('onebox.ui-version'));

  it('writes and sends from a console form', async () => {
    const { api: client, post } = api();
    renderApp(
      client,
      <FlashProvider>
        <ComposeProvider>
          <ConsoleCompose />
        </ComposeProvider>
      </FlashProvider>,
      '/compose',
    );
    expect(
      await screen.findByRole('heading', { name: 'Compose email', level: 1 }),
    ).toBeInTheDocument();
    expect(await screen.findByText('me@gmail.com')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Add at least one recipient.')).toBeInTheDocument();

    await userEvent.type(screen.getByRole('combobox', { name: 'To' }), 'sam@acme.example{Enter}');
    expect(await screen.findByText('sam@acme.example')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Subject'), 'Hello');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        '/mail/send',
        expect.objectContaining({
          to: [{ name: null, address: 'sam@acme.example' }],
          subject: 'Hello',
        }),
      ),
    );
    expect(await screen.findByText('Message sent.')).toBeInTheDocument();
  });
});
