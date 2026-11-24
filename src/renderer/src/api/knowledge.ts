import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import type { ApiClient } from './client';

export type SourceType = 'upload' | 'mail';
export type RecordStatus =
  | 'queued'
  | 'in_progress'
  | 'completed'
  | 'empty'
  | 'failed'
  | 'file_type_not_supported'
  | 'password_protected';
export type DateOrigin = 'source' | 'lastModified' | 'upload' | 'content';
export type ClassifyStatus = 'queued' | 'deferred' | 'completed' | 'skipped' | 'failed';

export interface KnowledgeRecord {
  id: string;
  sourceType: SourceType;
  sourceId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  status: RecordStatus;
  stage: 'parse' | 'index' | null;
  reason: string | null;
  createdAt: string;
  sourceCreatedAt: string | null;
  sourceModifiedAt: string | null;
  dateOrigin: DateOrigin;
  parentId: string | null;
  duplicate?: boolean;
  mail?: MailInfo | null;
  classifyStatus?: ClassifyStatus | null;
  classification?: Classification | null;
}

export interface Classification {
  summary: string;
  category: string | null;
  subcategories: { level1: string; level2: string; level3: string } | null;
  languages: string[] | null;
  topics: string[] | null;
  organizations: string[] | null;
}

export interface KnowledgeSource {
  sourceType: SourceType;
  sourceId: string;
  records: number;
  statuses: Partial<Record<RecordStatus, number>>;
  lastAddedAt: string;
}

export interface MailInfo {
  threadId?: string;
  sender?: { name?: string; address: string };
  to?: { name?: string; address: string }[];
  receivedAt?: string;
}

export type ChunkKind = 'block' | 'list' | 'table' | 'record' | 'summary' | 'neighbour';

export interface Chunk {
  id: string;
  text: string;
  score: number;
  kind: ChunkKind;
  record: {
    recordId: string;
    name: string;
    mimeType: string;
    sourceType: SourceType;
    sourceId: string;
    updatedAt: string;
    dates: { created: string; modified: string; origin: DateOrigin };
    mail?: MailInfo;
    attachedTo?: { recordId: string; name: string; mail: MailInfo };
  };
  citation: {
    page?: number;
    sheet?: string;
    row?: number;
    slide?: number;
    line?: number;
    headingPath?: string[];
    blockIndex: number;
    blockIndices: number[];
    neighbourOf?: number;
  };
}

export interface Notice {
  // e.g. STILL_READING, DATES_PENDING
  code: string;
  count: number;
  message: string;
}

export interface Retrieved {
  chunks: Chunk[];
  unindexed: { recordId: string; name: string; status: RecordStatus; reason?: string | null }[];
  incomplete?: string;
  notices?: Notice[];
  outsideDates?: { note: string; chunks: Chunk[] };
}

export interface RetrieveInput {
  query: string;
  limit?: number;
  sourceIds?: string[];
  sourceTypes?: SourceType[];
  recordIds?: string[];
  maxChunksPerRecord?: number;
  createdAfter?: string;
  createdBefore?: string;
}

export type RecordSort =
  'createdAt' | 'updatedAt' | 'sourceCreatedAt' | 'sourceModifiedAt' | 'name' | 'sizeBytes';

export interface RecordQuery {
  q?: string;
  status?: RecordStatus[];
  sourceType?: SourceType[];
  sourceId?: string[];
  mimeType?: string[];
  minSize?: number;
  maxSize?: number;
  createdAfter?: string;
  createdBefore?: string;
  modifiedAfter?: string;
  modifiedBefore?: string;
  sort?: RecordSort;
  order?: 'asc' | 'desc';
  offset?: number;
  limit?: number;
}

export interface RecordsPage {
  records: KnowledgeRecord[];
  total: number;
  available: { statuses: Partial<Record<RecordStatus, number>>; mimeTypes: Record<string, number> };
}

export function recordsSearch(query: RecordQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === '') continue;
    for (const item of Array.isArray(value) ? value : [value]) params.append(key, String(item));
  }
  return params.toString();
}

export interface ReadBlock {
  index: number;
  type: string;
  text: string;
  isHeader?: boolean;
  groupIndex?: number;
  citation?: Omit<Chunk['citation'], 'blockIndex' | 'blockIndices' | 'neighbourOf'>;
}

export interface RecordRead {
  recordId: string;
  name: string;
  mimeType: string;
  blocks: ReadBlock[];
  total: number;
  next: number | null;
  focused?: boolean;
  gaps?: { from: number; to: number }[];
}

export interface RagSettings {
  search: { results: number; maxPerRecord: number | null; dateSafetyNet: boolean };
  indexing: {
    summaries: 'on' | 'first_use' | 'off';
    headerDates: 'off' | 'true' | 'all';
    windowChars: number;
    windowOverlap: number;
  };
}

export interface RagSettingsResponse {
  settings: RagSettings;
  defaults: RagSettings;
  summariesAvailable: boolean;
}

