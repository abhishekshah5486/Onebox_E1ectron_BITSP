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

    const row = (await screen.findByText('Pricing for 20 seats?')).closest<HTMLElement>(
      '[role="row"]',
    )!;
    expect(within(row).getByText('Leads')).toBeInTheDocument();
    expect(within(row).getByText('0.91')).toBeInTheDocument();
    // Shown while the row is hovered, which jsdom cannot do.
    await userEvent.click(within(row).getByRole('button', { name: 'Accept Leads', hidden: true }));
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

  it('marks a suggested category and accepts it as one', async () => {
    const messageId = 'c'.repeat(64);
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
                threadId: 'd'.repeat(64),
                accountId: 'acc-1',
                from: 'IndiGo <noreply@goindigo.in>',
                subject: 'Your trip to Pune',
                receivedAt: '2026-11-20T10:00:00.000Z',
                model: 'gemini-3.8-flash',
                results: [
                  {
                    kind: 'category',
                    path: 'travel',
                    name: 'Travel',
                    confidence: 0.88,
                    reason: 'A flight booking',
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

    const row = (await screen.findByText('Your trip to Pune')).closest<HTMLElement>(
      '[role="row"]',
    )!;
    expect(within(row).getByText('· Category', { exact: false })).toBeInTheDocument();
    await userEvent.click(
      within(row).getByRole('button', { name: /^Accept Travel/, hidden: true }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/shows under that category/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Accept' }));
    expect(post).toHaveBeenCalledWith(`/ai/suggestions/${messageId}/decide`, {
      path: 'travel',
      accept: true,
    });
  });

  it('marks a suggested category in the v2 table too', async () => {
    localStorage.setItem('onebox.ui-version', 'v2');
    const messageId = 'c'.repeat(64);
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
                threadId: 'd'.repeat(64),
                accountId: 'acc-1',
                from: 'IndiGo <noreply@goindigo.in>',
                subject: 'Your trip to Pune',
                receivedAt: '2026-11-20T10:00:00.000Z',
                model: 'gemini-3.8-flash',
                results: [
                  {
                    kind: 'category',
                    path: 'travel',
                    name: 'Travel',
                    confidence: 0.88,
                    reason: 'A flight booking',
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

    const table = await screen.findByRole('table');
    expect(await within(table).findByText('· Category', { exact: false })).toBeInTheDocument();
    localStorage.clear();
  });
});
