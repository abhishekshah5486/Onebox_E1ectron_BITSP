import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import type { ApiClient } from './client';

export type ModelKind = 'llm' | 'embedding';

// One credential or setting a provider's form asks for, as the server describes it.
export interface ProviderField {
  key: string;
  label: string;
  secret: boolean;
  required: boolean;
  multiline: boolean;
  default?: string;
}

export interface CatalogModel {
  id: string;
  name: string;
  contextTokens: number | null;
  outputTokens: number | null;
  reasoning: boolean;
  multimodal: boolean;
  toolCalls: boolean;
  deprecated: boolean;
  embedding: boolean;
  usdPerMillion: { input: number; output: number } | null;
}

// A provider card: which service, its logo and how many models it offers.
export interface ProviderCard {
  id: string;
  name: string;
  npm: string;
  logoUrl: string | null;
  docsUrl: string | null;
  fields: ProviderField[];
  modelCount: number;
  embeddings: boolean;
}

export interface ProviderDetail extends Omit<ProviderCard, 'modelCount' | 'embeddings'> {
  models: CatalogModel[];
}

// A model the user added with their own key. The key itself never comes back.
export interface UserModel {
  id: string;
  kind: ModelKind;
  providerId: string;
  providerName: string;
  logoUrl: string | null;
  modelId: string;
  name: string;
  keyHint: string | null;
  contextTokens: number | null;
  reasoning: boolean;
  multimodal: boolean;
  dimensions: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserModelInput {
  kind: ModelKind;
  providerId: string;
  modelId: string;
  name?: string;
  settings: Record<string, string>;
  contextTokens?: number;
  reasoning?: boolean;
  multimodal?: boolean;
}

export type UserModelChanges = Partial<Omit<UserModelInput, 'kind' | 'providerId'>>;

// Where semantic search keeps the user's vectors: OneBox's own, or their Qdrant.
// One of the stores a user keeps vectors in: OneBox's own, or a database of theirs.
export interface IndexingStore {
  id: string;
  name: string;
  provider: string;
  paused: boolean;
  // Searches go to this one.
  search: boolean;
  settings?: Record<string, string>;
  keyHint?: string | null;
  updatedAt?: string;
}
export interface IndexingStores {
  searchStoreId: string;
  stores: IndexingStore[];
}
export const ONEBOX_STORE = 'onebox';

// A vector database search can keep vectors in, and the fields its form asks for.
export interface VectorStoreField {
  key: string;
  label: string;
  secret: boolean;
  required: boolean;
  address: boolean;
  placeholder?: string;
  default?: string;
}
export interface VectorStoreInfo {
  id: string;
  name: string;
  description: string;
  docsUrl: string;
  icon: string | null;
  fields: VectorStoreField[];
}

// Models the user picks as "user:<id>" wherever a hosted model could go.
export const OWN_PREFIX = 'user:';

export const providersApi = {
  list: (api: ApiClient) => api.get<{ items: ProviderCard[] }>('/llm/providers'),
  get: (api: ApiClient, id: string) =>
    api.get<ProviderDetail>(`/llm/providers/${encodeURIComponent(id)}`),
  discover: (api: ApiClient, id: string, settings: Record<string, string>) =>
    api.post<{ items: string[] }>(`/llm/providers/${encodeURIComponent(id)}/models`, {
      settings,
    }),
  userModels: (api: ApiClient) => api.get<{ items: UserModel[] }>('/llm/user-models'),
  add: (api: ApiClient, input: UserModelInput) => api.post<UserModel>('/llm/user-models', input),
  update: (api: ApiClient, id: string, changes: UserModelChanges) =>
    api.patch<UserModel>(`/llm/user-models/${id}`, changes),
  remove: (api: ApiClient, id: string) => api.delete<void>(`/llm/user-models/${id}`),
  indexing: (api: ApiClient) => api.get<IndexingStores>('/settings/indexing-storage'),
  vectorStores: (api: ApiClient) =>
    api.get<{ stores: VectorStoreInfo[] }>('/settings/indexing-storage/stores'),
  addStore: (
    api: ApiClient,
    body: { provider: string; name?: string; settings: Record<string, string> },
  ) => api.post<IndexingStore>('/settings/indexing-storage', body),
  updateStore: (
    api: ApiClient,
    id: string,
    body: { name?: string; settings?: Record<string, string>; paused?: boolean },
  ) => api.patch<IndexingStores>(`/settings/indexing-storage/${id}`, body),
  searchWith: (api: ApiClient, storeId: string) =>
    api.put<IndexingStores>('/settings/indexing-storage/search', { storeId }),
  removeStore: (api: ApiClient, id: string) => api.delete<void>(`/settings/indexing-storage/${id}`),
};

const keys = {
  providers: ['llm', 'providers'] as const,
  provider: (id: string) => ['llm', 'providers', id] as const,
  userModels: ['llm', 'user-models'] as const,
  indexing: ['settings', 'indexing-storage'] as const,
  vectorStores: ['settings', 'indexing-storage', 'stores'] as const,
};

// The provider list changes only with the catalogue or a release, so it's fetched again at most
// every few minutes, and each time the section opens after that.
export function useProviders() {
  const { api } = useAuth();
  return useQuery({
    queryKey: keys.providers,
    queryFn: () => providersApi.list(api),
    staleTime: 5 * 60_000,
  });
}

export function useProvider(id: string | null) {
  const { api } = useAuth();
  return useQuery({
    queryKey: keys.provider(id ?? ''),
    queryFn: () => providersApi.get(api, id!),
    enabled: id !== null,
    staleTime: Infinity,
  });
}

// The models a provider offers with the credentials typed so far; asked for on demand.
export function useDiscoverModels() {
  const { api } = useAuth();
  return useMutation({
    mutationFn: ({ id, settings }: { id: string; settings: Record<string, string> }) =>
      providersApi.discover(api, id, settings),
  });
}

export function useUserModels() {
  const { api } = useAuth();
  return useQuery({
    queryKey: keys.userModels,
    queryFn: () => providersApi.userModels(api),
    placeholderData: keepPreviousData,
  });
}

// Own models show up in the model and embedding pickers too, so those are refreshed.
function useModelMutation<T, R>(mutationFn: (input: T) => Promise<R>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.userModels }),
        queryClient.invalidateQueries({ queryKey: ['llm', 'models'] }),
        queryClient.invalidateQueries({ queryKey: ['llm', 'embeddings'] }),
        queryClient.invalidateQueries({ queryKey: ['search', 'semantic'] }),
      ]),
  });
}

