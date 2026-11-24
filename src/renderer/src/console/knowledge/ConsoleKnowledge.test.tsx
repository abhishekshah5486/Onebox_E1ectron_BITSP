import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../../api/client';
import type { HubListing, HubNode } from '../../api/hub';
import { useAuth } from '../../auth/AuthProvider';
import { FlashProvider } from '../../settings/flash';
import { fakeApi, routedGet, testUser } from '../../test/fake-api';
import { renderPage } from '../../test/render';
import ConsoleKnowledge from './ConsoleKnowledge';

function WhenSignedIn() {
  return useAuth().state.status === 'authenticated' ? (
    <FlashProvider>
      <ConsoleKnowledge />
    </FlashProvider>
  ) : null;
}

const node = (over: Partial<HubNode> & Pick<HubNode, 'id' | 'name' | 'nodeType'>): HubNode => ({
  parentId: 'kb1',
  collectionId: 'kb1',
  origin: 'UPLOAD',
  hasChildren: false,
  createdAt: Date.UTC(2026, 2, 1),
  updatedAt: Date.UTC(2026, 2, 1),
  ...over,
});

const listing = (items: HubNode[]): HubListing => ({
  currentNode: node({ id: 'kb1', name: 'Policies', nodeType: 'collection', origin: 'COLLECTION' }),
  items,
  pagination: {
    limit: 50,
    totalItems: items.length,
    hasNext: false,
    hasPrev: false,
    startIndex: 0,
    endIndex: items.length,
    nextCursor: null,
    prevCursor: null,
  },
  breadcrumbs: [{ id: 'kb1', name: 'Policies', nodeType: 'collection' }],
});

const signedIn = (overrides: Partial<ApiClient>) =>
  fakeApi({ restoreSession: vi.fn(async () => testUser), ...overrides });

const collectionGet = () =>
  routedGet({
    '/rag/hub/nodes/collection/kb1': () =>
      listing([
        node({ id: 'f1', name: 'Contracts', nodeType: 'folder', origin: 'COLLECTION' }),
        node({
          id: 'r1',
          name: 'Refunds.pdf',
          nodeType: 'record',
          recordType: 'FILE',
          sourceType: 'upload',
          indexingStatus: 'FAILED',
          reason: 'The file could not be read',
          sizeInBytes: 2048,
          extension: 'pdf',
        }),
      ]),
    '/rag/collections/kb1/stats': () => ({
      collection: { id: 'kb1', name: 'Policies' },
      total: 1,
      statuses: { FAILED: 1 },
      recordTypes: { FILE: 1 },
      summaries: {},
      sizeBytes: 2048,
    }),
    '/rag/collections': () => ({ collections: [{ id: 'kb1', name: 'Policies' }] }),
    '/rag/limits': () => ({ maxFileSizeBytes: 1024, maxFilesPerUpload: 100 }),
  });

