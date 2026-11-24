import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../api/client';
import type { Chunk, KnowledgeRecord, RagSettings } from '../api/knowledge';
import { useAuth } from '../auth/AuthProvider';
import { fakeApi, routedGet, testUser } from '../test/fake-api';
import { renderPage } from '../test/render';
import KnowledgePage from './KnowledgePage';

function WhenSignedIn() {
  return useAuth().state.status === 'authenticated' ? <KnowledgePage /> : null;
}

const DATES = {
  created: '2026-03-01T00:00:00Z',
  modified: '2026-03-01T00:00:00Z',
  origin: 'upload',
} as const;

function chunk(recordId: string, name: string, block: number, score: number, text: string): Chunk {
  return {
    id: `${recordId}:block:${block}`,
    text,
    score,
    kind: 'block',
    record: {
      recordId,
      name,
      mimeType: 'application/pdf',
      sourceType: 'upload',
      sourceId: 'policies',
      updatedAt: DATES.created,
      dates: DATES,
    },
    citation: { page: 2, blockIndex: block, blockIndices: [block] },
  };
}

const record = (id: string, name: string): KnowledgeRecord => ({
  id,
  sourceType: 'upload',
  sourceId: 'policies',
  name,
  mimeType: 'application/pdf',
  sizeBytes: 2048,
  status: 'completed',
  stage: null,
  reason: null,
  createdAt: DATES.created,
  sourceCreatedAt: DATES.created,
  sourceModifiedAt: DATES.modified,
  dateOrigin: 'upload',
  parentId: null,
  classifyStatus: 'completed',
  classification: {
    summary: 'How refunds work for parcels.',
    category: 'Policy',
    subcategories: null,
    languages: ['English'],
    topics: ['Refunds'],
    organizations: null,
  },
});

const signedIn = (overrides: Partial<ApiClient>) =>
  fakeApi({ restoreSession: vi.fn(async () => testUser), ...overrides });

describe('KnowledgePage', () => {
  it('groups passages by record, lists every citation and previews the cited block', async () => {
    const post = vi.fn(async () => ({
      chunks: [
        chunk('r1', 'Refund policy.pdf', 3, 0.9, 'Refunds are paid within 14 days.'),
        chunk('r2', 'Terms.pdf', 1, 0.5, 'Refunds need a receipt.'),
        chunk('r1', 'Refund policy.pdf', 7, 0.4, 'Parcels lost in transit are refunded.'),
      ],
      unindexed: [],
    }));
    renderPage(<WhenSignedIn />, {
      path: '/knowledge?q=refunds',
      route: '/knowledge',
      api: signedIn({
        post: post as ApiClient['post'],
        get: routedGet({
          '/rag/sources': () => ({ sources: [] }),
          '/rag/records/r1/read': () => ({
            recordId: 'r1',
            name: 'Refund policy.pdf',
            mimeType: 'application/pdf',
            blocks: [
              { index: 0, type: 'text', text: 'Refund policy' },
              { index: 3, type: 'text', text: 'Refunds are paid within 14 days.' },
            ],
            total: 9,
            next: null,
            focused: true,
            gaps: [{ from: 1, to: 2 }],
          }),
          '/rag/records/r1': () => record('r1', 'Refund policy.pdf'),
        }),
      }),
    });

    expect(await screen.findByRole('tab', { name: /Results\s*2/ })).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith('/rag/retrieve', { query: 'refunds' });
    const card = screen.getByRole('button', { name: 'Refund policy.pdf' }).closest('article')!;
    expect(within(card).getByText('100%')).toBeInTheDocument();
    expect(within(card).getByText('1 more citation')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: /Citations\s*3/ }));
    expect(screen.getAllByRole('article')).toHaveLength(3);

    await userEvent.click(
      within(screen.getAllByRole('article')[0]!).getByRole('button', { name: 'Preview' }),
    );
    const drawer = await screen.findByRole('complementary', { name: 'Record preview' });
    expect(await within(drawer).findByText('How refunds work for parcels.')).toBeInTheDocument();
    expect(within(drawer).getByText('2 blocks left out')).toBeInTheDocument();
    const cited = within(drawer).getByText(
      (_, el) => el?.textContent === 'Refunds are paid within 14 days.' && el.tagName === 'P',
    );
    expect(cited.className).toMatch(/blockCited/);
  });

  it('reads selected records again', async () => {
    const post = vi.fn(async () => ({ queued: ['r1'], skipped: [] }));
    const get = routedGet({
      '/rag/sources': () => ({ sources: [] }),
      '/rag/records?': () => ({
        records: [record('r1', 'Refund policy.pdf'), record('r2', 'Terms.pdf')],
        total: 2,
        available: { statuses: { completed: 2 }, mimeTypes: { 'application/pdf': 2 } },
      }),
    });
    renderPage(<WhenSignedIn />, {
      path: '/knowledge/records',
      route: '/knowledge/:view',
      api: signedIn({ get, post: post as ApiClient['post'] }),
    });

    await userEvent.click(
      await screen.findByRole('checkbox', { name: 'Select Refund policy.pdf' }),
    );
    expect(screen.getByText('Showing 1–2 of 2 items')).toBeInTheDocument();
    await userEvent.click(
      within(screen.getByRole('toolbar', { name: 'Selected records' })).getByRole('button', {
        name: /Re-index/,
      }),
    );
    expect(post).toHaveBeenCalledWith('/rag/records/reindex', { ids: ['r1'] });
    expect(get).toHaveBeenCalledWith(
      expect.stringMatching(/^\/rag\/records\?sort=createdAt&order=desc&offset=0&limit=25$/),
    );
  });

  it('saves the search settings', async () => {
    const saved: RagSettings = {
      search: { results: 8, maxPerRecord: null, dateSafetyNet: true },
      indexing: { summaries: 'on', headerDates: 'off', windowChars: 1500, windowOverlap: 200 },
    };
    const put = vi.fn(async (_path: string, body: unknown) => ({ settings: body }));
    renderPage(<WhenSignedIn />, {
      path: '/knowledge/settings',
      route: '/knowledge/:view',
      api: signedIn({
        put: put as ApiClient['put'],
        get: routedGet({
          '/rag/sources': () => ({ sources: [] }),
          '/rag/settings': () => ({ settings: saved, defaults: saved, summariesAvailable: true }),
        }),
      }),
    });

    const results = await screen.findByRole('spinbutton', { name: 'Passages per search' });
    await userEvent.clear(results);
    await userEvent.type(results, '12');
    await userEvent.click(screen.getByRole('radio', { name: 'On first search' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/rag/settings', {
        ...saved,
        search: { ...saved.search, results: 12 },
        indexing: { ...saved.indexing, summaries: 'first_use' },
      }),
    );
  });
});
