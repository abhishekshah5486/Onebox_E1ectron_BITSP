import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../api/client';
import type { StorageAccount, StorageSignInFailure } from '../api/settings';
import { useAuth } from '../auth/AuthProvider';
import { fakeApi, routedGet, testUser } from '../test/fake-api';
import { renderPage } from '../test/render';
import { FlashProvider } from './flash';
import { StorageSection } from './StorageSection';

function Card() {
  return useAuth().state.status === 'authenticated' ? (
    <FlashProvider>
      <StorageSection />
    </FlashProvider>
  ) : null;
}

const account = (overrides: Partial<StorageAccount> = {}): StorageAccount => ({
  id: 'g1',
  provider: 'GOOGLE_DRIVE',
  email: 'me@gmail.com',
  defaultPath: 'OneBox',
  connectedAt: '2026-10-09T00:00:00Z',
  updatedAt: '2026-10-09T00:00:00Z',
  ...overrides,
});

// What the server reports; tests change `failures` to stand in for a refused sign-in.
const server: { failures: StorageSignInFailure[] } = { failures: [] };

function setup(accounts: StorageAccount[], overrides: Partial<ApiClient> = {}) {
  server.failures = [];
  const api = fakeApi({
    restoreSession: vi.fn(async () => testUser),
    get: routedGet({
      '/settings/storage': () => ({
        providers: ['GOOGLE_DRIVE', 'ONEDRIVE', 'DROPBOX'],
        accounts,
        failures: server.failures,
      }),
    }),
    ...overrides,
  });
  renderPage(<Card />, { path: '/settings', api });
  return api;
}

describe('StorageSection', () => {
  it('connects Google Drive from the Connect storage menu', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const post = vi.fn(async () => ({
      url: 'https://accounts.google.com/o/oauth2/v2/auth?x=1',
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    }));
    setup([account()], { post: post as ApiClient['post'] });
    await userEvent.click(await screen.findByRole('button', { name: 'Connect storage' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Google Drive/ }));
    await waitFor(() =>
      expect(open).toHaveBeenCalledWith(
        'https://accounts.google.com/o/oauth2/v2/auth?x=1',
        'onebox-storage',
        expect.any(String),
      ),
    );
    expect(post).toHaveBeenCalledWith('/settings/storage/connect', { provider: 'GOOGLE_DRIVE' });
  });

  it('connects OneDrive and shows it beside Google Drive', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    const post = vi.fn(async () => ({ url: 'https://login.microsoftonline.com/x' }));
    setup(
      [
        account(),
        account({ id: 'o1', provider: 'ONEDRIVE', email: 'me@outlook.com', defaultPath: '' }),
      ],
      {
        post: post as ApiClient['post'],
      },
    );
    const table = within(await screen.findByRole('table'));
    expect(await table.findByText('OneDrive')).toBeInTheDocument();
    expect(table.getByText('My files')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Connect storage' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /OneDrive/ }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/settings/storage/connect', { provider: 'ONEDRIVE' }),
    );
  });

  it('connects Dropbox from the Connect storage menu', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    const post = vi.fn(async () => ({ url: 'https://www.dropbox.com/oauth2/authorize?x=1' }));
    setup([], { post: post as ApiClient['post'] });
    await userEvent.click(await screen.findByRole('button', { name: 'Connect storage' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Dropbox/ }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/settings/storage/connect', { provider: 'DROPBOX' }),
    );
  });

  async function startOneDrive() {
    const popup = { closed: false, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
    const post = vi.fn(async () => ({
      url: 'https://login.microsoftonline.com/x',
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    }));
    setup([account()], { post: post as ApiClient['post'] });
    await userEvent.click(await screen.findByRole('button', { name: 'Connect storage' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /OneDrive/ }));
    expect(await screen.findByText('Waiting for OneDrive sign-in…')).toBeInTheDocument();
    return popup;
  }

  it('says the sign-in failed when its window is closed early', async () => {
    const popup = await startOneDrive();
    popup.closed = true;
    expect(
      await screen.findByText(
        /sign-in window was closed before it finished/,
        {},
        { timeout: 4000 },
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Couldn't connect OneDrive.")).toBeInTheDocument();
    expect(screen.queryByText('Waiting for OneDrive sign-in…')).toBeNull();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('says when access was not given', async () => {
    const popup = await startOneDrive();
    server.failures = [
      {
        provider: 'ONEDRIVE',
        reason: 'ACCESS_DENIED',
        message: 'OneBox was not given access to OneDrive.',
        at: new Date().toISOString(),
      },
    ];
    popup.closed = true;
    expect(
      await screen.findByText(/OneBox needs permission to save files/, {}, { timeout: 4000 }),
    ).toBeInTheDocument();
  });

  it('confirms a cancelled sign-in and closes its window', async () => {
    const popup = await startOneDrive();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByText('OneDrive connection cancelled.')).toBeInTheDocument();
    expect(popup.close).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Connect again' })).toBeInTheDocument();
  });

  it('lists accounts with their folders and edits one', async () => {
    const patch = vi.fn(async () =>
      account({ id: 'g2', email: 'work@gmail.com', defaultPath: 'Work/Receipts' }),
    );
    setup([account(), account({ id: 'g2', email: 'work@gmail.com', defaultPath: '' })], {
      patch: patch as ApiClient['patch'],
    });
    const table = within(await screen.findByRole('table'));
    expect(await table.findByText('My Drive / OneBox')).toBeInTheDocument();
    expect(table.getByText('My Drive')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('checkbox', { name: 'work@gmail.com' }));
    await userEvent.click(screen.getByRole('button', { name: 'Edit folder' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Default folder' }));
    await userEvent.type(dialog.getByRole('textbox'), 'Work/Receipts');
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/settings/storage/g2', {
        defaultPath: 'Work/Receipts',
      }),
    );
  });

  it('asks before disconnecting an account', async () => {
    const remove = vi.fn(async () => undefined);
    setup([account()], { delete: remove as ApiClient['delete'] });
    await userEvent.click(await screen.findByRole('checkbox', { name: 'me@gmail.com' }));
    await userEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    const dialog = await screen.findByRole('dialog', { name: 'Disconnect storage account' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Disconnect' }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith('/settings/storage/g1'));
  });
});
