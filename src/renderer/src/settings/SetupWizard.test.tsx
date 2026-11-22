import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { defaultPreferences, fakeApi, routedGet, testUser } from '../test/fake-api';
import { renderPage } from '../test/render';
import { SetupWizard } from './SetupWizard';

function Wizard() {
  return useAuth().state.status === 'authenticated' ? <SetupWizard /> : null;
}

function setup(setupDone: boolean) {
  const patch = vi.fn(async () => ({ ...defaultPreferences, setupDone: true }));
  const api = fakeApi({
    restoreSession: vi.fn(async () => testUser),
    get: routedGet({
      '/settings/preferences': () => ({ ...defaultPreferences, setupDone }),
      '/llm/providers': () => ({ items: [] }),
      '/llm/user-models': () => ({ items: [] }),
    }),
    patch: patch as ApiClient['patch'],
  });
  renderPage(<Wizard />, { path: '/', api });
  return patch;
}

describe('SetupWizard', () => {
  it('walks a new user through the optional steps and remembers when done', async () => {
    const patch = setup(false);
    const dialog = await screen.findByRole('dialog', { name: 'Set up OneBox' });
    expect(within(dialog).getAllByText('AI model').length).toBeGreaterThan(0);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Next' }));
    expect(within(dialog).getAllByText('Embedding model').length).toBeGreaterThan(0);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Skip to the end' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/settings/preferences', { setupDone: true }),
    );
    expect(screen.queryByRole('dialog', { name: 'Set up OneBox' })).toBeNull();
  });

  it('can be skipped, and stays away once done', async () => {
    const patch = setup(false);
    await userEvent.click(await screen.findByRole('button', { name: 'Skip setup' }));
    await waitFor(() => expect(patch).toHaveBeenCalled());
  });

  it('does not show for people who already set up', async () => {
    setup(true);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(screen.queryByRole('dialog', { name: 'Set up OneBox' })).toBeNull();
  });
});
