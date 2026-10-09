import type { Account } from '../api/accounts';
import type { Integration } from '../api/settings';

export const account = (overrides: Partial<Account> = {}): Account => ({
  id: 'a1',
  provider: 'GMAIL',
  emailAddress: 'me@gmail.com',
  displayName: null,
  username: 'me@gmail.com',
  imap: { host: 'imap.gmail.com', port: 993, tls: true },
  smtp: { host: 'smtp.gmail.com', port: 465, tls: true },
  status: 'CONNECTED',
  lastError: null,
  lastVerifiedAt: '2026-10-07T10:00:00Z',
  createdAt: '2026-10-07T10:00:00Z',
  updatedAt: '2026-10-07T10:00:00Z',
  ...overrides,
});

export const integration = (overrides: Partial<Integration> = {}): Integration => ({
  id: 'i1',
  type: 'SLACK',
  name: 'Sales alerts',
  target: 'hooks.slack.com/services/T1/…/…abcd',
  events: ['email.interested'],
  enabled: true,
  lastTestedAt: null,
  lastTestOk: null,
  lastError: null,
  createdAt: '2026-10-07T10:00:00Z',
  updatedAt: '2026-10-07T10:00:00Z',
  ...overrides,
});
