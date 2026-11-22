import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../auth/AuthProvider';
import { fakeApi, testUser } from '../test/fake-api';
import { renderPage } from '../test/render';
import { SettingsPage } from './SettingsPage';

beforeEach(() => localStorage.clear());

function WhenSignedIn() {
  return useAuth().state.status === 'authenticated' ? <SettingsPage /> : null;
}

async function renderSettings(tab = 'accounts', api = fakeApi()) {
  renderPage(<WhenSignedIn />, {
    path: `/settings/${tab}`,
    route: '/settings/:tab',
    api: { ...api, restoreSession: vi.fn(async () => testUser) },
  });
  await screen.findByRole('heading', { name: 'Settings' });
}

describe('SettingsPage', () => {
  it('shows the profile of the signed in user', async () => {
    await renderSettings('appearance');
    expect(screen.getByText(testUser.name)).toBeInTheDocument();
    expect(screen.getByText(testUser.email)).toBeInTheDocument();
  });

  it('switches the theme from the appearance tiles', async () => {
    await renderSettings('appearance');
    await userEvent.click(screen.getByRole('radio', { name: /Dark/ }));

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('onebox.theme')).toBe('dark');
  });

  it('switches between the v1 and v2 interfaces', async () => {
    await renderSettings('appearance');
    await userEvent.click(screen.getByRole('radio', { name: /v2 · Console/ }));

    expect(localStorage.getItem('onebox.ui-version')).toBe('v2');
    expect(document.documentElement.dataset.ui).toBe('v2');
  });

  it('shows each section on its own tab, starting from the address', async () => {
    await renderSettings();
    expect(await screen.findByText('No accounts connected')).toBeInTheDocument();
    expect(
      within(screen.getByRole('table', { name: /Connected accounts/ })).getAllByRole('columnheader')
        .length,
    ).toBeGreaterThan(3);
    await userEvent.click(screen.getByRole('tab', { name: 'Integrations' }));
    // Integrations are a Pro feature, locked on Free.
    expect(await screen.findByText('Pro plan required')).toBeInTheDocument();
  });

  it('shows the model semantic search runs on', async () => {
    const api = fakeApi();
    const get = api.get;
    api.get = vi.fn(async (path: string) =>
      path === '/llm/models'
        ? {
            items: [],
            purposes: [],
            choices: {},
            embedding: {
              id: 'ollama/bge-m3',
              name: 'bge-m3 (local)',
              dimensions: 1024,
              local: true,
            },
          }
        : get(path),
    ) as typeof api.get;
    await renderSettings('ai', api);
    expect(await screen.findByRole('heading', { name: 'Semantic search' })).toBeInTheDocument();
    expect(screen.getByText('bge-m3')).toBeInTheDocument();
    expect(screen.getByText('This server (Ollama)')).toBeInTheDocument();
    expect(screen.getByText('1,024 dimensions')).toBeInTheDocument();
    expect(screen.getByText('Free, runs locally')).toBeInTheDocument();
  });
});
