import type { ApiClient } from './client';

export type AutonomyMode = 'MANUAL' | 'SUGGEST' | 'SEMI' | 'AUTO';
export type IntegrationType = 'SLACK' | 'WEBHOOK';
export type IntegrationEvent =
  'email.received' | 'email.classified' | 'email.interested' | 'account.degraded';

export const INTEGRATION_EVENTS: { value: IntegrationEvent; label: string }[] = [
  { value: 'email.interested', label: 'Interested lead' },
  { value: 'email.classified', label: 'Email classified' },
  { value: 'email.received', label: 'Email received' },
  { value: 'account.degraded', label: 'Mailbox connection problem' },
];

export interface Preferences {
  markSeenOnFetch: boolean;
  autonomyMode: AutonomyMode;
  signature: string | null;
  timezone: string;
  // View keys hidden from the sidebar: "sent", "category:travel", "label:<accountId>:<path>".
  sidebarHidden: string[];
  // Labels ("label:<accountId>:<path>") whose chips are hidden in the message list.
  chipsHidden: string[];
  // Gmail inbox tabs shown besides Primary.
  inboxTabs: string[];
  updatedAt: string | null;
}

export interface Integration {
  id: string;
  type: IntegrationType;
  name: string;
  target: string;
  events: IntegrationEvent[];
  enabled: boolean;
  lastTestedAt: string | null;
  lastTestOk: boolean | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export type IntegrationWithSecret = Integration & { secret?: string };

export type CreateIntegrationInput =
  | { type: 'SLACK'; name: string; webhookUrl: string; events: IntegrationEvent[] }
  | { type: 'WEBHOOK'; name: string; url: string; events: IntegrationEvent[] };

export interface UpdateIntegrationInput {
  name?: string;
  enabled?: boolean;
  events?: IntegrationEvent[];
  url?: string;
}

export interface IntegrationTestResult {
  ok: boolean;
  status?: number;
  error?: string;
  integration: Integration;
}

export interface DriveAccount {
  id: string;
  email: string;
  // Folder path under My Drive, e.g. "OneBox/Receipts"; empty means the top level.
  defaultPath: string;
  connectedAt: string;
  updatedAt: string;
}

export interface GoogleDriveStatus {
  configured: boolean;
  accounts: DriveAccount[];
}

export const settingsApi = {
  googleDrive: (api: ApiClient) => api.get<GoogleDriveStatus>('/settings/integrations/google'),
  connectGoogleDrive: (api: ApiClient) =>
    api.post<{ url: string }>('/settings/integrations/google/connect'),
  updateDriveAccount: (api: ApiClient, id: string, defaultPath: string) =>
    api.patch<DriveAccount>(`/settings/integrations/google/${id}`, { defaultPath }),
  disconnectGoogleDrive: (api: ApiClient, id: string) =>
    api.delete<void>(`/settings/integrations/google/${id}`),
  getPreferences: (api: ApiClient) => api.get<Preferences>('/settings/preferences'),
  updatePreferences: (api: ApiClient, changes: Partial<Omit<Preferences, 'updatedAt'>>) =>
    api.patch<Preferences>('/settings/preferences', changes),
  listIntegrations: async (api: ApiClient) =>
    (await api.get<{ items: Integration[] }>('/settings/integrations')).items,
  createIntegration: (api: ApiClient, input: CreateIntegrationInput) =>
    api.post<IntegrationWithSecret>('/settings/integrations', input),
  updateIntegration: (api: ApiClient, id: string, input: UpdateIntegrationInput) =>
    api.patch<Integration>(`/settings/integrations/${id}`, input),
  testIntegration: (api: ApiClient, id: string) =>
    api.post<IntegrationTestResult>(`/settings/integrations/${id}/test`),
  rotateSecret: (api: ApiClient, id: string) =>
    api.post<IntegrationWithSecret>(`/settings/integrations/${id}/rotate-secret`),
  removeIntegration: (api: ApiClient, id: string) =>
    api.delete<void>(`/settings/integrations/${id}`),
};
