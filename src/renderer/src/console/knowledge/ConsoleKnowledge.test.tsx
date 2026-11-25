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
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Read again' }),
    );
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/rag/collections/kb1/reindex', { statuses: ['FAILED'] }),
    );

    await userEvent.click(within(row).getByRole('button', { name: 'Actions for Refunds.pdf' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    expect(post).not.toHaveBeenCalledWith('/rag/records/trash', expect.anything());
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }),
    );
    await waitFor(() => expect(post).toHaveBeenCalledWith('/rag/records/trash', { ids: ['r1'] }));
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
            deleteSource: 'user',
          },
          {
            id: 'e9',
            sourceType: 'mail',
            sourceId: 'acct-1',
            name: 'Quarter pack',
            mimeType: 'text/html',
            sizeBytes: 10,
            status: 'completed',
            stage: null,
            reason: null,
            createdAt: '2026-03-01T00:00:00Z',
            sourceCreatedAt: null,
            sourceModifiedAt: null,
            dateOrigin: 'source',
            parentId: null,
            deletedAt: '2026-03-02T00:00:00Z',
            deleteSource: 'source',
          },
        ],
        total: 2,
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
    expect(get).toHaveBeenCalledWith(expect.stringContaining('trashed=true&topLevel=true'));
    expect(within(row).getByText('Policies')).toBeInTheDocument();
    expect(within(row).getByText('You')).toBeInTheDocument();
    const email = (await screen.findByText('Quarter pack')).closest('tr')!;
    expect(within(email).getByText('Mail')).toBeInTheDocument();
    expect(within(email).getByText('Mailbox')).toBeInTheDocument();
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
        chunk('c3', 'r1', 'Resume.pdf', `BITS Pilani ${'and more '.repeat(60)}`, 0.4),
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
    // The rest of a record's passages, and the end of a long one, open on request.
    await userEvent.click(screen.getByRole('button', { name: 'Show 1 more citation' }));
    await userEvent.click(screen.getByRole('button', { name: 'Show more' }));
    expect(screen.getByRole('button', { name: 'Show less' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Citations (3)' }));
    expect(await screen.findAllByRole('button', { name: 'Preview' })).toHaveLength(3);
  });

  it("lists an email's attachments under it, a failed one with its status", async () => {
    const mailNode = (over: Partial<HubNode> & Pick<HubNode, 'id' | 'name'>) =>
      node({
        nodeType: 'record',
        sourceType: 'mail',
        collectionId: null,
        origin: 'CONNECTOR',
        ...over,
      });
    const get = routedGet({
      '/rag/hub/nodes/mailbox/acct-1': () =>
        listing([
          mailNode({
            id: 'e1',
            name: 'Quarter pack',
            recordType: 'MAIL',
            parentId: 'acct-1',
            indexingStatus: 'COMPLETED',
            hasChildren: true,
            attachmentCount: 2,
          }),
        ]),
      '/rag/hub/nodes/record/e1': () =>
        listing([
          mailNode({ id: 'a1', name: 'rates.csv', recordType: 'FILE', parentId: 'e1' }),
          mailNode({
            id: 'a2',
            name: 'video.mov',
            recordType: 'FILE',
            parentId: 'e1',
            indexingStatus: 'FAILED',
            reason: 'larger than 100 MB, so not read',
          }),
        ]),
      '/rag/collections': () => ({ collections: [] }),
    });
    renderPage(<WhenSignedIn />, {
      path: '/knowledge/mail/acct-1',
      route: '/knowledge/*',
      api: signedIn({ get }),
    });

    const row = (await screen.findByRole('link', { name: 'Quarter pack' })).closest('tr')!;
    expect(within(row).getByTitle('2 attachments')).toBeInTheDocument();
    await userEvent.click(
      within(row).getByRole('button', { name: 'Show the attachments of Quarter pack' }),
    );
    const failed = (await screen.findByRole('link', { name: 'video.mov' })).closest('tr')!;
    expect(within(failed).getByText('Failed')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'rates.csv' })).toBeInTheDocument();
    // An attachment goes with its email, so it can't be picked on its own.
    expect(within(failed).getByRole('checkbox')).toBeDisabled();
  });

  it('deletes selected emails, to Recently deleted or permanently', async () => {
    const email = (id: string, name: string) =>
      node({
        id,
        name,
        nodeType: 'record',
        recordType: 'MAIL',
        sourceType: 'mail',
        parentId: 'acct-1',
        collectionId: null,
        origin: 'CONNECTOR',
        indexingStatus: 'COMPLETED',
      });
    const get = routedGet({
      '/rag/hub/nodes/mailbox/acct-1': () =>
        listing([email('e1', 'Quarter pack'), email('e2', 'Rates')]),
      '/rag/collections': () => ({ collections: [] }),
    });
    const post = vi.fn(async () => ({ trashed: ['e1', 'e2'] }));
    const del = vi.fn(async () => undefined);
    renderPage(<WhenSignedIn />, {
      path: '/knowledge/mail/acct-1',
      route: '/knowledge/*',
      api: signedIn({ get, post: post as ApiClient['post'], delete: del as ApiClient['delete'] }),
    });

    const pick = async (name: string) =>
      userEvent.click(
        within((await screen.findByRole('link', { name })).closest('tr')!).getByRole('checkbox'),
      );
    await pick('Quarter pack');
    await pick('Rates');
    await userEvent.click(screen.getByRole('button', { name: 'Delete (2)' }));
    const asked = await screen.findByRole('dialog');
    expect(within(asked).getByText(/Your mailbox is not changed/)).toBeInTheDocument();
    await userEvent.click(within(asked).getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/rag/records/trash', { ids: ['e1', 'e2'] }),
    );
    expect(await screen.findByText(/Your mailbox isn't changed/)).toBeInTheDocument();

    await pick('Rates');
    await userEvent.click(screen.getByRole('button', { name: 'Actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete permanently (1)' }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'Delete permanently (cannot be undone)' }),
    );
    await waitFor(() => expect(del).toHaveBeenCalledWith('/rag/records/e2?permanent=true'));
  });
});
