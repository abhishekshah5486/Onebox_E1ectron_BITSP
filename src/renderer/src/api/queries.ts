import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { accountsApi, type CreateAccountInput, type UpdateAccountInput } from './accounts';
import { ApiError } from './client';
import {
  settingsApi,
  type CreateIntegrationInput,
  type Preferences,
  type UpdateIntegrationInput,
} from './settings';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Client errors will not fix themselves; only retry server and network failures.
        retry: (failures, error) =>
          !(error instanceof ApiError && error.status < 500) && failures < 2,
      },
    },
  });
}

export const keys = {
  accounts: ['accounts'] as const,
  preferences: ['preferences'] as const,
  integrations: ['integrations'] as const,
};

function useApi() {
  return useAuth().api;
}

export function useAccounts() {
  const api = useApi();
  return useQuery({ queryKey: keys.accounts, queryFn: () => accountsApi.list(api) });
}

function useAccountMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.accounts }),
  });
}

export function useCreateAccount() {
  const api = useApi();
  return useAccountMutation((input: CreateAccountInput) => accountsApi.create(api, input));
}

export function useUpdateAccount() {
  const api = useApi();
  return useAccountMutation(({ id, ...input }: UpdateAccountInput & { id: string }) =>
    accountsApi.update(api, id, input),
  );
}

export function useTestAccount() {
  const api = useApi();
  return useAccountMutation((id: string) => accountsApi.test(api, id));
}

export function useRemoveAccount() {
  const api = useApi();
  return useAccountMutation((id: string) => accountsApi.remove(api, id));
}

export function usePreferences() {
  const api = useApi();
  return useQuery({ queryKey: keys.preferences, queryFn: () => settingsApi.getPreferences(api) });
}

export function useUpdatePreferences() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: Partial<Omit<Preferences, 'updatedAt'>>) =>
      settingsApi.updatePreferences(api, changes),
    onSuccess: (preferences) => queryClient.setQueryData(keys.preferences, preferences),
  });
}

export function useIntegrations() {
  const api = useApi();
  return useQuery({
    queryKey: keys.integrations,
    queryFn: () => settingsApi.listIntegrations(api),
  });
}

function useIntegrationMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.integrations }),
  });
}

export function useCreateIntegration() {
  const api = useApi();
  return useIntegrationMutation((input: CreateIntegrationInput) =>
    settingsApi.createIntegration(api, input),
  );
}

export function useUpdateIntegration() {
  const api = useApi();
  return useIntegrationMutation(({ id, ...input }: UpdateIntegrationInput & { id: string }) =>
    settingsApi.updateIntegration(api, id, input),
  );
}

export function useTestIntegration() {
  const api = useApi();
  return useIntegrationMutation((id: string) => settingsApi.testIntegration(api, id));
}

export function useRotateSecret() {
  const api = useApi();
  return useIntegrationMutation((id: string) => settingsApi.rotateSecret(api, id));
}

export function useRemoveIntegration() {
  const api = useApi();
  return useIntegrationMutation((id: string) => settingsApi.removeIntegration(api, id));
}
