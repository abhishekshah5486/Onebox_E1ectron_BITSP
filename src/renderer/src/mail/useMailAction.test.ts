import { describe, expect, it } from 'vitest';
import { actionMessage } from './useMailAction';

describe('actionMessage', () => {
  it('words each action like Gmail', () => {
    expect(actionMessage({ action: 'archive' }, 1)).toBe('Conversation archived.');
    expect(actionMessage({ action: 'trash' }, 3)).toBe('3 conversations moved to Trash.');
    expect(actionMessage({ action: 'move', to: { role: 'spam' } }, 1)).toBe(
      'Conversation marked as spam.',
    );
    expect(
      actionMessage({ action: 'move', to: { role: 'inbox' }, from: { role: 'spam' } }, 1),
    ).toBe('Conversation marked as not spam.');
    expect(actionMessage({ action: 'move', to: { label: 'Work/Clients' } }, 2, 'Clients')).toBe(
      '2 conversations moved to "Clients".',
    );
    expect(actionMessage({ action: 'star' }, 1)).toBeNull();
  });
});
