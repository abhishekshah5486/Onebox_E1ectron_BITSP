import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CategoryRule } from '../api/ai';
import { useAuth } from '../auth/AuthProvider';
import { fakeApi, routedGet, testUser } from '../test/fake-api';
import { renderPage } from '../test/render';
import { SettingsPage } from './SettingsPage';

function WhenSignedIn() {
  return useAuth().state.status === 'authenticated' ? <SettingsPage /> : null;
}

const rule = (category: CategoryRule['category'], extra: Partial<CategoryRule> = {}) => ({
  category,
  description: `Default words for ${category}`,
  defaultDescription: `Default words for ${category}`,
  customized: false,
  enabled: true,
  ...extra,
});

describe('categories filled in by AI', () => {
  it('shows each default description, switches AI off, and saves or resets a description', async () => {
    const put = vi.fn(async (_path: string, body: object) => ({ ...rule('travel'), ...body }));
    const get = routedGet({
      '/ai/categories': () => ({
        items: [rule('travel'), rule('updates', { description: 'Bank alerts', customized: true })],
      }),
    });
    renderPage(<WhenSignedIn />, {
      path: '/settings/labels',
      route: '/settings/:tab',
      api: { ...fakeApi({ get, put: put as never }), restoreSession: vi.fn(async () => testUser) },
    });

    const table = await screen.findByRole('table', { name: 'Categories' });
    expect(await within(table).findByText('Default words for travel')).toBeInTheDocument();
    expect(within(table).getByText('Bank alerts')).toBeInTheDocument();

    await userEvent.click(within(table).getByRole('checkbox', { name: 'Let AI fill in Travel' }));
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/ai/categories/travel', { enabled: false }),
    );

    await userEvent.click(within(table).getByRole('radio', { name: 'Select Travel' }));
    await userEvent.click(screen.getByRole('button', { name: 'Edit description' }));
    const dialog = await screen.findByRole('dialog');
    const box = within(dialog).getByRole('textbox', { name: 'Description' });
    await userEvent.clear(box);
    await userEvent.type(box, 'short');
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();
    await userEvent.type(box, ' trips and work travel');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/ai/categories/travel', {
        description: 'short trips and work travel',
      }),
    );

    await userEvent.click(within(table).getByRole('radio', { name: 'Select Updates' }));
    await userEvent.click(screen.getByRole('button', { name: 'Edit description' }));
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Reset to default' }),
    );
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/ai/categories/updates', { description: null }),
    );
  });
});
