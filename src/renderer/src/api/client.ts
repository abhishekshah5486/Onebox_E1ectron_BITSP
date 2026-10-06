export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface Session {
  user: User;
  tokens: { tokenType: 'Bearer'; accessToken: string; expiresIn: number };
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiClientOptions {
  baseUrl?: string;
  onSessionExpired?: () => void;
  fetchImpl?: typeof fetch;
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

const NO_REFRESH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

export function createApiClient({
  baseUrl = '/api/v1',
  onSessionExpired,
  fetchImpl = (...args) => fetch(...args),
}: ApiClientOptions = {}) {
  // Access token lives only in memory; the refresh token is an HttpOnly cookie.
  let accessToken: string | null = null;
  let refreshing: Promise<Session | null> | null = null;

  async function send(method: Method, path: string, body?: unknown): Promise<Response> {
    return fetchImpl(`${baseUrl}${path}`, {
      method,
      credentials: 'same-origin',
      headers: {
        'x-onebox-client': 'web',
        ...(body !== undefined && { 'content-type': 'application/json' }),
        ...(accessToken && { authorization: `Bearer ${accessToken}` }),
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
  }

  async function parse<T>(response: Response): Promise<T> {
    if (response.status === 204) return undefined as T;
    const payload = (await response.json().catch(() => null)) as {
      error?: { code?: string; message?: string; details?: unknown };
    } | null;
    if (!response.ok) {
      const error = payload?.error;
      throw new ApiError(
        response.status,
        error?.code ?? 'UNKNOWN_ERROR',
        error?.message ?? `Request failed with status ${response.status}`,
        error?.details,
      );
    }
    return payload as T;
  }

  function refreshSession(): Promise<Session | null> {
    refreshing ??= (async () => {
      try {
        const session = await parse<Session>(await send('POST', '/auth/refresh'));
        accessToken = session.tokens.accessToken;
        return session;
      } catch {
        accessToken = null;
        return null;
      } finally {
        refreshing = null;
      }
    })();
    return refreshing;
  }

  async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
    let response = await send(method, path, body);
    if (response.status === 401 && !NO_REFRESH_PATHS.includes(path)) {
      if (await refreshSession()) {
        response = await send(method, path, body);
      } else {
        onSessionExpired?.();
      }
    }
    return parse<T>(response);
  }

  async function startSession(path: string, body: unknown): Promise<User> {
    const session = await request<Session>('POST', path, body);
    accessToken = session.tokens.accessToken;
    return session.user;
  }

  return {
    get: <T>(path: string) => request<T>('GET', path),
    post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
    patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
    put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
    delete: <T>(path: string) => request<T>('DELETE', path),

    login: (email: string, password: string) => startSession('/auth/login', { email, password }),
    register: (input: { name: string; email: string; password: string }) =>
      startSession('/auth/register', input),
    restoreSession: async () => (await refreshSession())?.user ?? null,
    async logout() {
      try {
        await request<void>('POST', '/auth/logout');
      } finally {
        accessToken = null;
      }
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
