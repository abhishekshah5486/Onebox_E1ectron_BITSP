import { vi } from 'vitest';
import type { ApiClient, User } from '../api/client';

export const testUser: User = {
  id: 'u1',
  email: 'abhishek@onebox.dev',
  name: 'Abhishek Shah',
  createdAt: '2026-10-07T00:00:00Z',
};

export const defaultPreferences = {
  markSeenOnFetch: true,
  autonomyMode: 'MANUAL',
  signature: null,
  timezone: 'UTC',
  updatedAt: null,
};

// Empty but well-formed responses for every list/read endpoint the UI calls.
const defaultGet = async (path: string): Promise<unknown> => {
  if (path === '/accounts' || path === '/settings/integrations') return { items: [] };
  if (path === '/settings/preferences') return defaultPreferences;
  throw new Error(`fakeApi: unexpected GET ${path}`);
};

export function fakeApi(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    get: vi.fn(defaultGet) as ApiClient['get'],
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    login: vi.fn(async () => testUser),
    register: vi.fn(async () => testUser),
    restoreSession: vi.fn(async () => null),
    logout: vi.fn(async () => {}),
    ...overrides,
  };
}
