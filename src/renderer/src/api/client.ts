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

export interface UploadOptions {
  headers?: Record<string, string>;
  // From 0 to 1 as the file goes up.
  onProgress?: (fraction: number) => void;
}

const NO_REFRESH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

export function createApiClient({
  baseUrl = '/api/v1',
  onSessionExpired,
  fetchImpl = (...args) => fetch(...args),
}: ApiClientOptions = {}) {
  // Access token lives only in memory; the refresh token is an HttpOnly cookie.
  let accessToken: string | null = null;
  let refreshing: Promise<Session | null> | null = null;
  // Bumped on sign-out, so a refresh that was already under way cannot sign the user back in.
  let generation = 0;

  async function send(
    method: Method,
    path: string,
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<Response> {
    return fetchImpl(`${baseUrl}${path}`, {
      method,
      ...(signal && { signal }),
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
      const started = generation;
      try {
        const session = await parse<Session>(await send('POST', '/auth/refresh'));
        if (started !== generation) return null;
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

  async function authorized(
    method: Method,
    path: string,
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<Response> {
    const response = await send(method, path, body, signal);
    if (response.status === 401 && !NO_REFRESH_PATHS.includes(path)) {
      if (await refreshSession()) return send(method, path, body, signal);
      onSessionExpired?.();
    }
    return response;
  }

  async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
    return parse<T>(await authorized(method, path, body));
  }

  // A file, e.g. an attachment; errors arrive as the usual JSON.
  async function blob(path: string): Promise<Blob> {
    const response = await authorized('GET', path);
    if (!response.ok) return parse<never>(response);
    return response.blob();
  }

  // A response read as it arrives, e.g. the live event stream; abort the signal to end it.
  async function stream(path: string, signal: AbortSignal): Promise<ReadableStream<Uint8Array>> {
    const response = await authorized('GET', path, undefined, signal);
    if (!response.ok || !response.body) return parse<never>(response);
    return response.body;
  }

  // A file as the request body, e.g. a compose attachment; its name and type go in headers.
  // XMLHttpRequest rather than fetch, because only it reports how much has gone up.
  function sendFile(
    path: string,
    file: File,
    { headers = {}, onProgress }: UploadOptions,
  ): Promise<Response> {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('POST', `${baseUrl}${path}`);
      request.withCredentials = true;
      const all: Record<string, string> = {
        'x-onebox-client': 'web',
        'content-type': 'application/octet-stream',
        'x-filename': encodeURIComponent(file.name),
        'x-content-type': file.type || 'application/octet-stream',
        ...headers,
        ...(accessToken && { authorization: `Bearer ${accessToken}` }),
      };
      for (const [name, value] of Object.entries(all)) request.setRequestHeader(name, value);
      request.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress?.(event.loaded / event.total);
      };
      request.onload = () =>
        resolve(
          new Response(request.status === 204 ? null : request.responseText, {
            status: request.status,
          }),
        );
      request.onerror = () => reject(new TypeError('Upload failed'));
      request.send(file);
    });
  }

  // A multipart form, e.g. several files with their fields; the browser sets its boundary.
  function sendForm(path: string, form: FormData, onProgress?: (fraction: number) => void) {
    return new Promise<Response>((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('POST', `${baseUrl}${path}`);
      request.withCredentials = true;
      request.setRequestHeader('x-onebox-client', 'web');
      if (accessToken) request.setRequestHeader('authorization', `Bearer ${accessToken}`);
      request.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress?.(event.loaded / event.total);
      };
      request.onload = () =>
        resolve(
          new Response(request.status === 204 ? null : request.responseText, {
            status: request.status,
          }),
        );
      request.onerror = () => reject(new TypeError('Upload failed'));
      request.send(form);
    });
  }

  async function uploadForm<T>(
    path: string,
    form: FormData,
    onProgress?: (fraction: number) => void,
  ): Promise<T> {
    let response = await sendForm(path, form, onProgress);
    if (response.status === 401 && (await refreshSession())) {
      response = await sendForm(path, form, onProgress);
    }
    return parse<T>(response);
  }

  async function upload<T>(path: string, file: File, options: UploadOptions = {}): Promise<T> {
    let response = await sendFile(path, file, options);
    if (response.status === 401 && (await refreshSession())) {
      response = await sendFile(path, file, options);
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
    blob,
    stream,
    upload,
    uploadForm,

    login: (email: string, password: string) => startSession('/auth/login', { email, password }),
    register: (input: { name: string; email: string; password: string }) =>
      startSession('/auth/register', input),
    restoreSession: async () => (await refreshSession())?.user ?? null,
    async logout() {
      generation++;
      try {
        await request<void>('POST', '/auth/logout');
      } finally {
        accessToken = null;
      }
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
