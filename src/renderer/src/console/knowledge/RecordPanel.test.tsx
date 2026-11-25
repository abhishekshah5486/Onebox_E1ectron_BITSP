import AppLayout from '@cloudscape-design/components/app-layout';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useAuth } from '../../auth/AuthProvider';
import { fakeApi, routedGet, testUser } from '../../test/fake-api';
import { renderPage } from '../../test/render';
import { RecordPanel } from './RecordPanel';

const details = (id: string, name: string, extra: object) => ({
  id,
  name,
  sourceType: 'mail',
  sourceId: 'acct-1',
  recordType: id === 'e1' ? 'MAIL' : 'FILE',
  origin: 'CONNECTOR',
  mimeType: 'text/csv',
  sizeBytes: 40,
  status: 'completed',
  stage: null,
  reason: null,
  version: 1,
  createdAt: '2026-11-20T09:30:00Z',
  updatedAt: '2026-11-20T09:30:00Z',
  folderId: null,
  parentId: id === 'e1' ? null : 'e1',
  permissions: [],
  ...extra,
});

function Panel() {
  const [id, setId] = useState('e1');
  if (useAuth().state.status !== 'authenticated') return null;
  return (
    <AppLayout
      navigationHide
      toolsHide
      splitPanelOpen
      splitPanel={<RecordPanel key={id} id={id} onDownload={() => {}} onOpen={setId} />}
      content={null}
    />
  );
}

describe('RecordPanel', () => {
  it("lists an email's attachments, a failed one with why, and links both ways", async () => {
    const get = routedGet({
      '/rag/records/e1': () =>
        details('e1', 'Quarter pack', {
          attachments: [
            { id: 'a1', name: 'rates.csv', status: 'completed', reason: null, sizeBytes: 40 },
            {
              id: 'a2',
              name: 'video.mov',
              status: 'failed',
              reason: 'larger than 100 MB, so not read',
              sizeBytes: 2 ** 30,
            },
          ],
        }),
      '/rag/records/a2': () =>
        details('a2', 'video.mov', {
          status: 'failed',
          reason: 'larger than 100 MB, so not read',
          attachedTo: { id: 'e1', name: 'Quarter pack' },
        }),
    });
    renderPage(<Panel />, {
      api: fakeApi({ restoreSession: vi.fn(async () => testUser), get }),
    });

    expect(await screen.findByText('Attachments (2)')).toBeInTheDocument();
    expect(screen.getByText(/larger than 100 MB, so not read/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'video.mov' }));
    expect(await screen.findByText('Attached to')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Quarter pack' }));
    expect(await screen.findByText('Attachments (2)')).toBeInTheDocument();
  });
});
