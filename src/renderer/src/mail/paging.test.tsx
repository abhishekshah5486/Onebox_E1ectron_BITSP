import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { rangeLabel, usePaging } from './paging';

describe('usePaging', () => {
  it('walks forward and back to the first page', () => {
    const { result } = renderHook(() => usePaging());
    act(() => result.current.next('c1'));
    act(() => result.current.next('c2'));
    expect(result.current).toMatchObject({ index: 2, page: { cursor: 'c2', direction: 'next' } });

    act(() => result.current.prev('p2'));
    expect(result.current).toMatchObject({ index: 1, page: { cursor: 'p2', direction: 'prev' } });

    act(() => result.current.prev('p1'));
    expect(result.current).toMatchObject({ index: 0, page: { cursor: null, direction: 'next' } });
  });
});

describe('rangeLabel', () => {
  it('formats Gmail-style ranges', () => {
    expect(rangeLabel(0, 50, 8300)).toBe('1–50 of 8,300');
    expect(rangeLabel(2, 12, null)).toBe('101–112');
    expect(rangeLabel(0, 0, null)).toBe('0');
  });
});
