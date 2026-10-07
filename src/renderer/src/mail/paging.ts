import { useState } from 'react';
import type { PageRequest } from '../api/mail';

export const PAGE_SIZE = 50;

// Pages are anchored to conversations (cursors), so new mail never shifts what a page shows.
export function usePaging() {
  const [state, setState] = useState<PageRequest & { index: number }>({
    cursor: null,
    direction: 'next',
    index: 0,
  });
  return {
    page: { cursor: state.cursor, direction: state.direction } satisfies PageRequest,
    index: state.index,
    next: (cursor: string) => setState((s) => ({ cursor, direction: 'next', index: s.index + 1 })),
    prev: (cursor: string | null) =>
      setState((s) =>
        s.index <= 1 || !cursor
          ? { cursor: null, direction: 'next', index: 0 }
          : { cursor, direction: 'prev', index: s.index - 1 },
      ),
    first: () => setState({ cursor: null, direction: 'next', index: 0 }),
  };
}

export function rangeLabel(index: number, count: number, total?: number | null) {
  if (count === 0) return total ? `0 of ${total.toLocaleString()}` : '0';
  const start = index * PAGE_SIZE + 1;
  const range = `${start.toLocaleString()}–${(start + count - 1).toLocaleString()}`;
  return total ? `${range} of ${total.toLocaleString()}` : range;
}
