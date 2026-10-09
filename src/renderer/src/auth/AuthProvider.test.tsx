import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { fakeApi, testUser } from '../test/fake-api';
import { AuthProvider, useAuth } from './AuthProvider';

function Probe() {
  const { state, signIn, signOut } = useAuth();
  return (
    <>
      <span>{state.status === 'authenticated' ? state.user.name : state.status}</span>
      <button onClick={() => void signIn('a@b.co', 'pw')}>in</button>
      <button onClick={() => void signOut()}>out</button>
    </>
  );
}

describe('AuthProvider', () => {
  it('starts loading, then is anonymous without a session', async () => {
    render(
      <AuthProvider api={fakeApi()}>
        <Probe />
      </AuthProvider>,
    );
    expect(screen.getByText('loading')).toBeInTheDocument();
    expect(await screen.findByText('anonymous')).toBeInTheDocument();
  });

  it('restores an existing session', async () => {
    render(
      <AuthProvider api={fakeApi({ restoreSession: vi.fn(async () => testUser) })}>
        <Probe />
      </AuthProvider>,
    );
    expect(await screen.findByText(testUser.name)).toBeInTheDocument();
  });

  it('signs in and out', async () => {
    const logout = vi.fn(async () => {});
    const api = fakeApi({ logout });
    render(
      <AuthProvider api={api}>
        <Probe />
      </AuthProvider>,
    );
    await screen.findByText('anonymous');

    await userEvent.click(screen.getByRole('button', { name: 'in' }));
    expect(await screen.findByText(testUser.name)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'out' }));
    await waitFor(() => expect(screen.getByText('anonymous')).toBeInTheDocument());
    expect(logout).toHaveBeenCalledOnce();
  });

  it('signs out locally even if the server call fails', async () => {
    const api = fakeApi({
      restoreSession: vi.fn(async () => testUser),
      logout: vi.fn(async () => {
        throw new Error('offline');
      }),
    });
    render(
      <AuthProvider api={api}>
        <Probe />
      </AuthProvider>,
    );
    await screen.findByText(testUser.name);
    await userEvent.click(screen.getByRole('button', { name: 'out' }));
    await waitFor(() => expect(screen.getByText('anonymous')).toBeInTheDocument());
  });
});
