import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { QueryProvider } from './api/QueryProvider';
import { AuthProvider } from './auth/AuthProvider';
import { AppRoutes } from './routes';
import { fakeApi, testUser } from './test/fake-api';
import { testQueryClient } from './test/render';
import { ThemeProvider } from './theme/ThemeProvider';

function renderApp(path: string, signedIn: boolean) {
  const api = fakeApi({
    restoreSession: vi.fn(async () => (signedIn ? testUser : null)),
    login: vi.fn(async () => testUser),
  });
  render(
    <ThemeProvider>
      <AuthProvider api={api}>
        <QueryProvider client={testQueryClient()}>
          <MemoryRouter initialEntries={[path]}>
            <AppRoutes />
          </MemoryRouter>
        </QueryProvider>
      </AuthProvider>
    </ThemeProvider>,
  );
}

describe('app routes', () => {
  it('sends a signed out visitor from / to sign in', async () => {
    renderApp('/', false);
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('opens the inbox for a returning user', async () => {
    renderApp('/', true);
    expect(await screen.findByRole('heading', { name: 'Your inbox is empty' })).toBeInTheDocument();
  });

  it('signs in end to end and lands in the inbox', async () => {
    renderApp('/settings', false);
    await userEvent.type(await screen.findByLabelText('Email'), testUser.email);
    await userEvent.type(screen.getByLabelText('Password'), 'correct-horse');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('navigation', { name: 'Mailboxes' })).toBeInTheDocument();
  });

  it('renders settings inside the shell', async () => {
    renderApp('/settings', true);
    expect(
      await screen.findByRole('heading', { name: 'Settings' }, { timeout: 12_000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('search')).toBeInTheDocument();
  }, 15_000);
});
