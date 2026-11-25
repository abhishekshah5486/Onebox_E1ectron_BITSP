import { describe, expect, it } from 'vitest';
import { daysLeft } from './TrashView';

describe('daysLeft', () => {
  const now = Date.parse('2026-11-25T12:00:00Z');

  it('counts whole days until the retention ends, never below zero', () => {
    expect(daysLeft('2026-11-25T12:00:00Z', 14, now)).toBe(14);
    expect(daysLeft('2026-11-20T13:00:00Z', 14, now)).toBe(10);
    expect(daysLeft('2026-11-01T00:00:00Z', 14, now)).toBe(0);
    expect(daysLeft(null, 14, now)).toBe(14);
  });
});
