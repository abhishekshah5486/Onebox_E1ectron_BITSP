import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../api/client';
import type { DriveAccount } from '../api/settings';
import { useAuth } from '../auth/AuthProvider';
import { fakeApi, routedGet, testUser } from '../test/fake-api';
import { renderPage } from '../test/render';
import { FlashProvider } from './flash';
import { GoogleDriveCard } from './GoogleDriveCard';

function Card() {
  return useAuth().state.status === 'authenticated' ? (
    <FlashProvider>
      <GoogleDriveCard />
    </FlashProvider>
  ) : null;
}

const account = (overrides: Partial<DriveAccount> = {}): DriveAccount => ({
  id: 'g1',
  email: 'me@gmail.com',
  defaultPath: 'OneBox',
  connectedAt: '2026-10-09T00:00:00Z',
  updatedAt: '2026-10-09T00:00:00Z',
  ...overrides,
});

function setup(accounts: DriveAccount[], overrides: Partial<ApiClient> = {}) {
  const api = fakeApi({
    restoreSession: vi.fn(async () => testUser),
    get: routedGet({ '/settings/integrations/google': () => ({ configured: true, accounts }) }),
    ...overrides,
  });
  renderPage(<Card />, { path: '/settings', api });
  return api;
}

describe('GoogleDriveCard', () => {
  it('opens Google sign-in to connect another account', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const post = vi.fn(async () => ({ url: 'https://accounts.google.com/o/oauth2/v2/auth?x=1' }));
    setup([account()], { post: post as ApiClient['post'] });
    await userEvent.click(await screen.findByRole('button', { name: 'Connect another account' }));
    await waitFor(() =>
      expect(open).toHaveBeenCalledWith(
        'https://accounts.google.com/o/oauth2/v2/auth?x=1',
        'onebox-google',
        expect.any(String),
      ),
    );
    expect(post).toHaveBeenCalledWith('/settings/integrations/google/connect');
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

    await userEvent.click(screen.getByRole('radio', { name: 'work@gmail.com' }));
    await userEvent.click(screen.getByRole('button', { name: 'Edit folder' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Default folder' }));
    await userEvent.type(dialog.getByRole('textbox'), 'Work/Receipts');
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/settings/integrations/google/g2', {
        defaultPath: 'Work/Receipts',
      }),
    );
  });

  it('asks before disconnecting an account', async () => {
    const remove = vi.fn(async () => undefined);
    setup([account()], { delete: remove as ApiClient['delete'] });
    await userEvent.click(await screen.findByRole('radio', { name: 'me@gmail.com' }));
    await userEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    const dialog = await screen.findByRole('dialog', { name: 'Disconnect Google account' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Disconnect' }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith('/settings/integrations/google/g1'));
  });
});
