import { vi } from 'vitest';
import type { ApiClient, User } from '../api/client';
import { sampleBilling } from './billing-fixture';

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
  sidebarHidden: ['category:social', 'category:updates', 'category:forums', 'category:promotions'],
  chipsHidden: [],
  inboxTabs: ['promotions', 'social', 'updates', 'forums'],
  updatedAt: null,
};

// Empty but well-formed responses for every list/read endpoint the UI calls.
const defaultGet = async (path: string): Promise<unknown> => {
  if (path === '/accounts' || path === '/settings/integrations') return { items: [] };
  if (path === '/settings/preferences') return defaultPreferences;
  if (path === '/billing') return sampleBilling();
  if (path === '/mail/drafts' || path === '/mail/outbox') return { items: [] };
  if (path.startsWith('/mail/contacts')) return { items: [] };
  if (path === '/payments/config') return { providers: ['RAZORPAY'] };
  if (path === '/payments/subscription') return { subscription: null };
  if (path === '/payments/history') return { items: [] };
  if (path === '/settings/storage')
    return { providers: ['GOOGLE_DRIVE'], accounts: [], failures: [] };
  if (path.startsWith('/mail/threads?') || /^\/mail\/accounts\/[^/]+\/threads/.test(path)) {
    return { items: [], page: 1, pageSize: 50, total: 0 };
  }
  if (path === '/ai/suggestions/count') return { count: 0 };
  if (path.startsWith('/ai/suggestions')) return { items: [], total: 0, page: 1, pageSize: 50 };
  if (path === '/ai/labels') return { items: [] };
  if (path === '/llm/models') return { items: [], purposes: [], choices: {} };
  if (path === '/llm/embeddings')
    return { items: [], chosen: 'ollama/bge-m3', default: 'ollama/bge-m3' };
  if (path === '/search/semantic') {
    return {
      active: { id: 'ollama/bge-m3', name: 'bge-m3', dimensions: 1024, local: true },
      rebuild: null,
    };
  }
  if (path === '/mail/stats') return { unreadThreads: 0, starredThreads: 0, totalThreads: 0 };
  if (path.startsWith('/search?')) return { mode: 'keyword', items: [], total: 0, nextPage: null };
  throw new Error(`fakeApi: unexpected GET ${path}`);
};

// Routes GET calls by path prefix; anything unmatched falls back to the empty defaults.
export function routedGet(routes: Record<string, (path: string) => unknown>): ApiClient['get'] {
  return vi.fn(async (path: string) => {
    const match = Object.keys(routes)
      .sort((a, b) => b.length - a.length)
      .find((prefix) => path.startsWith(prefix));
    return match ? routes[match]!(path) : defaultGet(path);
  }) as ApiClient['get'];
}

// A live event stream that stays quiet until the app closes it.
export const quietStream = (_path: string, signal: AbortSignal) =>
  Promise.resolve(
    new ReadableStream<Uint8Array>({
      start(controller) {
        signal.addEventListener('abort', () => controller.close());
      },
    }),
  );

export function fakeApi(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    get: vi.fn(defaultGet) as ApiClient['get'],
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    blob: vi.fn(async () => new Blob()),
    stream: vi.fn(quietStream),
    upload: vi.fn(),
    login: vi.fn(async () => testUser),
    register: vi.fn(async () => testUser),
    restoreSession: vi.fn(async () => null),
    logout: vi.fn(async () => {}),
    ...overrides,
  };
}