describe('ConsoleKnowledge', () => {
  it('lists a collection, reads its failed files again and deletes a file with undo', async () => {
    const post = vi.fn(async (path: string) =>
      path.endsWith('/reindex')
        ? { queued: ['r1'], skipped: [] }
        : { trashed: ['r1'], restored: ['r1'] },
    );
    renderPage(<WhenSignedIn />, {
      path: '/knowledge/collections/kb1',
      route: '/knowledge/*',
      api: signedIn({ get: collectionGet(), post: post as ApiClient['post'] }),
    });

    const row = (await screen.findByText('Refunds.pdf')).closest('tr')!;
    expect(within(row).getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Contracts')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Read failed files again' }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/rag/collections/kb1/reindex', { statuses: ['FAILED'] }),
    );

    await userEvent.click(within(row).getByRole('button', { name: 'Actions for Refunds.pdf' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    expect(post).toHaveBeenCalledWith('/rag/records/trash', { ids: ['r1'] });
    await userEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(post).toHaveBeenCalledWith('/rag/records/restore', { ids: ['r1'] });
  });

  it('creates a folder in the collection and refuses a file over the size limit', async () => {
    const post = vi.fn(async () => ({ id: 'f2', name: 'Invoices' }));
    const uploadForm = vi.fn();
    renderPage(<WhenSignedIn />, {
      path: '/knowledge/collections/kb1',
      route: '/knowledge/*',
      api: signedIn({
        get: collectionGet(),
        post: post as ApiClient['post'],
        uploadForm: uploadForm as ApiClient['uploadForm'],
      }),
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Create folder' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox'), 'a/b');
    expect(within(dialog).getByText(/cannot contain/)).toBeInTheDocument();
    await userEvent.clear(within(dialog).getByRole('textbox'));
    await userEvent.type(within(dialog).getByRole('textbox'), 'Invoices');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create' }));
    expect(post).toHaveBeenCalledWith('/rag/collections/kb1/folders', {
      name: 'Invoices',
      parentId: null,
    });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await userEvent.upload(
      screen.getByLabelText('Upload files'),
      new File(['x'.repeat(2048)], 'big.pdf', { type: 'application/pdf' }),
    );
    expect(await screen.findByText('big.pdf is too large')).toBeInTheDocument();
    expect(uploadForm).not.toHaveBeenCalled();
  });

  it('restores a deleted file from Recently deleted', async () => {
    const post = vi.fn(async () => ({ restored: ['r9'] }));
    const get = routedGet({
      '/rag/records?': () => ({
        records: [
          {
            id: 'r9',
            sourceType: 'upload',
            sourceId: 'kb1',
            name: 'Old.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 10,
            status: 'completed',
            stage: null,
            reason: null,
            createdAt: '2026-03-01T00:00:00Z',
            sourceCreatedAt: null,
            sourceModifiedAt: null,
            dateOrigin: 'upload',
            parentId: null,
            deletedAt: '2026-03-02T00:00:00Z',
          },
        ],
        total: 1,
        available: { statuses: {}, mimeTypes: {} },
      }),
      '/rag/collections': () => ({ collections: [{ id: 'kb1', name: 'Policies' }] }),
    });
    renderPage(<WhenSignedIn />, {
      path: '/knowledge/trash',
      route: '/knowledge/*',
      api: signedIn({ get, post: post as ApiClient['post'] }),
    });

    const row = (await screen.findByText('Old.pdf')).closest('tr')!;
    expect(get).toHaveBeenCalledWith(expect.stringContaining('trashed=true'));
    expect(within(row).getByText('Policies')).toBeInTheDocument();
    await userEvent.click(within(row).getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Restore' }));
    expect(post).toHaveBeenCalledWith('/rag/records/restore', { ids: ['r9'] });
  });

  it('asks a question and shows passages grouped by record, with citations', async () => {
    const record = (recordId: string, name: string) => ({
      recordId,
      name,
      mimeType: 'application/pdf',
      sourceType: 'upload' as const,
      sourceId: 'kb1',
      updatedAt: '2026-03-01T00:00:00Z',
      dates: {
        created: '2026-03-01T00:00:00Z',
        modified: '2026-03-01T00:00:00Z',
        origin: 'upload' as const,
      },
    });
    const chunk = (id: string, recordId: string, name: string, text: string, score: number) => ({
      id,
      text,
      score,
      kind: 'block' as const,
      record: record(recordId, name),
      citation: { page: 1, blockIndex: 2, blockIndices: [2] },
    });
    const post = vi.fn(async () => ({
      chunks: [
        chunk('c1', 'r1', 'Resume.pdf', 'Cumulative CGPA: 8.76/10', 0.9),
        chunk('c2', 'r2', 'Transcript.pdf', 'CGPA 8.7', 0.6),
        chunk('c3', 'r1', 'Resume.pdf', 'BITS Pilani, 2023 - present', 0.4),
      ],
      unindexed: [],
    }));
    renderPage(<WhenSignedIn />, {
      path: '/knowledge/search',
      route: '/knowledge/*',
      api: signedIn({
        post: post as ApiClient['post'],
        get: routedGet({
          '/rag/sources': () => ({ sources: [] }),
          '/rag/collections': () => ({ collections: [] }),
        }),
      }),
    });

    expect(await screen.findByText('How can I help you today?')).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox', { name: 'Question' }), 'cgpa');
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByRole('tab', { name: 'Results (2)' })).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith('/rag/retrieve', { query: 'cgpa' });
    expect(screen.getByText('3 passages from 2 records')).toBeInTheDocument();
    expect(screen.getByText('1 more citation')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Citations (3)' }));
    expect(await screen.findAllByRole('button', { name: 'Preview' })).toHaveLength(3);
  });
});
