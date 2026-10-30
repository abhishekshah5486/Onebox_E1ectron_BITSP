import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import { fakeApi, routedGet } from '../test/fake-api';
import { thread } from '../test/mail-fixtures';
import { renderPage } from '../test/render';
import { SearchPage } from './SearchPage';

const results = (mode = 'keyword', subjects = ['Flight to Paris', 'Paris hotels']) => ({
  mode,
  items: subjects.map((subject, i) => ({
    thread: thread({ id: String(i + 1).repeat(64), subject }),
    messageId: `m${i}`,
    score: null,
    highlights: [],
  })),
  total: subjects.length,
  nextPage: null,
});

const show = (path: string, get = routedGet({ '/search?': () => results() })) => {
  const api = fakeApi({ get });
  renderPage(<SearchPage />, { path, route: '/search/:mode/:q', api });
  return api;
};

describe('SearchPage', () => {
  it('lists the conversations that matched', async () => {
    const api = show('/search/keyword/paris');
    expect(await screen.findByText('Flight to Paris')).toBeInTheDocument();
    expect(screen.getByText('Paris hotels')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/search?q=paris&mode=keyword&page=0&pageSize=50');
    expect(screen.getByRole('tab', { name: 'Keyword search' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('runs AI search and says what it does', async () => {
    const get = routedGet({ '/search?': () => results('semantic', ['Trip ideas']) });
    show('/search/semantic/holiday%20plans', get);
    expect(await screen.findByText('Trip ideas')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/search?q=holiday+plans&mode=semantic&page=0&pageSize=50');
    expect(screen.getByText(/finds mail by meaning/)).toBeInTheDocument();
  });

  it('switches between keyword and AI search', async () => {
    const get = routedGet({ '/search?': () => results() });
    show('/search/keyword/paris', get);
    await screen.findByText('Flight to Paris');
    await userEvent.click(screen.getByRole('tab', { name: 'AI search' }));
    await vi.waitFor(() =>
      expect(get).toHaveBeenCalledWith('/search?q=paris&mode=semantic&page=0&pageSize=50'),
    );
  });

  it('says when AI search had nothing but operators to go on', async () => {
    show('/search/semantic/from:alice', routedGet({ '/search?': () => results('keyword') }));
    expect(await screen.findByText(/Only search operators were given/)).toBeInTheDocument();
  });

  it('says when nothing matched', async () => {
    show('/search/keyword/zzz', routedGet({ '/search?': () => results('keyword', []) }));
    expect(await screen.findByText('No messages matched your search')).toBeInTheDocument();
  });

  it('points to plans when the user is out of credits', async () => {
    show(
      '/search/semantic/trip',
      routedGet({
        '/search?': () => {
          throw new ApiError(402, 'OUT_OF_CREDITS', 'out');
        },
      }),
    );
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('You are out of AI credits');
    expect(within(alert).getByRole('link', { name: 'See plans' })).toHaveAttribute(
      'href',
      '/plans',
    );
  });
});
