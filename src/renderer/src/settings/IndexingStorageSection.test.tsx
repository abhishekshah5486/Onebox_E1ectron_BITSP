import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, type ApiClient } from '../api/client';
import type { IndexingStore, VectorStoreInfo } from '../api/providers';
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

function setup(store: IndexingStore, overrides: Partial<ApiClient> = {}) {
  const api = fakeApi({
    restoreSession: vi.fn(async () => testUser),
    get: routedGet({
      '/settings/indexing-storage/stores': () => ({ stores: STORES }),
      '/settings/indexing-storage': () => store,
    }),
    ...overrides,
  });
  renderPage(<Section />, { path: '/settings', api });
}

describe('IndexingStorageSection', () => {
  it('connects a vector database with the fields it asks for, saying why one fails', async () => {
    const put = vi
      .fn()
      .mockRejectedValueOnce(
        new ApiError(400, 'STORE_CHECK', 'Neo4j: The store rejected these credentials'),
      )
      .mockResolvedValueOnce({
        provider: 'NEO4J',
        settings: { url: 'neo4j+s://x.databases.neo4j.io', username: 'neo4j' },
        keyHint: null,
        updatedAt: '2026-11-23T00:00:00Z',
      });
    setup({ provider: 'ONEBOX' }, { put: put as ApiClient['put'] });
    expect(await screen.findByText('In use')).toBeVisible();
    await userEvent.type(screen.getByLabelText('Search vector databases'), 'neo');
    await userEvent.click(screen.getByRole('button', { name: 'Configure Neo4j' }));

    const dialog = await screen.findByRole('dialog', { name: /Connect Neo4j/ });
    expect(within(dialog).getByLabelText('Username')).toHaveValue('neo4j');
    const connect = within(dialog).getByRole('button', { name: 'Check and connect' });
    expect(connect).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText('URL'), 'neo4j+s://x.databases.neo4j.io');
    await userEvent.type(within(dialog).getByLabelText('Password'), 'wrong');
    await userEvent.click(connect);
    expect(
      await within(dialog).findByText('Neo4j: The store rejected these credentials'),
    ).toBeVisible();
    await userEvent.click(connect);
    expect(await screen.findByText('Neo4j is connected')).toBeVisible();
    expect(put).toHaveBeenLastCalledWith('/settings/indexing-storage', {
      provider: 'NEO4J',
      settings: { url: 'neo4j+s://x.databases.neo4j.io', username: 'neo4j', password: 'wrong' },
    });
  });

  it('pages through the databases on offer', async () => {
    setup({ provider: 'ONEBOX' });
    expect(await screen.findByText('Qdrant')).toBeVisible();
    expect(screen.queryByText('Redis')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /page 2/i }));
    expect(await screen.findByText('Redis')).toBeVisible();
  });

  it('edits the store in use keeping its saved secret, and moves back to OneBox after asking', async () => {
    const del = vi.fn(async () => undefined);
    setup(
      {
        provider: 'QDRANT',
        settings: { url: 'https://q.example.com' },
        keyHint: 'ab12',
        updatedAt: '2026-11-22T00:00:00Z',
      },
      { delete: del as ApiClient['delete'] },
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Qdrant' }));
    const dialog = await screen.findByRole('dialog', { name: /Edit Qdrant/ });
    expect(within(dialog).getByLabelText('URL')).toHaveValue('https://q.example.com');
    expect(within(dialog).getByLabelText('API key (optional)')).toHaveAttribute(
      'placeholder',
      'Saved (…ab12)',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await userEvent.click(screen.getByRole('button', { name: 'Move back' }));
    const confirm = await screen.findByRole('dialog', {
      name: 'Move search vectors back to OneBox?',
    });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Move back' }));
    await waitFor(() => expect(del).toHaveBeenCalledWith('/settings/indexing-storage'));
  });
});
