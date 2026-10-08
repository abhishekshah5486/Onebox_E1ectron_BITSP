import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../api/client';
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

const status = (connected: boolean) => ({
  configured: true,
  connected,
  email: connected ? 'me@gmail.com' : null,
  connectedAt: null,
});

function setup(connected: boolean, overrides: Partial<ApiClient> = {}) {
  const api = fakeApi({
    restoreSession: vi.fn(async () => testUser),
    get: routedGet({ '/settings/integrations/google': () => status(connected) }),
    ...overrides,
  });
  renderPage(<Card />, { path: '/settings', api });
  return api;
}

describe('GoogleDriveCard', () => {
  it('opens Google sign-in to connect', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const post = vi.fn(async () => ({ url: 'https://accounts.google.com/o/oauth2/v2/auth?x=1' }));
    setup(false, { post: post as ApiClient['post'] });
    await userEvent.click(await screen.findByRole('button', { name: 'Connect Google Drive' }));
    await waitFor(() =>
      expect(open).toHaveBeenCalledWith(
        'https://accounts.google.com/o/oauth2/v2/auth?x=1',
        'onebox-google',
        expect.any(String),
      ),
    );
    expect(post).toHaveBeenCalledWith('/settings/integrations/google/connect');
    expect(await screen.findByText('Waiting for Google sign-in')).toBeInTheDocument();
  });

  it('asks before disconnecting', async () => {
    const remove = vi.fn(async () => undefined);
    setup(true, { delete: remove as ApiClient['delete'] });
    expect(await screen.findByText('Connected')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    const dialog = await screen.findByRole('dialog', { name: 'Disconnect Google Drive' });
    await userEvent.click(
      Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === 'Disconnect')!,
    );
    await waitFor(() => expect(remove).toHaveBeenCalledWith('/settings/integrations/google'));
  });
});
