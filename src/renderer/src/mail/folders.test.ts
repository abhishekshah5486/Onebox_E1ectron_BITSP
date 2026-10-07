import { describe, expect, it } from 'vitest';
import { folderBadge, isFolderRole } from './folders';

describe('folders', () => {
  it('recognises folder roles from the url', () => {
    expect(isFolderRole('spam')).toBe(true);
    expect(isFolderRole('starred')).toBe(false);
    expect(isFolderRole(undefined)).toBe(false);
  });

  it('badges drafts by count and mail folders by unread, but not sent or trash', () => {
    const counts = { total: 9, unread: 4 };
    expect(folderBadge('drafts', counts)).toBe(9);
    expect(folderBadge('inbox', counts)).toBe(4);
    expect(folderBadge('spam', counts)).toBe(4);
    expect(folderBadge('sent', counts)).toBe(0);
    expect(folderBadge('trash', counts)).toBe(0);
  });
});
