import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { defaultPreferences, fakeApi, testUser } from '../test/fake-api';
import { renderPage } from '../test/render';
import { FlashProvider } from './flash';
import { PreferencesSection } from './PreferencesSection';

function Section() {
  return useAuth().state.status === 'authenticated' ? (
    <FlashProvider>
      <PreferencesSection />
    </FlashProvider>
  ) : null;
}

describe('PreferencesSection', () => {
  it('saves only the fields that changed', async () => {
    const patch = vi.fn(async (_path: string, body: object) => ({
      ...defaultPreferences,
      ...body,
      updatedAt: '2026-10-07T12:00:00Z',
    }));
    renderPage(<Section />, {
      path: '/settings',
      api: fakeApi({
        restoreSession: vi.fn(async () => testUser),
        patch: patch as ApiClient['patch'],
      }),
    });

    const save = await screen.findByRole('button', { name: 'Save preferences' });
    expect(save).toBeDisabled();

    await userEvent.click(screen.getByRole('checkbox', { name: /Mark messages as read/ }));
    await userEvent.type(screen.getByLabelText('Signature'), '— Abhishek');
    await userEvent.click(save);

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/settings/preferences', {
        markSeenOnFetch: false,
        signature: '— Abhishek',
      }),
    );
    expect(await screen.findByText('Preferences saved.')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save preferences' })).toBeDisabled(),
    );
  });
});
