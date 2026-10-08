import { describe, expect, it } from 'vitest';
import type { FolderCounts } from '../api/mail';
import { folderActions, moveRequest, moveTargets } from './actions';

const counts = (role: FolderCounts['role'], path: string, name: string): FolderCounts => ({
  role,
  path,
  name,
  total: 0,
  unread: 0,
  updatedAt: '',
});

describe('folder actions', () => {
  it('offers archive, spam and delete in the inbox', () => {
    expect(folderActions({ role: 'inbox' }).map((a) => a.label)).toEqual([
      'Archive',
      'Report spam',
      'Delete',
    ]);
  });

  it('offers rescue and permanent deletion in spam and trash', () => {
    expect(folderActions({ role: 'spam' }).map((a) => a.label)).toEqual([
      'Not spam',
      'Delete forever',
    ]);
    expect(folderActions({ role: 'trash' })[0]!.request).toEqual({
      action: 'move',
      to: { role: 'inbox' },
      from: { role: 'trash' },
    });
  });

  it('moves out of a label from that label', () => {
    expect(folderActions({ label: 'Work' })[0]!.request).toMatchObject({ from: { label: 'Work' } });
    expect(folderActions(null).map((a) => a.id)).toEqual(['archive', 'trash']);
  });
});

describe('move targets', () => {
  const folders = [
    counts('inbox', 'INBOX', 'INBOX'),
    counts('archive', '[Gmail]/All Mail', 'All Mail'),
    counts('label', 'Receipts', 'Receipts'),
  ];

  it('lists folders by their server names, then labels, without the current view', () => {
    expect(moveTargets({ role: 'inbox' }, folders).map((t) => t.label)).toEqual([
      'All Mail',
      'Spam',
      'Trash',
      'Receipts',
    ]);
    expect(moveTargets({ label: 'Receipts' }, folders).map((t) => t.label)).toContain('Inbox');
  });

  it('builds a move from the current view', () => {
    expect(moveRequest({ role: 'archive' }, { label: 'Receipts' })).toEqual({
      action: 'move',
      to: { label: 'Receipts' },
      from: { role: 'archive' },
    });
  });
});
