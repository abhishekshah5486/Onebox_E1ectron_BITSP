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
  {
    id: 'g1',
    provider: 'GOOGLE_DRIVE',
    email: 'me@gmail.com',
    defaultPath: 'OneBox',
    connectedAt: '',
    updatedAt: '',
  },
  {
    id: 'g2',
    provider: 'GOOGLE_DRIVE',
    email: 'work@gmail.com',
    defaultPath: 'Work',
    connectedAt: '',
    updatedAt: '',
  },
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
        '/settings/storage': () => ({ providers: ['GOOGLE_DRIVE'], accounts: connected }),
      }),
      post: post as ApiClient['post'],
    }),
  });
  return post;
}

describe('Save to cloud storage', () => {
  it('asks for the account and folder, starting from that account’s default', async () => {
    const post = setup(
      accounts,
      vi.fn(async () => ({ files: [{ index: 0, name: 'marks.pdf', link: 'https://x' }] })),
    );
    await userEvent.click(await screen.findByRole('button', { name: /Add all to Drive/ }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Save to Google Drive' }));
    const folder = dialog.getByRole('textbox', { name: 'Folder' });
    expect(folder).toHaveValue('OneBox');

    await userEvent.click(dialog.getByRole('radio', { name: /work@gmail\.com/ }));
    expect(folder).toHaveValue('Work');
    await userEvent.type(folder, '/2026');
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/mail/messages/m1/attachments/save', {
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
      await screen.findByText('Connect cloud storage to save files there.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });
});
