import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import type { ApiClient } from './client';

export type ModelProvider = 'OPENAI' | 'GEMINI' | 'ANTHROPIC';
export type ModelPurpose = 'classify' | 'extract' | 'draft' | 'summarize';
export const AUTO_MODEL = 'auto';

export interface ModelOption {
  id: string;
  provider: ModelProvider;
  name: string;
  description: string;
  available: boolean;
}

export interface UsageTotals {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cacheHits: number;
  failures: number;
}

export interface UsageSummary {
  days: number;
  totals: UsageTotals;
  byModel: (UsageTotals & { model: string })[];
  byPurpose: (UsageTotals & { purpose: string })[];
  recent: {
    id: string;
    purpose: string;
    requestedModel: string;
    modelUsed: string | null;
    status: string;
    cacheHit: boolean;
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
    fallbacks: number;
    createdAt: string;
  }[];
}

export type AiMode = 'auto' | 'suggest' | 'off';

export interface LabelRule {
  accountId: string;
  path: string;
  name: string;
  description: string;
  mode: AiMode;
  threshold: number;
}

export interface LabelResult {
  path: string;
  name: string;
  confidence: number;
  reason: string;
  status: 'applied' | 'pending' | 'accepted' | 'rejected' | 'assigned';
}

export interface Suggestion {
  messageId: string;
  threadId: string;
  accountId: string;
  from: string;
  subject: string;
  snippet: string;
  receivedAt: string;
  model: string | null;
  results: LabelResult[];
}

export const aiApi = {
  models: (api: ApiClient) =>
    api.get<{ items: ModelOption[]; purposes: ModelPurpose[]; choices: Record<string, string> }>(
      '/llm/models',
    ),
  choose: (api: ApiClient, purpose: ModelPurpose, modelId: string) =>
    api.put<void>(`/llm/choices/${purpose}`, { modelId }),
  usage: (api: ApiClient, days: number) => api.get<UsageSummary>(`/llm/usage?days=${days}`),
  rules: (api: ApiClient) => api.get<{ items: LabelRule[] }>('/ai/labels'),
  saveRule: (api: ApiClient, rule: Omit<LabelRule, 'threshold'> & { threshold?: number }) =>
    api.put<LabelRule>('/ai/labels', rule),
  moveRule: (api: ApiClient, body: { accountId: string; from: string; to: string; name: string }) =>
    api.post<void>('/ai/labels/move', body),
  removeRule: (api: ApiClient, accountId: string, path: string) =>
    api.post<void>('/ai/labels/delete', { accountId, path }),
  suggestions: (api: ApiClient, page: number) =>
    api.get<{ items: Suggestion[]; total: number; page: number; pageSize: number }>(
      `/ai/suggestions?page=${page}`,
    ),
  suggestionCount: (api: ApiClient) => api.get<{ count: number }>('/ai/suggestions/count'),
  decide: (api: ApiClient, messageId: string, path: string, accept: boolean) =>
    api.post<Suggestion>(`/ai/suggestions/${messageId}/decide`, { path, accept }),
  assign: (api: ApiClient, messageId: string, path: string, name: string) =>
    api.post<Suggestion>(`/ai/suggestions/${messageId}/assign`, { path, name }),
};

const aiKeys = {
  models: ['llm', 'models'] as const,
  usage: (days: number) => ['llm', 'usage', days] as const,
  rules: ['ai', 'rules'] as const,
  suggestions: ['ai', 'suggestions'] as const,
};

export function useModels() {
  const { api } = useAuth();
  return useQuery({ queryKey: aiKeys.models, queryFn: () => aiApi.models(api) });
}

export function useChooseModel() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ purpose, modelId }: { purpose: ModelPurpose; modelId: string }) =>
      aiApi.choose(api, purpose, modelId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: aiKeys.models }),
  });
}

export function useUsage(days: number) {
  const { api } = useAuth();
  return useQuery({ queryKey: aiKeys.usage(days), queryFn: () => aiApi.usage(api, days) });
}

export function useLabelRules() {
  const { api } = useAuth();
  return useQuery({ queryKey: aiKeys.rules, queryFn: () => aiApi.rules(api) });
}

export function useSaveLabelRule() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rule: Omit<LabelRule, 'threshold'> & { threshold?: number }) =>
      aiApi.saveRule(api, rule),
    onSettled: () => queryClient.invalidateQueries({ queryKey: aiKeys.rules }),
  });
}

export function useSuggestions(page: number) {
  const { api } = useAuth();
  return useQuery({
    queryKey: [...aiKeys.suggestions, page],
    queryFn: () => aiApi.suggestions(api, page),
    refetchInterval: 30_000,
  });
}

export function useSuggestionCount() {
  const { api } = useAuth();
  return useQuery({
    queryKey: [...aiKeys.suggestions, 'count'],
    queryFn: () => aiApi.suggestionCount(api),
    refetchInterval: 30_000,
  });
}

// Accept, reject or reassign; the list and the mail both refresh afterwards.
export function useResolveSuggestion() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      action:
        | { type: 'decide'; messageId: string; path: string; accept: boolean }
        | { type: 'assign'; messageId: string; path: string; name: string },
    ) =>
      action.type === 'decide'
        ? aiApi.decide(api, action.messageId, action.path, action.accept)
        : aiApi.assign(api, action.messageId, action.path, action.name),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: aiKeys.suggestions });
      void queryClient.invalidateQueries({ queryKey: ['mail'] });
    },
  });
}
