import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, type ApiClient } from '../api/client';
import type { IndexingStore, IndexingStores, VectorStoreInfo } from '../api/providers';
import { useAuth } from '../auth/AuthProvider';
import { fakeApi, routedGet, testUser } from '../test/fake-api';
import { renderPage } from '../test/render';
import { FlashProvider } from './flash';
import { IndexingStorageSection } from './IndexingStorageSection';

function Section() {
  return useAuth().state.status === 'authenticated' ? (
    <FlashProvider>
      <IndexingStorageSection />
    </FlashProvider>
  ) : null;
}

const field = (key: string, label: string, extra: object = {}) => ({
  key,
  label,
  secret: false,
  required: true,
  address: false,
  ...extra,
});
const STORES: VectorStoreInfo[] = [
  {
    id: 'QDRANT',
    name: 'Qdrant',
    description: 'Qdrant Cloud or your own server.',
    docsUrl: 'https://qdrant.tech/documentation/',
    icon: 'qdrant',
    fields: [
      field('url', 'URL', { address: true, placeholder: 'https://xyz.cloud.qdrant.io:6333' }),
      field('apiKey', 'API key', { secret: true, required: false }),
    ],
  },
  {
    id: 'NEO4J',
    name: 'Neo4j',
    description: 'Neo4j AuraDB or your own server.',
    docsUrl: 'https://neo4j.com/docs/',
    icon: 'neo4j',
    fields: [
      field('url', 'URL', { address: true }),
      field('username', 'Username', { default: 'neo4j' }),
      field('password', 'Password', { secret: true }),
    ],
  },
  ...['Pinecone', 'Weaviate', 'Milvus', 'Chroma', 'Redis'].map((name) => ({
    id: name.toUpperCase(),
    name,
    description: `${name} store.`,
    docsUrl: '',
    icon: null,
    fields: [field('url', 'URL')],
  })),
];

const ONEBOX: IndexingStore = {
  id: 'onebox',
  name: 'OneBox hosted',
  provider: 'ONEBOX',
  paused: false,
  search: true,
};
const listOf = (...stores: IndexingStore[]): IndexingStores => ({
  searchStoreId: stores.find((store) => store.search)?.id ?? 'onebox',
  stores,
});

function setup(stores: IndexingStores, overrides: Partial<ApiClient> = {}, semantic: object = {}) {
  const api = fakeApi({
    restoreSession: vi.fn(async () => testUser),
    get: routedGet({
      '/settings/indexing-storage/stores': () => ({ stores: STORES }),
      '/settings/indexing-storage': () => stores,
      '/search/semantic': () => ({
        active: { id: 'm', name: 'm', dimensions: 3, local: true },
        rebuild: null,
        ...semantic,
      }),
    }),
    ...overrides,
  });
  renderPage(<Section />, { path: '/settings', api });
}

