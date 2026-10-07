import { describe, expect, it } from 'vitest';
import { displayName, formatBytes, formatListDate, formatMessageDate, formatUtc } from './format';

const now = new Date('2026-10-07T15:00:00');

describe('formatListDate', () => {
  it('shows the time for today', () => {
    expect(formatListDate(new Date('2026-10-07T09:05:00').toISOString(), now)).toMatch(/9:05/);
  });

  it('shows month and day earlier this year', () => {
    expect(formatListDate(new Date('2026-03-02T09:05:00').toISOString(), now)).toMatch(
      /Mar\s*2|2\s*Mar/,
    );
  });

  it('includes the year for older mail', () => {
    expect(formatListDate(new Date('2024-03-02T09:05:00').toISOString(), now)).toMatch(/2024/);
  });
});

describe('displayName', () => {
  it('prefers the name, then the mailbox part', () => {
    expect(displayName({ name: 'Priya Sharma', address: 'priya@acme.example' })).toBe(
      'Priya Sharma',
    );
    expect(displayName({ name: '', address: 'noreply@github.com' })).toBe('noreply');
    expect(displayName(null)).toBe('(unknown sender)');
  });
});

describe('formatBytes', () => {
  it.each([
    [512, '512 B'],
    [2048, '2 KB'],
    [5 * 1024 * 1024, '5.0 MB'],
  ])('%i -> %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });
});

describe('console dates', () => {
  it('formats a precise UTC timestamp', () => {
    expect(formatUtc('2026-10-07T17:06:30.000Z')).toBe('2026-10-07 17:06 UTC');
  });

  it('adds how long ago a recent message arrived', () => {
    const now = new Date('2026-10-07T19:00:00Z');
    expect(formatMessageDate('2026-10-07T17:00:00Z', now)).toMatch(/\(2 hours ago\)$/);
    expect(formatMessageDate('2026-10-07T18:59:00Z', now)).toMatch(/\(1 minute ago\)$/);
    expect(formatMessageDate('2026-09-01T10:00:00Z', now)).not.toMatch(/ago/);
  });
});