const TERMINAL = new Set<RecordStatus>([
  'completed',
  'empty',
  'failed',
  'file_type_not_supported',
  'password_protected',
]);
export const isSettled = (record: KnowledgeRecord) =>
  TERMINAL.has(record.status) &&
  !(record.status === 'completed' && record.classifyStatus === 'queued');

export const knowledgeApi = {
  sources: (api: ApiClient) => api.get<{ sources: KnowledgeSource[] }>('/rag/sources'),
  records: (api: ApiClient, query: RecordQuery) =>
    api.get<RecordsPage>(`/rag/records?${recordsSearch(query)}`),
  reindex: (api: ApiClient, ids: string[]) =>
    api.post<{ queued: string[]; skipped: { id: string; reason: string }[] }>(
      '/rag/records/reindex',
      { ids },
    ),
  record: (api: ApiClient, id: string) => api.get<KnowledgeRecord>(`/rag/records/${id}`),
  read: (api: ApiClient, id: string, query: string) =>
    api.get<RecordRead>(
      `/rag/records/${id}/read${query.trim() ? `?${new URLSearchParams({ query })}` : ''}`,
    ),
  retrieve: (api: ApiClient, input: RetrieveInput) => api.post<Retrieved>('/rag/retrieve', input),
  remove: (api: ApiClient, id: string) => api.delete<void>(`/rag/records/${id}`),
  file: (api: ApiClient, id: string) => api.blob(`/rag/records/${id}/file`),
  settings: (api: ApiClient) => api.get<RagSettingsResponse>('/rag/settings'),
  saveSettings: (api: ApiClient, settings: RagSettings) =>
    api.put<{ settings: RagSettings }>('/rag/settings', settings),
  resetSettings: (api: ApiClient) => api.delete<{ settings: RagSettings }>('/rag/settings'),
  upload: (
    api: ApiClient,
    knowledgeBase: string,
    files: File[],
    onProgress?: (fraction: number) => void,
  ) => {
    const form = new FormData();
    form.append('knowledgeBase', knowledgeBase);
    for (const file of files) {
      form.append('files', file, file.name);
      // The file's own last-modified time dates it, as the user knows it.
      form.append('lastModified', String(file.lastModified || 0));
    }
    return api.uploadForm<{ records: KnowledgeRecord[] }>('/rag/documents', form, onProgress);
  },
};

const KEY = ['knowledge'] as const;

export function useKnowledgeSources() {
  const { api } = useAuth();
  return useQuery({
    queryKey: [...KEY, 'sources'],
    queryFn: () => knowledgeApi.sources(api),
    select: (data) => data.sources,
  });
}

export function useRecordsPage(query: RecordQuery) {
  const { api } = useAuth();
  return useQuery({
    queryKey: [...KEY, 'records', query],
    queryFn: () => knowledgeApi.records(api, query),
    placeholderData: keepPreviousData,
    // Files being read are watched until they settle.
    refetchInterval: (state) =>
      state.state.data?.records.some((r) => !TERMINAL.has(r.status)) ? 2500 : false,
  });
}

export function useReindex() {
  const { api } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => knowledgeApi.reindex(api, ids),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}

export function useKnowledgeRecord(id: string | null) {
  const { api } = useAuth();
  return useQuery({
    queryKey: [...KEY, 'record', id],
    queryFn: () => knowledgeApi.record(api, id!),
    enabled: id !== null,
    refetchInterval: (query) => (query.state.data && !isSettled(query.state.data) ? 3000 : false),
  });
}

export function useRecordRead(id: string | null, query: string) {
  const { api } = useAuth();
  return useQuery({
    queryKey: [...KEY, 'read', id, query],
    queryFn: () => knowledgeApi.read(api, id!, query),
    enabled: id !== null,
    staleTime: 60_000,
  });
}

// Retrieval is charged per query embedding (unless the model is local), so a result is kept
// until the person asks again.
export function useRetrieval(input: RetrieveInput | null) {
  const { api } = useAuth();
  return useQuery({
    queryKey: [...KEY, 'retrieve', input],
    queryFn: () => knowledgeApi.retrieve(api, input!),
    enabled: input !== null && input.query.trim().length > 0,
    staleTime: Infinity,
    retry: false,
  });
}

export function useRagSettings() {
  const { api } = useAuth();
  return useQuery({ queryKey: [...KEY, 'settings'], queryFn: () => knowledgeApi.settings(api) });
}

export function useSaveRagSettings() {
  const { api } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (settings: RagSettings | null) =>
      settings ? knowledgeApi.saveSettings(api, settings) : knowledgeApi.resetSettings(api),
    onSuccess: () => client.invalidateQueries({ queryKey: [...KEY, 'settings'] }),
  });
}

export function useUploadDocuments() {
  const { api } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      knowledgeBase: string;
      files: File[];
      onProgress?: (fraction: number) => void;
    }) => knowledgeApi.upload(api, input.knowledgeBase, input.files, input.onProgress),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteRecord() {
  const { api } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => knowledgeApi.remove(api, id),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}
