import { describe, expect, it } from 'vitest';
import { formatWhen } from './parts';

describe('formatWhen', () => {
  it('shows a time in UTC', () => {
    expect(formatWhen('2026-11-24T21:17:00+05:30')).toBe('24 Nov 2026, 15:47');
    expect(formatWhen(null)).toBe('-');
  });
});
