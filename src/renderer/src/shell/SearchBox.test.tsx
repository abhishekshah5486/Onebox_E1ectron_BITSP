import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { renderPage } from '../test/render';
import { SearchBox } from './SearchBox';

function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname}</p>;
}

const show = (path = '/inbox') =>
  renderPage(
    <>
      <SearchBox />
      <Where />
    </>,
    { path, route: '*' },
  );
const where = () => decodeURIComponent(screen.getByTestId('where').textContent ?? '');

describe('SearchBox', () => {
  it('runs a keyword search on Enter, and a semantic search with Semantic on', async () => {
    show();
    const box = screen.getByRole('textbox', { name: 'Search mail' });
    await userEvent.type(box, 'invoice from:alice{Enter}');
    expect(where()).toBe('/search/keyword/invoice from:alice');

    await userEvent.click(screen.getByRole('button', { name: /Semantic/ }));
    await userEvent.type(box, '{Enter}');
    expect(where()).toBe('/search/semantic/invoice from:alice');
  });

  it('ignores an empty search', async () => {
    show();
    await userEvent.type(screen.getByRole('textbox', { name: 'Search mail' }), '   {Enter}');
    expect(where()).toBe('/inbox');
  });

  it('shows the search a results page is for', () => {
    show('/search/semantic/trip%20to%20paris');
    expect(screen.getByRole('textbox', { name: 'Search mail' })).toHaveValue('trip to paris');
    expect(screen.getByRole('button', { name: /Semantic/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('builds a search from the options panel', async () => {
    show();
    await userEvent.click(screen.getByRole('button', { name: 'Search options' }));
    const panel = screen.getByRole('dialog', { name: 'Search options' });
    const search = within(panel).getByRole('button', { name: 'Search' });
    await userEvent.type(screen.getByLabelText('From'), 'alice@x.com');
    await userEvent.type(screen.getByLabelText('Subject'), 'quarterly report');
    await userEvent.selectOptions(within(panel).getByRole('combobox', { name: 'Search' }), 'sent');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Has attachment' }));
    expect(panel).toHaveTextContent(
      'from:alice@x.com subject:"quarterly report" in:sent has:attachment',
    );
    await userEvent.click(search);
    expect(where()).toBe(
      '/search/keyword/from:alice@x.com subject:"quarterly report" in:sent has:attachment',
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the panel when searching with nothing filled in', async () => {
    show();
    await userEvent.click(screen.getByRole('button', { name: 'Search options' }));
    const panel = screen.getByRole('dialog', { name: 'Search options' });
    await userEvent.click(within(panel).getByRole('button', { name: 'Search' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(where()).not.toMatch(/^\/search/);
  });

  it('closes the panel with Escape', async () => {
    show();
    await userEvent.click(screen.getByRole('button', { name: 'Search options' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
