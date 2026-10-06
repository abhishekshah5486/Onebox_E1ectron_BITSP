import { vi } from 'vitest';
import type { ApiClient, User } from '../api/client';

export const testUser: User = {
  id: 'u1',
  email: 'abhishek@onebox.dev',
  name: 'Abhishek Shah',
  createdAt: '2026-10-07T00:00:00Z',
};

export function fakeApi(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    get: vi.fn(),
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
