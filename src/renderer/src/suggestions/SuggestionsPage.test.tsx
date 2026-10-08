import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { fakeApi, routedGet, testUser } from '../test/fake-api';
import { renderPage } from '../test/render';
import { SuggestionsPage } from './SuggestionsPage';

function WhenSignedIn() {
  return useAuth().state.status === 'authenticated' ? <SuggestionsPage /> : null;
}

describe('SuggestionsPage', () => {
  it('lists waiting suggestions with the reason and accepts one', async () => {
    const messageId = 'a'.repeat(64);
    const post = vi.fn(async () => ({}));
    renderPage(<WhenSignedIn />, {
      path: '/suggestions',
      api: fakeApi({
        restoreSession: vi.fn(async () => testUser),
        post: post as ApiClient['post'],
        get: routedGet({
          '/ai/suggestions?': () => ({
            items: [
              {
                messageId,
                threadId: 'b'.repeat(64),
                accountId: 'acc-1',
                from: 'Priya <priya@acme.example>',
                subject: 'Pricing for 20 seats?',
                receivedAt: '2026-10-08T10:00:00.000Z',
                model: 'gemini-3.8-flash',
                results: [
                  {
                    path: 'Leads',
                    name: 'Leads',
                    confidence: 0.91,
                    reason: 'Asks for pricing',
                    status: 'pending',
                  },
                ],
              },
            ],
            total: 1,
            page: 1,
            pageSize: 50,
          }),
        }),
      }),
    });

    const row = (await screen.findByText('Pricing for 20 seats?')).closest('tr')!;
    expect(within(row).getByText('Leads')).toBeInTheDocument();
    expect(within(row).getByText('0.91')).toBeInTheDocument();
    // Shown while the row is hovered, which jsdom cannot do.
    await userEvent.click(within(row).getByLabelText('Accept Leads for Pricing for 20 seats?'));
    // Nothing changes until it is confirmed.
    expect(post).not.toHaveBeenCalledWith(expect.stringContaining('/decide'), expect.anything());
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Accept' }),
    );
    expect(post).toHaveBeenCalledWith(`/ai/suggestions/${messageId}/decide`, {
      path: 'Leads',
      accept: true,
    });
  });
});