describe('IndexingStorageSection', () => {
  it('adds a vector database with the fields it asks for, saying why one fails', async () => {
    const post = vi
      .fn()
      .mockRejectedValueOnce(
        new ApiError(400, 'STORE_CHECK', 'Neo4j: The store rejected these credentials'),
      )
      .mockResolvedValueOnce({
        id: 'n1',
        name: 'Graph',
        provider: 'NEO4J',
        paused: false,
        search: false,
      });
    setup(listOf(ONEBOX), { post: post as ApiClient['post'] });
    expect(await screen.findByRole('checkbox', { name: 'OneBox hosted' })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Search vector databases'), 'neo');
    await userEvent.click(screen.getByRole('button', { name: 'Add Neo4j' }));

    const dialog = await screen.findByRole('dialog', { name: /Add Neo4j/ });
    expect(within(dialog).getByLabelText('Username')).toHaveValue('neo4j');
    const add = within(dialog).getByRole('button', { name: 'Check and add' });
    expect(add).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText('Name (optional)'), 'Graph');
    await userEvent.type(within(dialog).getByLabelText('URL'), 'neo4j+s://x.databases.neo4j.io');
    await userEvent.type(within(dialog).getByLabelText('Password'), 'wrong');
    await userEvent.click(add);
    expect(
      await within(dialog).findByText('Neo4j: The store rejected these credentials'),
    ).toBeVisible();
    await userEvent.click(add);
    expect(await screen.findByText('Graph added')).toBeVisible();
    expect(post).toHaveBeenLastCalledWith('/settings/indexing-storage', {
      provider: 'NEO4J',
      name: 'Graph',
      settings: { url: 'neo4j+s://x.databases.neo4j.io', username: 'neo4j', password: 'wrong' },
    });
  });

  it('pages through the databases on offer', async () => {
    setup(listOf(ONEBOX));
    expect(await screen.findByText('Qdrant')).toBeVisible();
    expect(screen.queryByText('Redis')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /page 2/i }));
    expect(await screen.findByText('Redis')).toBeVisible();
  });

  it('shows each store’s backup, pauses and resumes one, and switches searches to another', async () => {
    const milvus = (id: string, name: string, paused: boolean): IndexingStore => ({
      id,
      name,
      provider: 'MILVUS',
      paused,
      search: false,
      settings: { url: `https://${id}.example.com` },
      keyHint: null,
    });
    const patch = vi.fn(async () => listOf(ONEBOX));
    const put = vi.fn(async () => listOf(ONEBOX));
    setup(
      listOf(
        ONEBOX,
        milvus('a', 'Milvus', false),
        milvus('b', 'Milvus 2', true),
        milvus('c', 'Milvus 3', false),
      ),
      { patch: patch as ApiClient['patch'], put: put as ApiClient['put'] },
      {
        stores: [
          {
            id: 'onebox',
            paused: false,
            search: true,
            upToDate: true,
            lastBackedUpAt: '2026-11-20T09:05:00Z',
            catchup: null,
          },
          {
            id: 'a',
            paused: false,
            search: false,
            upToDate: false,
            catchup: { done: 120, total: 500 },
          },
          { id: 'b', paused: true, search: false, upToDate: false, catchup: null },
          {
            id: 'c',
            paused: false,
            search: false,
            upToDate: false,
            catchup: { done: 0, total: 0 },
          },
        ],
      },
    );
    // Each store's state, and a banner per backup running, with how far it has got.
    expect(await screen.findByText('Backing up · 24%')).toBeVisible();
    expect(screen.getByText('Backup in progress')).toBeVisible();
    expect(screen.getByText('Paused')).toBeVisible();
    expect(screen.getByText('Backed up')).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Last backed up' })).toBeVisible();
    expect(screen.getByText(/^Fri, Nov 20, /)).toBeVisible();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.getByText('Backing up your mail to Milvus')).toBeVisible();
    expect(screen.getByText(/120 of 500 emails/)).toBeVisible();
    expect(screen.getByText('Backing up your mail to Milvus 3')).toBeVisible();
    expect(screen.getByText('Starting…')).toBeVisible();
    expect(screen.getByRole('status', { name: 'Search store' })).toHaveTextContent(
      'Searches across your mail use OneBox hosted.',
    );

    const pick = (name: string) => userEvent.click(screen.getByRole('checkbox', { name }));
    const button = (name: string) => screen.getByRole('button', { name });
    // The search store can't be paused, removed or moved off.
    await pick('OneBox hosted');
    expect(button('Use for search')).toBeDisabled();
    expect(button('Pause')).toBeDisabled();
    expect(button('Remove')).toBeDisabled();
    await pick('OneBox hosted');

    // Each change is asked first, and the dialog waits for it to take effect.
    const confirmWith = async (title: string, name: string) => {
      const dialog = await screen.findByRole('dialog', { name: title });
      await userEvent.click(within(dialog).getByRole('button', { name }));
      await waitFor(() => expect(screen.queryByRole('dialog', { name: title })).toBeNull());
    };
    await pick('Milvus 2');
    await userEvent.click(button('Resume'));
    expect(patch).not.toHaveBeenCalled();
    await confirmWith('Resume Milvus 2?', 'Resume');
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/settings/indexing-storage/b', { paused: false }),
    );
    expect(
      await screen.findByText(/backing up again, starting with only the mail missed/),
    ).toBeInTheDocument();

    // Several picked, some paused: one click pauses the rest.
    await pick('Milvus');
    await userEvent.click(button('Pause'));
    await confirmWith('Pause Milvus?', 'Pause');
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/settings/indexing-storage/a', { paused: true }),
    );
    expect(patch).not.toHaveBeenCalledWith('/settings/indexing-storage/b', { paused: true });
    await pick('Milvus 2');
    await userEvent.click(button('Use for search'));
    const dialog = await screen.findByRole('dialog', { name: 'Use Milvus for search?' });
    expect(within(dialog).getByText(/doesn’t have all your mail yet/)).toBeVisible();
    await confirmWith('Use Milvus for search?', 'Use for search');
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/settings/indexing-storage/search', { storeId: 'a' }),
    );
    expect(await screen.findByText('Searches now go to Milvus.')).toBeInTheDocument();
  });

  it('groups more than three running backups into one stack that expands', async () => {
    const ids = ['a', 'b', 'c', 'd'];
    setup(
      listOf(
        ONEBOX,
        ...ids.map((id) => ({
          id,
          name: `Milvus ${id}`,
          provider: 'MILVUS',
          paused: false,
          search: false,
        })),
      ),
      {},
      {
        stores: ids.map((id) => ({
          id,
          paused: false,
          search: false,
          upToDate: false,
          catchup: { done: 10, total: 100 },
        })),
      },
    );
    const expand = await screen.findByRole('button', { name: 'Show all backups' });
    expect(expand).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(expand);
    expect(expand).toHaveAttribute('aria-expanded', 'true');
    for (const id of ids) {
      expect(await screen.findByText(`Backing up your mail to Milvus ${id}`)).toBeInTheDocument();
    }
  });

  it('edits a store keeping its saved secret, and removes one after asking', async () => {
    const del = vi.fn(async () => undefined);
    const qdrant: IndexingStore = {
      id: 'q1',
      name: 'Qdrant',
      provider: 'QDRANT',
      paused: false,
      search: false,
      settings: { url: 'https://q.example.com' },
      keyHint: 'ab12',
    };
    setup(listOf(ONEBOX, qdrant), { delete: del as ApiClient['delete'] });
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Qdrant' }));
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: /Edit Qdrant/ });
    expect(within(dialog).getByLabelText('URL')).toHaveValue('https://q.example.com');
    expect(within(dialog).getByLabelText('API key (optional)')).toHaveAttribute(
      'placeholder',
      'Saved (…ab12)',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    const confirm = await screen.findByRole('dialog', { name: 'Remove Qdrant?' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(del).toHaveBeenCalledWith('/settings/indexing-storage/q1'));
  });
});
