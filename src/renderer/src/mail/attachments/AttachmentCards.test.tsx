import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../../api/client';
import { useAuth } from '../../auth/AuthProvider';
import { fakeApi, routedGet, testUser } from '../../test/fake-api';
import { renderPage } from '../../test/render';
import { SnackbarProvider } from '../../ui/Snackbar';
import { AttachmentCards } from './AttachmentCards';

const files = [
  {
    messageId: 'm1',
    index: 0,
    filename: 'marks.pdf',
    contentType: 'application/pdf',
    sizeBytes: 10,
  },
  { messageId: 'm1', index: 1, filename: 'notes.txt', contentType: 'text/plain', sizeBytes: 5 },
];

const accounts = [
  { id: 'g1', email: 'me@gmail.com', defaultPath: 'OneBox', connectedAt: '', updatedAt: '' },
  { id: 'g2', email: 'work@gmail.com', defaultPath: 'Work', connectedAt: '', updatedAt: '' },
];

function Cards() {
  return useAuth().state.status === 'authenticated' ? (
    <SnackbarProvider>
      <AttachmentCards files={files} />
    </SnackbarProvider>
  ) : null;
}

function setup(connected = accounts, post = vi.fn()) {
  renderPage(<Cards />, {
    path: '/',
    api: fakeApi({
      restoreSession: vi.fn(async () => testUser),
      get: routedGet({
        '/settings/integrations/google': () => ({ configured: true, accounts: connected }),
      }),
      post: post as ApiClient['post'],
    }),
  });
  return post;
}

describe('Add to Drive', () => {
  it('asks for the account and folder, starting from that account’s default', async () => {
    const post = setup(
      accounts,
      vi.fn(async () => ({ files: [{ index: 0, name: 'marks.pdf', link: 'https://x' }] })),
    );
    await userEvent.click(await screen.findByRole('button', { name: /Add all to Drive/ }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Add to Drive' }));
    const folder = dialog.getByRole('textbox', { name: 'Folder' });
    expect(folder).toHaveValue('OneBox');

    await userEvent.click(dialog.getByRole('radio', { name: 'work@gmail.com' }));
    expect(folder).toHaveValue('Work');
    await userEvent.type(folder, '/2026');
    await userEvent.click(dialog.getByRole('button', { name: 'Add to Drive' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/mail/messages/m1/attachments/drive', {
        indexes: [0, 1],
        accountId: 'g2',
        path: 'Work/2026',
      }),
    );
  });

  it('offers to connect when no account is connected', async () => {
    const post = setup([]);
    await userEvent.click(await screen.findByRole('button', { name: /Add all to Drive/ }));
    expect(
      await screen.findByText('Connect Google Drive to save files there.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });
});
