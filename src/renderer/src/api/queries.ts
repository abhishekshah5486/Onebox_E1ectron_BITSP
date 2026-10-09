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
  googleDrive: ['google-drive'] as const,
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
    // Applied at once so quick successive toggles build on each other; undone if saving fails.
    onMutate: async (changes) => {
      await queryClient.cancelQueries({ queryKey: keys.preferences });
      const previous = queryClient.getQueryData<Preferences>(keys.preferences);
      if (previous) queryClient.setQueryData(keys.preferences, { ...previous, ...changes });
      return { previous };
    },
    onError: (_error, _changes, context) => {
      if (context?.previous) queryClient.setQueryData(keys.preferences, context.previous);
    },
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

// Polls while the Google sign-in window is open, until the account shows up.
export function useGoogleDrive(waiting = false) {
  const api = useApi();
  return useQuery({
    queryKey: keys.googleDrive,
    queryFn: () => settingsApi.googleDrive(api),
    refetchInterval: waiting ? 2000 : false,
  });
}

export function useConnectGoogleDrive() {
  const api = useApi();
  return useMutation({ mutationFn: () => settingsApi.connectGoogleDrive(api) });
}

export function useUpdateDriveAccount() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, defaultPath }: { id: string; defaultPath: string }) =>
      settingsApi.updateDriveAccount(api, id, defaultPath),
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.googleDrive }),
  });
}

export function useDisconnectGoogleDrive() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => settingsApi.disconnectGoogleDrive(api, id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.googleDrive }),
  });
}
