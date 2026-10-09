import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, type ApiClient } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { fakeApi, testUser } from '../test/fake-api';
import { renderPage } from '../test/render';
import { integration } from '../test/settings-fixtures';
import { FlashProvider } from './flash';
import { IntegrationsSection } from './IntegrationsSection';

function Section() {
  return useAuth().state.status === 'authenticated' ? (
    <FlashProvider>
      <IntegrationsSection />
    </FlashProvider>
  ) : null;
}

function setup(overrides: Partial<ApiClient> = {}, items = [integration()]) {
  renderPage(<Section />, {
    path: '/settings',
    api: fakeApi({
      restoreSession: vi.fn(async () => testUser),
      get: vi.fn(async () => ({ items })) as ApiClient['get'],
      ...overrides,
    }),
  });
}

const openModal = async () => {
  await userEvent.click((await screen.findAllByRole('button', { name: 'Add integration' }))[0]!);
  return screen.findByRole('dialog', { name: 'Add integration' });
};

describe('IntegrationsSection', () => {
  it('shows integrations with their status', async () => {
    setup({}, [
      integration(),
      integration({
        id: 'i2',
        name: 'CRM',
        type: 'WEBHOOK',
        lastTestOk: false,
        lastError: 'HTTP 500',
      }),
    ]);
    await screen.findByText('CRM');
    const table = within(screen.getByRole('table', { name: /Integrations/ }));
    expect(table.getByText('Not tested')).toBeInTheDocument();
    expect(table.getByText('Failing')).toBeInTheDocument();
  });

  it('adds a slack integration', async () => {
    const post = vi.fn(async () => integration());
    setup({ post: post as ApiClient['post'] }, []);
    const dialog = await openModal();

    await userEvent.type(within(dialog).getByLabelText('Name'), 'Sales alerts');
    await userEvent.type(
      within(dialog).getByLabelText('URL'),
      'https://hooks.slack.com/services/T1/B1/abc',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add integration' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/settings/integrations', {
        type: 'SLACK',
        name: 'Sales alerts',
        webhookUrl: 'https://hooks.slack.com/services/T1/B1/abc',
        events: ['email.interested'],
      }),
    );
  });

  it('shows a webhook signing secret once after creation', async () => {
    const post = vi.fn(async () => ({
      ...integration({ type: 'WEBHOOK' }),
      secret: 'whsec_test123',
    }));
    setup({ post: post as ApiClient['post'] }, []);
    const dialog = await openModal();

    await userEvent.click(within(dialog).getByRole('radio', { name: /^Webhook/ }));
    await userEvent.type(within(dialog).getByLabelText('Name'), 'CRM');
    await userEvent.type(within(dialog).getByLabelText('URL'), 'https://crm.example/hook');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add integration' }));

    const secretDialog = await screen.findByRole('dialog', { name: 'Webhook signing secret' });
    expect(within(secretDialog).getByText('whsec_test123')).toBeInTheDocument();
    await userEvent.click(within(secretDialog).getByRole('button', { name: 'I have saved it' }));
    await waitFor(() => expect(screen.queryByText('whsec_test123')).not.toBeInTheDocument());
  });

  it('puts url problems from the server on the url field', async () => {
    const post = vi.fn(async () => {
      throw new ApiError(400, 'HOST_NOT_ALLOWED', 'Host 10.0.0.1 points to a private network');
    });
    setup({ post: post }, []);
    const dialog = await openModal();

    await userEvent.click(within(dialog).getByRole('radio', { name: /^Webhook/ }));
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Internal');
    await userEvent.type(within(dialog).getByLabelText('URL'), 'https://10.0.0.1/hook');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add integration' }));

    expect(await within(dialog).findByText(/private network/)).toBeInTheDocument();
  });

  it('reports a failed test delivery', async () => {
    const post = vi.fn(async () => ({
      ok: false,
      status: 404,
      error: 'Endpoint responded with HTTP 404',
      integration: integration({ lastTestOk: false }),
    }));
    setup({ post: post as ApiClient['post'] });

    await userEvent.click(await screen.findByRole('radio', { name: 'Sales alerts' }));
    await userEvent.click(screen.getByRole('button', { name: 'Send test' }));

    expect(post).toHaveBeenCalledWith('/settings/integrations/i1/test');
    expect(await screen.findByText('Endpoint responded with HTTP 404')).toBeInTheDocument();
  });
});
