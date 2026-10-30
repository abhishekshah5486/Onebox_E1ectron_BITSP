import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { PAGE_SIZE } from '../mail/paging';
import { ApiError, type ApiClient } from './client';
import type { Thread } from './mail';

// keyword: Elasticsearch with Gmail's operators. semantic: AI search by meaning (Qdrant).
export type SearchMode = 'keyword' | 'semantic';

export const SEARCH_MODE_LABEL: Record<SearchMode, string> = {
  keyword: 'Keyword search',
  semantic: 'AI search',
};

export interface SearchHit {
  thread: Thread;
  messageId: string;
  score: number | null;
  highlights: string[];
}

export interface SearchResults {
  // What ran: AI search falls back to keywords when only operators were given.
  mode: SearchMode;
  items: SearchHit[];
  total: number;
  nextPage: number | null;
}

export const searchPath = (mode: SearchMode, q: string) =>
  `/search/${mode}/${encodeURIComponent(q.trim())}`;

export const isSearchMode = (value: string | undefined): value is SearchMode =>
  value === 'keyword' || value === 'semantic';

export const searchApi = {
  // Pages count from 1 here, from 0 on the server.
  search: (api: ApiClient, q: string, mode: SearchMode, page: number) =>
    api.get<SearchResults>(
      `/search?${new URLSearchParams({ q, mode, page: String(page - 1), pageSize: String(PAGE_SIZE) })}`,
    ),
};

// Bad queries, missing credits and AI search being off won't fix themselves on a retry.
const FINAL = new Set([400, 402, 503]);

export function useSearch(q: string, mode: SearchMode, page: number) {
  const { api } = useAuth();
  return useQuery({
    queryKey: ['mail', 'search', mode, q, page],
    queryFn: () => searchApi.search(api, q, mode, page),
    enabled: q.trim().length > 0,
    placeholderData: keepPreviousData,
    // Charged per AI search, so results are kept until something changes.
    staleTime: Infinity,
    retry: (count, error) => !(error instanceof ApiError && FINAL.has(error.status)) && count < 2,
    select: (data) => ({ ...data, threads: data.items.map((hit) => hit.thread) }),
  });
}

// What to tell the user when a search can't run; null for the usual error text.
export function searchProblem(error: unknown): { text: string; plans: boolean } | null {
  if (!(error instanceof ApiError)) return null;
  if (error.status === 402) {
    return { text: 'You are out of AI credits. Add credits or use keyword search.', plans: true };
  }
  if (error.code === 'EMBEDDINGS_OFF') {
    return { text: 'AI search is not set up on this server. Use keyword search.', plans: false };
  }
  return null;
}
