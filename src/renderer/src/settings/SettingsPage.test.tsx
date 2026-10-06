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

async function renderSettings() {
  renderPage(<WhenSignedIn />, {
    path: '/settings',
    api: fakeApi({ restoreSession: vi.fn(async () => testUser) }),
  });
  await screen.findByRole('heading', { name: 'Settings' });
}

describe('SettingsPage', () => {
  it('shows the profile of the signed in user', async () => {
    await renderSettings();
    expect(screen.getByText(testUser.name)).toBeInTheDocument();
    expect(screen.getByText(testUser.email)).toBeInTheDocument();
  });

  it('switches the theme from the appearance tiles', async () => {
    await renderSettings();
    await userEvent.click(screen.getByRole('radio', { name: /Dark/ }));

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('onebox.theme')).toBe('dark');
  });

  it('shows an empty accounts table and the available integrations', async () => {
    await renderSettings();
    expect(screen.getByText('No accounts connected')).toBeInTheDocument();

    const integrations = screen.getByRole('table', { name: /Integrations/ });
    expect(within(integrations).getByText('Slack')).toBeInTheDocument();
    expect(within(integrations).getAllByText('Not configured')).toHaveLength(2);
  });
});
