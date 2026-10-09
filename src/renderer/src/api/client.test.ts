import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient, type Session } from './client';

const session = (token: string): Session => ({
  user: { id: 'u1', email: 'a@onebox.dev', name: 'A', createdAt: '2026-10-07T00:00:00Z' },
  tokens: { tokenType: 'Bearer', accessToken: token, expiresIn: 900 },
});

const json = (status: number, body: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const fetchImpl = vi.fn<typeof fetch>();
const authOf = (init?: RequestInit) =>
  (init?.headers as Record<string, string> | undefined)?.authorization;

const requests = () =>
  fetchImpl.mock.calls.map(([url, init]) => ({
    url: url as string,
    method: init?.method,
    auth: authOf(init),
  }));

beforeEach(() => fetchImpl.mockReset());

describe('api client', () => {
  it('logs in, then sends the access token as a web client', async () => {
    fetchImpl.mockResolvedValueOnce(json(200, session('t1'))).mockResolvedValueOnce(json(200, []));
    const api = createApiClient({ fetchImpl });

    const user = await api.login('a@onebox.dev', 'pw');
    await api.get('/accounts');

    expect(user.email).toBe('a@onebox.dev');
    const [, init] = fetchImpl.mock.calls[1]!;
    expect(init).toMatchObject({ credentials: 'same-origin' });
    expect(init?.headers).toMatchObject({ authorization: 'Bearer t1', 'x-onebox-client': 'web' });
  });

  it('refreshes once on 401 and retries with the new token', async () => {
    fetchImpl
      .mockResolvedValueOnce(json(200, session('old')))
      .mockResolvedValueOnce(json(401, { error: { code: 'TOKEN_EXPIRED' } }))
      .mockResolvedValueOnce(json(200, session('new')))
      .mockResolvedValueOnce(json(200, { ok: true }));
    const api = createApiClient({ fetchImpl });
    await api.login('a@onebox.dev', 'pw');

    await expect(api.get('/accounts')).resolves.toEqual({ ok: true });
    expect(requests().slice(1)).toEqual([
      { url: '/api/v1/accounts', method: 'GET', auth: 'Bearer old' },
      { url: '/api/v1/auth/refresh', method: 'POST', auth: 'Bearer old' },
      { url: '/api/v1/accounts', method: 'GET', auth: 'Bearer new' },
    ]);
  });

  it('shares one refresh between parallel 401s', async () => {
    fetchImpl.mockImplementation(async (url, init) => {
      if (typeof url === 'string' && url.endsWith('/auth/refresh'))
        return json(200, session('new'));
      return authOf(init) === 'Bearer new' ? json(200, {}) : json(401, {});
    });
    const api = createApiClient({ fetchImpl });

    await Promise.all([api.get('/a'), api.get('/b'), api.get('/c')]);
    expect(requests().filter((r) => r.url.endsWith('/auth/refresh'))).toHaveLength(1);
  });

  it('reports an expired session when refresh fails', async () => {
    const onSessionExpired = vi.fn();
    fetchImpl
      .mockResolvedValueOnce(json(401, {}))
      .mockResolvedValueOnce(json(401, { error: { code: 'INVALID_REFRESH_TOKEN' } }))
      .mockResolvedValueOnce(json(401, {}));
    const api = createApiClient({ fetchImpl, onSessionExpired });

    await expect(api.get('/accounts')).rejects.toBeInstanceOf(ApiError);
    expect(onSessionExpired).toHaveBeenCalledOnce();
  });

  it('surfaces api error codes and messages', async () => {
    fetchImpl.mockResolvedValueOnce(
      json(401, { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } }),
    );
    const api = createApiClient({ fetchImpl });

    await expect(api.login('a@onebox.dev', 'bad')).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password',
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('restores a session from the refresh cookie', async () => {
    fetchImpl.mockResolvedValueOnce(json(200, session('t')));
    await expect(createApiClient({ fetchImpl }).restoreSession()).resolves.toMatchObject({
      email: 'a@onebox.dev',
    });
  });

  it('returns null when there is no session to restore', async () => {
    fetchImpl.mockResolvedValueOnce(json(401, { error: { code: 'MISSING_REFRESH_TOKEN' } }));
    await expect(createApiClient({ fetchImpl }).restoreSession()).resolves.toBeNull();
  });

  it('forgets the access token on logout', async () => {
    fetchImpl
      .mockResolvedValueOnce(json(200, session('t1')))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(json(200, {}));
    const api = createApiClient({ fetchImpl });
    await api.login('a@onebox.dev', 'pw');
    await api.logout();
    await api.get('/public');

    expect(requests()[2]?.auth).toBeUndefined();
  });

  it('ignores a refresh that finishes after sign-out', async () => {
    let finishRefresh: ((response: Response) => void) | undefined;
    fetchImpl.mockImplementation(async (url) => {
      const path = (url as string | undefined) ?? '';
      if (path.endsWith('/auth/login')) return json(200, session('t1'));
      // The first refresh hangs until the test lets it finish; later ones find no session.
      if (path.endsWith('/auth/refresh')) {
        if (finishRefresh) return json(401, { error: { code: 'MISSING_REFRESH_TOKEN' } });
        return new Promise<Response>((resolve) => (finishRefresh = resolve));
      }
      if (path.endsWith('/auth/logout')) return new Response(null, { status: 204 });
      return json(401, { error: { code: 'TOKEN_EXPIRED' } });
    });
    const api = createApiClient({ fetchImpl });
    await api.login('a@onebox.dev', 'pw');

    const pending = api.get('/accounts').catch(() => null);
    await vi.waitFor(() => expect(finishRefresh).toBeDefined());
    await api.logout();
    finishRefresh!(json(200, session('late')));
    await pending;
    await api.get('/public').catch(() => null);

    expect(requests().some((r) => r.auth === 'Bearer late')).toBe(false);
  });
});
