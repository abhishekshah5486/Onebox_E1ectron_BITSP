import { QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../auth/AuthProvider';
import { fakeApi, testUser } from '../test/fake-api';
import { QueryProvider } from './QueryProvider';

function SignOut() {
  const { state, signOut } = useAuth();
  return state.status === 'authenticated' ? (
    <button onClick={() => void signOut()}>out</button>
  ) : null;
}

describe('QueryProvider', () => {
  it('clears cached data when the user signs out', async () => {
    const client = new QueryClient();
    client.setQueryData(['accounts'], [{ id: 'a1' }]);
    render(
      <AuthProvider api={fakeApi({ restoreSession: vi.fn(async () => testUser) })}>
        <QueryProvider client={client}>
          <SignOut />
        </QueryProvider>
      </AuthProvider>,
    );

    await userEvent.click(await screen.findByRole('button', { name: 'out' }));
    await waitFor(() => expect(client.getQueryData(['accounts'])).toBeUndefined());
  });
});
