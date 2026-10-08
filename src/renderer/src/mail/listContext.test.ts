import { describe, expect, it } from 'vitest';
import { positionIn, rememberList } from './listContext';

describe('list context', () => {
  it('places a conversation within the list it was opened from', () => {
    rememberList({ basePath: '/inbox', ids: ['a', 'b', 'c'], offset: 50, total: 120 });
    expect(positionIn('/inbox', 'b')).toEqual({
      position: 52,
      total: 120,
      newer: 'a',
      older: 'c',
    });
    expect(positionIn('/inbox', 'a')).toMatchObject({ newer: null });
    expect(positionIn('/sent', 'b')).toBeNull();
    expect(positionIn('/inbox', 'z')).toBeNull();
  });
});
