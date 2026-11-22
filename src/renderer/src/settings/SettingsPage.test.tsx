import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../auth/AuthProvider';
import { fakeApi, routedGet, testUser } from '../test/fake-api';
import { renderPage } from '../test/render';
import { SettingsPage } from './SettingsPage';

beforeEach(() => localStorage.clear());

function WhenSignedIn() {
  return useAuth().state.status === 'authenticated' ? <SettingsPage /> : null;
}

async function renderSettings(tab = 'accounts', api = fakeApi()) {
  renderPage(<WhenSignedIn />, {
    path: `/settings/${tab}`,
    route: '/settings/:tab',
    api: { ...api, restoreSession: vi.fn(async () => testUser) },
  });
  await screen.findByRole('heading', { name: 'Settings' });
}

describe('SettingsPage', () => {
  it('shows the profile of the signed in user', async () => {
    await renderSettings('appearance');
    expect(screen.getByText(testUser.name)).toBeInTheDocument();
    expect(screen.getByText(testUser.email)).toBeInTheDocument();
  });

  it('switches the theme from the appearance tiles', async () => {
    await renderSettings('appearance');
    await userEvent.click(screen.getByRole('radio', { name: /Dark/ }));

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('onebox.theme')).toBe('dark');
  });

  it('switches between the v1 and v2 interfaces', async () => {
    await renderSettings('appearance');
    await userEvent.click(screen.getByRole('radio', { name: /v2 · Console/ }));

    expect(localStorage.getItem('onebox.ui-version')).toBe('v2');
    expect(document.documentElement.dataset.ui).toBe('v2');
  });

  it('shows each section on its own tab, starting from the address', async () => {
    await renderSettings();
    expect(await screen.findByText('No accounts connected')).toBeInTheDocument();
    expect(
      within(screen.getByRole('table', { name: /Connected accounts/ })).getAllByRole('columnheader')
        .length,
    ).toBeGreaterThan(3);
    await userEvent.click(screen.getByRole('tab', { name: 'Integrations' }));
    // Integrations are a Pro feature, locked on Free.
    expect(await screen.findByText('Pro plan required')).toBeInTheDocument();
  });

  it('warns before switching embedding model, then shows its progress and when it is done', async () => {
    const model = (id: string, name: string, extra = {}) => ({
      id,
      provider: id.split('/')[0],
      name,
      description: '',
      dimensions: 1024,
      local: true,
      available: true,
      usdPerMillionTokens: 0,
      ...extra,
    });
    const bge = { id: 'ollama/bge-m3', name: 'bge-m3', dimensions: 1024, local: true };
    const nomic = {
      id: 'ollama/nomic-embed-text',
      name: 'nomic-embed-text',
      dimensions: 768,
      local: true,
    };
    let chosen = 'ollama/bge-m3';
    // The server's view of the switch, step by step.
    const statuses = [
      {
        active: bge,
        rebuild: {
          modelId: nomic.id,
          done: 400,
          total: 1_600,
          startedAt: new Date(Date.now() - 60_000).toISOString(),
        },
      },
      { active: nomic, rebuild: null },
    ];
    let step = -1;
    const get = routedGet({
      '/llm/embeddings': () => ({
        items: [
          model('ollama/bge-m3', 'bge-m3'),
          model('ollama/nomic-embed-text', 'nomic-embed-text', { dimensions: 768 }),
          model('openai/text-embedding-3-small', 'OpenAI text-embedding-3-small', {
            local: false,
            available: false,
            usdPerMillionTokens: 0.02,
          }),
        ],
        chosen,
        default: 'ollama/bge-m3',
      }),
      '/search/semantic/estimate': () => ({ emails: 1_600, seconds: 150 }),
      '/search/semantic': () =>
        step < 0 ? { active: bge, rebuild: null } : statuses[Math.min(step++, 1)],
    });
    const put = vi.fn(async (_path: string, body: { modelId: string }) => {
      chosen = body.modelId;
      step = 0;
      return { chosen };
    });
    await renderSettings('ai', fakeApi({ get, put: put as never }));

    expect(await screen.findByText('Searching with bge-m3')).toBeInTheDocument();
    expect(screen.getByText('OpenAI key needed')).toBeInTheDocument();
    expect(screen.getByText('Free · local · 768 dims')).toBeInTheDocument();
    // The details open from the info icon without picking that model.
    await userEvent.click(screen.getByRole('button', { name: 'About nomic-embed-text' }));
    expect(await screen.findByText('This server, with Ollama')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /nomic-embed-text/ })).not.toBeChecked();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('radio', { name: /nomic-embed-text/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Use this model' }));

    const modal = await screen.findByRole('dialog');
    expect(within(modal).getByText('All your mail will be embedded again')).toBeInTheDocument();
    expect(await within(modal).findByText(/1,600 emails will be embedded/)).toBeInTheDocument();
    expect(within(modal).getByText('about 3 minutes')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/search/semantic/estimate?model=ollama%2Fnomic-embed-text');
    expect(put).not.toHaveBeenCalled();

    await userEvent.click(within(modal).getByRole('button', { name: 'Re-embed all mail' }));
    expect(put).toHaveBeenCalledWith('/llm/embeddings/choice', {
      modelId: 'ollama/nomic-embed-text',
    });
    expect(
      await screen.findByText(
        'Re-embedding your mail with nomic-embed-text',
        {},
        { timeout: 5_000 },
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/400 of 1,600 emails, about \d minutes left/)).toBeInTheDocument();

    expect(
      await screen.findByText('Semantic search is ready', {}, { timeout: 8_000 }),
    ).toBeInTheDocument();
    expect(screen.getByText('Searching with nomic-embed-text')).toBeInTheDocument();
  }, 20_000);
});
