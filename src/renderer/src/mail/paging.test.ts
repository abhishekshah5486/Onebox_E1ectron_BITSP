import { describe, expect, it } from 'vitest';
import { rangeLabel } from './paging';

describe('rangeLabel', () => {
  it('formats Gmail-style ranges', () => {
    expect(rangeLabel(1, 50, 8300)).toBe('1–50 of 8,300');
    expect(rangeLabel(3, 12, null)).toBe('101–112');
    expect(rangeLabel(1, 0, null)).toBe('0');
  });
});
