import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../api/client';
import { ApiError } from '../api/client';
import type { ProviderCard, ProviderDetail, UserModel } from '../api/providers';
import { useAuth } from '../auth/AuthProvider';
import { fakeApi, routedGet, testUser } from '../test/fake-api';
import { renderPage } from '../test/render';
import { FlashProvider } from './flash';
import { ModelProvidersSection } from './ModelProvidersSection';

function Section({ kind }: { kind: 'llm' | 'embedding' }) {
  return useAuth().state.status === 'authenticated' ? (
    <FlashProvider>
      <ModelProvidersSection kind={kind} />
    </FlashProvider>
  ) : null;
}

const apiKey = { key: 'apiKey', label: 'API key', secret: true, required: true, multiline: false };
const card = (id: string, name: string, extra: Partial<ProviderCard> = {}): ProviderCard => ({
  id,
  name,
  npm: '@ai-sdk/openai-compatible',
  logoUrl: `https://models.dev/logos/${id}.svg`,
  docsUrl: null,
  fields: [apiKey],
  modelCount: 3,
  embeddings: false,
  ...extra,
});
const groq: ProviderDetail = {
  ...card('groq', 'Groq'),
  docsUrl: 'https://console.groq.com/docs',
  models: [
    {
      id: 'llama-3.3-70b-versatile',
      name: 'Llama 3.3 70B',
      contextTokens: 131072,
      outputTokens: 32768,
      reasoning: false,
      multimodal: false,
      toolCalls: true,
      deprecated: false,
      embedding: false,
      usdPerMillion: { input: 0.59, output: 0.79 },
    },
  ],
};
const mine = (extra: Partial<UserModel> = {}): UserModel => ({
  id: '0b1c',
  kind: 'llm',
  providerId: 'groq',
  providerName: 'Groq',
  logoUrl: null,
  modelId: 'llama-3.3-70b-versatile',
  name: 'Llama 3.3 70B',
  keyHint: 'gsk_…9f2a',
  contextTokens: 131072,
  reasoning: false,
  multimodal: false,
  dimensions: null,
  createdAt: '2026-11-20T00:00:00Z',
  updatedAt: '2026-11-20T00:00:00Z',
  ...extra,
});

function setup(kind: 'llm' | 'embedding', models: UserModel[], overrides: Partial<ApiClient> = {}) {
  const api = fakeApi({
    restoreSession: vi.fn(async () => testUser),
    get: routedGet({
      '/llm/providers/groq': () => groq,
      '/llm/providers': () => ({
        items: [
          card('groq', 'Groq'),
          card('openai', 'OpenAI', { embeddings: true }),
          card('mistral', 'Mistral', { embeddings: true }),
        ],
      }),
      '/llm/user-models': () => ({ items: models }),
    }),
    ...overrides,
  });
  renderPage(<Section kind={kind} />, { path: '/settings', api });
  return api;
}

describe('ModelProvidersSection', () => {
  it('finds a provider and adds a model with its key, filling in what the catalogue knows', async () => {
    const post = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(400, 'MODEL_CHECK_FAILED', 'Groq rejected this API key'))
      .mockResolvedValueOnce(mine());
    setup('llm', [], { post: post as ApiClient['post'] });

    expect(await screen.findByText('OpenAI')).toBeVisible();
    await userEvent.type(screen.getByLabelText('Search providers'), 'gro');
    expect(screen.queryByText('OpenAI')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Configure Groq' }));

    const dialog = await screen.findByRole('dialog', { name: /Configure Groq/ });
    const add = within(dialog).getByRole('button', { name: 'Check and add' });
    expect(add).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText('API key'), 'gsk_secret');
    await userEvent.type(within(dialog).getByLabelText('Model'), 'llama');
    await userEvent.click(await screen.findByTitle('Llama 3.3 70B'));
    expect(within(dialog).getByLabelText('Context length (tokens)')).toHaveValue(131072);

    await userEvent.click(add);
    expect(await within(dialog).findByText('Groq rejected this API key')).toBeVisible();
    await userEvent.click(add);
    expect(
      await screen.findByText('Llama 3.3 70B added. Pick it for any task in Settings > AI.'),
    ).toBeVisible();
    expect(post).toHaveBeenLastCalledWith('/llm/user-models', {
      kind: 'llm',
      providerId: 'groq',
      modelId: 'llama-3.3-70b-versatile',
      settings: { apiKey: 'gsk_secret' },
      contextTokens: 131072,
      reasoning: false,
      multimodal: false,
    });
  });

  it('only offers providers with embedding models for embeddings', async () => {
    setup('embedding', []);
    expect(await screen.findByText('Mistral')).toBeVisible();
    expect(screen.queryByText('Groq')).toBeNull();
  });

  it('lists configured models, edits one keeping its key, and removes another', async () => {
    const patch = vi.fn(async () => mine({ name: 'Fast llama' }));
    const del = vi.fn(async () => undefined);
    setup('llm', [mine()], {
      patch: patch as ApiClient['patch'],
      delete: del as ApiClient['delete'],
    });
    await userEvent.click((await screen.findAllByText('Configured models (1)'))[0]!);
    expect(await screen.findByText('gsk_…9f2a')).toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: 'Edit Llama 3.3 70B' }));
    const dialog = await screen.findByRole('dialog', { name: /Edit Llama 3.3 70B/ });
    expect(within(dialog).getByLabelText('API key')).toHaveAttribute(
      'placeholder',
      'Saved (gsk_…9f2a)',
    );
    const name = within(dialog).getByLabelText('Display name (optional)');
    await userEvent.clear(name);
    await userEvent.type(name, 'Fast llama');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/llm/user-models/0b1c', {
        modelId: 'llama-3.3-70b-versatile',
        name: 'Fast llama',
        contextTokens: 131072,
        reasoning: false,
        multimodal: false,
      }),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Remove Llama 3.3 70B' }));
    const confirm = await screen.findByRole('dialog', { name: 'Remove model' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(del).toHaveBeenCalledWith('/llm/user-models/0b1c'));
  });
});
