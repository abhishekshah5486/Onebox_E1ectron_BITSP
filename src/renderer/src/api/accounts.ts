import type { ApiClient } from './client';

export type Provider = 'GMAIL' | 'OUTLOOK' | 'IMAP';
export type AccountStatus = 'CONNECTED' | 'AUTH_FAILED' | 'UNREACHABLE' | 'TLS_ERROR' | 'DISABLED';

export interface ServerSettings {
  host: string;
  port: number;
  tls: boolean;
}

export interface Account {
  id: string;
  provider: Provider;
  emailAddress: string;
  displayName: string | null;
  username: string;
  imap: ServerSettings;
  smtp: ServerSettings | null;
  status: AccountStatus;
  lastError: string | null;
  lastVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CreateAccountInput =
  | { provider: 'GMAIL' | 'OUTLOOK'; emailAddress: string; displayName?: string; password: string }
  | {
      provider: 'IMAP';
      emailAddress: string;
      displayName?: string;
      username?: string;
      password: string;
      imap: ServerSettings;
    };

export interface UpdateAccountInput {
  displayName?: string | null;
  password?: string;
  enabled?: boolean;
}

export interface AccountTestResult {
  ok: boolean;
  reason?: string;
  message?: string;
  account: Account;
}

export const accountsApi = {
  list: async (api: ApiClient) => (await api.get<{ items: Account[] }>('/accounts')).items,
  create: (api: ApiClient, input: CreateAccountInput) => api.post<Account>('/accounts', input),
  update: (api: ApiClient, id: string, input: UpdateAccountInput) =>
    api.patch<Account>(`/accounts/${id}`, input),
  test: (api: ApiClient, id: string) => api.post<AccountTestResult>(`/accounts/${id}/test`),
  remove: (api: ApiClient, id: string) => api.delete<void>(`/accounts/${id}`),
};
