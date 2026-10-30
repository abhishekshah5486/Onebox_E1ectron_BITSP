import { describe, expect, it } from 'vitest';
import { buildQuery, EMPTY_SEARCH } from './searchQuery';

describe('buildQuery', () => {
  it('is empty when nothing is filled in', () => {
    expect(buildQuery(EMPTY_SEARCH)).toBe('');
  });

  it('turns each field into the matching Gmail operator', () => {
    expect(
      buildQuery({
        ...EMPTY_SEARCH,
        from: 'alice@x.com',
        to: 'Bob Smith',
        subject: 'quarterly report',
        hasWords: 'invoice "march 2026"',
        doesntHave: 'draft  spam',
        hasAttachment: true,
      }),
    ).toBe(
      'from:alice@x.com to:"Bob Smith" subject:"quarterly report" invoice "march 2026" -draft -spam has:attachment',
    );
  });

  it('adds a size with its unit, ignoring nonsense', () => {
    expect(buildQuery({ ...EMPTY_SEARCH, size: '5', sizeUnit: 'MB' })).toBe('larger:5M');
    expect(buildQuery({ ...EMPTY_SEARCH, sizeOp: 'smaller', size: '200', sizeUnit: 'KB' })).toBe(
      'smaller:200K',
    );
    expect(buildQuery({ ...EMPTY_SEARCH, size: '900', sizeUnit: 'bytes' })).toBe('larger:900');
    expect(buildQuery({ ...EMPTY_SEARCH, size: 'big' })).toBe('');
  });

  it('spans the chosen window on both sides of a date', () => {
    expect(buildQuery({ ...EMPTY_SEARCH, date: '2026-10-15', within: '1d' })).toBe(
      'after:2026/10/14 before:2026/10/17',
    );
    expect(buildQuery({ ...EMPTY_SEARCH, date: '2026-10-15', within: '1m' })).toBe(
      'after:2026/09/15 before:2026/11/16',
    );
  });

  it('searches in a folder or by state', () => {
    expect(buildQuery({ ...EMPTY_SEARCH, searchIn: 'sent' })).toBe('in:sent');
    expect(buildQuery({ ...EMPTY_SEARCH, searchIn: 'anywhere' })).toBe('in:anywhere');
    expect(buildQuery({ ...EMPTY_SEARCH, searchIn: 'starred' })).toBe('is:starred');
    expect(buildQuery({ ...EMPTY_SEARCH, searchIn: 'unread' })).toBe('is:unread');
  });
});
