import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, type ApiClient } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { fakeApi, testUser } from '../test/fake-api';
import { renderPage } from '../test/render';
import { account } from '../test/settings-fixtures';
import { AccountsSection } from './AccountsSection';
import { FlashProvider } from './flash';

function Section() {
  return useAuth().state.status === 'authenticated' ? (
    <FlashProvider>
      <AccountsSection />
    </FlashProvider>
  ) : null;
}

// Pasting is much faster than typing each key, which matters on slow CI runners.
async function fill(field: HTMLElement, text: string) {
  await userEvent.click(field);
  await userEvent.paste(text);
}

function setup(overrides: Partial<ApiClient> = {}, accounts = [account()]) {
  const api = fakeApi({
    restoreSession: vi.fn(async () => testUser),
    get: vi.fn(async () => ({ items: accounts })) as ApiClient['get'],
    ...overrides,
  });
  renderPage(<Section />, { path: '/settings', api });
  return api;
}

const openModal = async () => {
  await userEvent.click((await screen.findAllByRole('button', { name: 'Add account' }))[0]!);
  return screen.findByRole('dialog', { name: 'Connect an email account' });
};

describe('AccountsSection', () => {
  it('lists accounts with readable status', async () => {
    setup({}, [
      account(),
      account({
        id: 'a2',
        emailAddress: 'me@icloud.com',
        provider: 'ICLOUD',
        status: 'AUTH_FAILED',
      }),
    ]);
    await screen.findByText('me@icloud.com');
    const table = within(screen.getByRole('table', { name: /Connected accounts/ }));
    expect(table.getByText('Connected')).toBeInTheDocument();
    expect(table.getByText('Sign-in failed')).toBeInTheDocument();
    expect(table.getByText('iCloud')).toBeInTheDocument();
  });

  it.each([
    ['Gmail', 'GMAIL'],
    ['Hotmail', 'OUTLOOK'],
    ['iCloud', 'ICLOUD'],
    ['Yahoo', 'YAHOO'],
  ])('connects a %s account with the %s preset', async (label, provider) => {
    const post = vi.fn(async () => account({ provider: provider as never }));
    setup({ post: post as ApiClient['post'] }, []);
    const dialog = await openModal();

    await userEvent.click(within(dialog).getByRole('radio', { name: new RegExp(`^${label}`) }));
    await fill(within(dialog).getByLabelText('Email address'), 'me@example.com');
    await fill(within(dialog).getByLabelText('Password'), 'app-password');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Connect' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/accounts', {
        provider,
        emailAddress: 'me@example.com',
        password: 'app-password',
      }),
    );
  });

  it('links to the app password page for providers that need one', async () => {
    setup({}, []);
    const dialog = await openModal();
    await userEvent.click(within(dialog).getByRole('radio', { name: /^iCloud/ }));
    expect(within(dialog).getByRole('link', { name: /Create one/ })).toHaveAttribute(
      'href',
      'https://account.apple.com/account/manage',
    );
  });

  it('requires server details for other imap servers', async () => {
    const post = vi.fn();
    setup({ post: post as ApiClient['post'] }, []);
    const dialog = await openModal();

    await userEvent.click(within(dialog).getByRole('radio', { name: /^Other IMAP/ }));
    await fill(within(dialog).getByLabelText('Email address'), 'me@corp.example');
    await fill(within(dialog).getByLabelText('Password'), 'pw');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Connect' }));

    expect(within(dialog).getByText(/Enter the IMAP server/)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('shows a rejected password on the password field', async () => {
    const post = vi.fn(async () => {
      throw new ApiError(
        422,
        'CONNECTION_FAILED',
        'The mail server rejected the username or password',
        {
          reason: 'AUTH_FAILED',
        },
      );
    });
    setup({ post: post }, []);
    const dialog = await openModal();

    await fill(within(dialog).getByLabelText('Email address'), 'me@gmail.com');
    await fill(within(dialog).getByLabelText('Password'), 'wrong');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Connect' }));

    expect(
      await within(dialog).findByText(/rejected the username or password/),
    ).toBeInTheDocument();
  });

  it('tests the selected account and reports the outcome', async () => {
    const post = vi.fn(async () => ({
      ok: false,
      reason: 'AUTH_FAILED',
      message: 'The mail server rejected the username or password',
      account: account({ status: 'AUTH_FAILED' }),
    }));
    setup({ post: post as ApiClient['post'] });

    await userEvent.click(await screen.findByRole('checkbox', { name: 'me@gmail.com' }));
    await userEvent.click(screen.getByRole('button', { name: 'Test connection' }));

    expect(post).toHaveBeenCalledWith('/accounts/a1/test');
    expect(await screen.findByText('me@gmail.com could not connect')).toBeInTheDocument();
  });

  it('asks for confirmation before removing an account', async () => {
    const del = vi.fn(async () => undefined);
    setup({ delete: del as ApiClient['delete'] });

    await userEvent.click(await screen.findByRole('checkbox', { name: 'me@gmail.com' }));
    await userEvent.click(screen.getByRole('button', { name: 'Actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Remove' }));
    expect(del).not.toHaveBeenCalled();

    const dialog = await screen.findByRole('dialog', { name: 'Remove account' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(del).toHaveBeenCalledWith('/accounts/a1'));
  });
});