export function useAddUserModel() {
  const { api } = useAuth();
  return useModelMutation((input: UserModelInput) => providersApi.add(api, input));
}

export function useUpdateUserModel() {
  const { api } = useAuth();
  return useModelMutation(({ id, changes }: { id: string; changes: UserModelChanges }) =>
    providersApi.update(api, id, changes),
  );
}

export function useRemoveUserModel() {
  const { api } = useAuth();
  return useModelMutation((id: string) => providersApi.remove(api, id));
}

// The databases on offer change only with a release.
export function useVectorStores() {
  const { api } = useAuth();
  return useQuery({
    queryKey: keys.vectorStores,
    queryFn: async () => (await providersApi.vectorStores(api)).stores,
    staleTime: Infinity,
  });
}

export function useIndexingStores() {
  const { api } = useAuth();
  return useQuery({ queryKey: keys.indexing, queryFn: () => providersApi.indexing(api) });
}

// A change to the stores may start a catch-up, so their progress is fetched again too.
function useIndexingMutation<T, R>(mutationFn: (input: T) => Promise<R>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.indexing }),
        queryClient.invalidateQueries({ queryKey: ['search', 'semantic'] }),
      ]),
  });
}

export function useAddIndexingStore() {
  const { api } = useAuth();
  return useIndexingMutation(
    (body: { provider: string; name?: string; settings: Record<string, string> }) =>
      providersApi.addStore(api, body),
  );
}

export function useUpdateIndexingStore() {
  const { api } = useAuth();
  return useIndexingMutation(
    ({
      id,
      ...body
    }: {
      id: string;
      name?: string;
      settings?: Record<string, string>;
      paused?: boolean;
    }) => providersApi.updateStore(api, id, body),
  );
}

export function useSearchWithStore() {
  const { api } = useAuth();
  return useIndexingMutation((storeId: string) => providersApi.searchWith(api, storeId));
}

export function useRemoveIndexingStore() {
  const { api } = useAuth();
  return useIndexingMutation((id: string) => providersApi.removeStore(api, id));
}
