import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../api/client';
import type { IndexingStore } from '../api/providers';
import { useAuth } from '../auth/AuthProvider';
import { fakeApi, routedGet, testUser } from '../test/fake-api';
import { renderPage } from '../test/render';
import { FlashProvider } from './flash';
import { IndexingStorageSection } from './IndexingStorageSection';

function Section() {
  return useAuth().state.status === 'authenticated' ? (
    <FlashProvider>
      <IndexingStorageSection />
    </FlashProvider>
  ) : null;
}

function setup(store: IndexingStore, overrides: Partial<ApiClient> = {}) {
  const api = fakeApi({
    restoreSession: vi.fn(async () => testUser),
    get: routedGet({ '/settings/indexing-storage': () => store }),
    ...overrides,
  });
  renderPage(<Section />, { path: '/settings', api });
}

describe('IndexingStorageSection', () => {
  it('connects the user’s own Qdrant', async () => {
    const put = vi.fn(async () => ({
      provider: 'QDRANT',
      url: 'https://q.example.com',
      keyHint: '…ab12',
      updatedAt: '2026-11-22T00:00:00Z',
    }));
    setup({ provider: 'ONEBOX' }, { put: put as ApiClient['put'] });
    await userEvent.click(await screen.findByRole('radio', { name: /Your own Qdrant/ }));
    await userEvent.type(screen.getByLabelText('Qdrant URL'), 'https://q.example.com');
    await userEvent.type(screen.getByLabelText('API key (optional)'), 'qd-key');
    await userEvent.click(screen.getByRole('button', { name: 'Check and connect' }));
    expect(await screen.findByText('Your Qdrant is connected')).toBeVisible();
    expect(put).toHaveBeenCalledWith('/settings/indexing-storage', {
      url: 'https://q.example.com',
      apiKey: 'qd-key',
    });
  });

  it('moves back to OneBox after asking', async () => {
    const del = vi.fn(async () => undefined);
    setup(
      {
        provider: 'QDRANT',
        url: 'https://q.example.com',
        keyHint: null,
        updatedAt: '2026-11-22T00:00:00Z',
      },
      { delete: del as ApiClient['delete'] },
    );
    expect(await screen.findByText('https://q.example.com')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Move back to OneBox' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Move search vectors back to OneBox?',
    });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Move back' }));
    await waitFor(() => expect(del).toHaveBeenCalledWith('/settings/indexing-storage'));
  });
});
