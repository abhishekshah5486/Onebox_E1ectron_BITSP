import { describe, expect, it } from 'vitest';
import { folderBadge, folderName, isFolderRole, labelPath, viewFromPath, viewKey } from './folders';

describe('folders', () => {
  it('recognises folder roles from the url', () => {
    expect(isFolderRole('spam')).toBe(true);
    expect(isFolderRole('archive')).toBe(true);
    expect(isFolderRole('starred')).toBe(false);
    expect(isFolderRole(undefined)).toBe(false);
  });

  it('badges drafts by count and mail folders by unread, but not sent, trash or archive', () => {
    const counts = { total: 9, unread: 4 };
    expect(folderBadge('drafts', counts)).toBe(9);
    expect(folderBadge('inbox', counts)).toBe(4);
    expect(folderBadge('spam', counts)).toBe(4);
    expect(folderBadge('sent', counts)).toBe(0);
    expect(folderBadge('trash', counts)).toBe(0);
    expect(folderBadge('archive', counts)).toBe(0);
  });

  it("names gmail's archive after the server folder", () => {
    expect(folderName('archive', 'All Mail')).toBe('All Mail');
    expect(folderName('archive')).toBe('Archive');
    expect(folderName('spam', 'Junk')).toBe('Spam');
  });

  it('keys and links labels by their path', () => {
    expect(viewKey({ role: 'inbox' })).toBe('inbox');
    expect(viewKey({ label: 'Work/Clients' })).toBe('label:Work/Clients');
    expect(labelPath('a1', 'Work/Clients')).toBe('/accounts/a1/labels/Work%2FClients');
  });
});

describe('viewFromPath', () => {
  it('reads folders, labels and starred from list paths', () => {
    expect(viewFromPath('/inbox')).toEqual({ role: 'inbox' });
    expect(viewFromPath('/starred')).toBeNull();
    expect(viewFromPath('/accounts/a1/archive')).toEqual({ role: 'archive' });
    expect(viewFromPath('/accounts/a1/labels/Work%2FClients')).toEqual({ label: 'Work/Clients' });
  });
});
