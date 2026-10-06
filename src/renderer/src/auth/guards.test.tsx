import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import { fakeApi, testUser } from '../test/fake-api';
import { AuthProvider } from './AuthProvider';
import { GuestOnly, RequireAuth } from './guards';

function renderAt(path: string, restored: boolean) {
  const api = fakeApi({ restoreSession: vi.fn(async () => (restored ? testUser : null)) });
  render(
    <AuthProvider api={api}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path="/inbox" element={<p>inbox</p>} />
          </Route>
          <Route element={<GuestOnly />}>
            <Route path="/signin" element={<p>signin</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe('route guards', () => {
  it('shows a splash while the session restores', () => {
    renderAt('/inbox', true);
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });

  it('sends anonymous users to sign in', async () => {
    renderAt('/inbox', false);
    expect(await screen.findByText('signin')).toBeInTheDocument();
  });

  it('lets signed in users through', async () => {
    renderAt('/inbox', true);
    expect(await screen.findByText('inbox')).toBeInTheDocument();
  });

  it('keeps signed in users away from sign in', async () => {
    renderAt('/signin', true);
    expect(await screen.findByText('inbox')).toBeInTheDocument();
  });
});
