import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  useQueries,
} from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import type { ApiClient } from './client';
import type { Classification, ClassifyStatus, KnowledgeRecord } from './knowledge';

export type NodeType = 'collection' | 'mailbox' | 'folder' | 'record';
export type IndexingStatus =
  | 'QUEUED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'EMPTY'
  | 'FILE_TYPE_NOT_SUPPORTED'
  | 'PASSWORD_PROTECTED'
  | 'FAILED';
export type RecordType = 'FILE' | 'MAIL';

export interface HubNode {
  id: string;
  name: string;
  nodeType: NodeType;
  parentId: string | null;
  collectionId?: string | null;
  folderId?: string | null;
  origin: 'COLLECTION' | 'UPLOAD' | 'CONNECTOR';
  connector?: string | null;
  hasChildren: boolean;
  // An email's attachments (each is a record under it).
  attachmentCount?: number;
  createdAt: number | null;
  updatedAt: number | null;
  sourceCreatedAt?: number | null;
  sourceModifiedAt?: number | null;
  recordType?: RecordType;
  indexingStatus?: IndexingStatus;
  stage?: 'parse' | 'index' | null;
  reason?: string | null;
  sizeInBytes?: number;
  mimeType?: string;
  extension?: string | null;
  sourceType?: 'upload' | 'mail';
  version?: number;
  threadId?: string | null;
}

export interface Crumb {
  id: string;
  name: string;
  nodeType: NodeType;
}

export interface FilterOption {
  id: string;
  label: string;
  type?: string;
}

export interface HubListing {
  currentNode: HubNode | null;
  items: HubNode[];
  pagination: {
    limit: number;
    totalItems: number;
    hasNext: boolean;
    hasPrev: boolean;
    startIndex: number;
    endIndex: number;
    nextCursor: string | null;
    prevCursor: string | null;
  };
  breadcrumbs?: Crumb[];
  filters?: {
    available: {
      recordTypes: FilterOption[];
      indexingStatus: FilterOption[];
      sources: FilterOption[];
    };
  };
}

export type HubSort = 'name' | 'createdAt' | 'updatedAt' | 'size';

export interface HubQuery {
  parent?: { type: NodeType; id: string } | null;
  q?: string;
  recordTypes?: string[];
  indexingStatus?: string[];
  sourceIds?: string[];
  // Epoch ms bounds, either side optional.
  createdAt?: [number | null, number | null];
  updatedAt?: [number | null, number | null];
  size?: [number | null, number | null];
  sortBy?: HubSort;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  cursor?: string | null;
  flattened?: boolean;
}

const range = ([low, high]: [number | null, number | null]) =>
  [low !== null ? `gte:${low}` : '', high !== null ? `lte:${high}` : ''].filter(Boolean).join(',');

export function hubPath(query: HubQuery) {
  const params = new URLSearchParams();
  const list = (key: string, values?: string[]) => {
    if (values?.length) params.set(key, values.join(','));
  };
  if (query.q?.trim()) params.set('q', query.q.trim());
  list('recordTypes', query.recordTypes);
  list('indexingStatus', query.indexingStatus);
  list('sourceIds', query.sourceIds);
  for (const key of ['createdAt', 'updatedAt', 'size'] as const) {
    const bounds = query[key];
    if (bounds && range(bounds)) params.set(key, range(bounds));
  }
  params.set('sortBy', query.sortBy ?? 'updatedAt');
  params.set('sortOrder', query.sortOrder ?? 'desc');
  params.set('limit', String(query.limit ?? 50));
  if (query.cursor) params.set('cursor', query.cursor);
  if (query.flattened !== undefined) params.set('flattened', String(query.flattened));
  params.set('include', 'breadcrumbs,availableFilters');
  const base = query.parent
    ? `/rag/hub/nodes/${query.parent.type}/${query.parent.id}`
    : '/rag/hub/nodes';
  return `${base}?${params}`;
}

export interface Collection {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Folder {
  id: string;
  collectionId: string;
  parentId: string | null;
  name: string;
  depth: number;
}

export interface StageState {
  stage: 'parse' | 'index' | 'classify';
  status: string;
  reason: string | null;
}

export interface RecordDetails extends KnowledgeRecord {
  recordType: RecordType;
  origin: 'UPLOAD' | 'CONNECTOR';
  version: number;
  updatedAt: string;
  folderId: string | null;
  collection?: { id: string; name: string } | null;
  folderPath?: { id: string; name: string }[];
  permissions: { id: string; relationship: string; type: string }[];
  stageStates?: StageState[];
  blockCount?: number | null;
  engine?: string | null;
  embeddingModel?: string | null;
  pointCount?: number | null;
  classifyStatus?: ClassifyStatus | null;
  classification?: Classification | null;
  // An email's attachments, failed ones with why; or the email an attachment is in.
  attachments?: AttachmentSummary[];
  attachedTo?: { id: string; name: string } | null;
}

export interface AttachmentSummary {
  id: string;
  name: string;
  status: string;
  reason: string | null;
  sizeBytes: number;
}

export interface CollectionStats {
  collection: Collection;
  total: number;
  statuses: Partial<Record<IndexingStatus, number>>;
  recordTypes: Partial<Record<RecordType, number>>;
  summaries: Record<string, number>;
  sizeBytes: number;
}

export interface UploadItem {
  file: File;
  // A folder upload's relative path, e.g. "Reports/2024/q1.pdf".
  path?: string;
}

export const hubApi = {
  nodes: (api: ApiClient, query: HubQuery) => api.get<HubListing>(hubPath(query)),
  collections: (api: ApiClient) => api.get<{ collections: Collection[] }>('/rag/collections'),
  createCollection: (api: ApiClient, name: string) =>
    api.post<Collection>('/rag/collections', { name }),
  renameCollection: (api: ApiClient, id: string, name: string) =>
    api.patch<Collection>(`/rag/collections/${id}`, { name }),
  deleteCollection: (api: ApiClient, id: string) => api.delete<void>(`/rag/collections/${id}`),
  createFolder: (api: ApiClient, collectionId: string, name: string, parentId: string | null) =>
    api.post<Folder>(`/rag/collections/${collectionId}/folders`, { name, parentId }),
  renameFolder: (api: ApiClient, collectionId: string, id: string, name: string) =>
    api.patch<Folder>(`/rag/collections/${collectionId}/folders/${id}`, { name }),
  deleteFolder: (api: ApiClient, collectionId: string, id: string) =>
    api.delete<{ trashed: number }>(`/rag/collections/${collectionId}/folders/${id}`),
  record: (api: ApiClient, id: string) => api.get<RecordDetails>(`/rag/records/${id}`),
  renameRecord: (api: ApiClient, id: string, name: string) =>
    api.patch<KnowledgeRecord>(`/rag/records/${id}`, { name }),
  moveRecord: (api: ApiClient, id: string, collectionId: string, folderId: string | null) =>
    api.post<KnowledgeRecord>(`/rag/records/${id}/move`, { collectionId, folderId }),
  trash: (api: ApiClient, ids: string[]) =>
    api.post<{ trashed: string[] }>('/rag/records/trash', { ids }),
  restore: (api: ApiClient, ids: string[]) =>
    api.post<{ restored: string[] }>('/rag/records/restore', { ids }),
  deleteForever: (api: ApiClient, id: string) =>
    api.delete<void>(`/rag/records/${id}?permanent=true`),
  reindex: (api: ApiClient, ids: string[]) =>
    api.post<{ queued: string[]; skipped: { id: string; reason: string }[] }>(
      '/rag/records/reindex',
      { ids },
    ),
  // Writes indexed records' summaries again from their stored text, without indexing again.
  summarize: (api: ApiClient, ids: string[]) =>
    api.post<{ queued: string[]; skipped: { id: string; reason: string }[] }>(
      '/rag/records/summarize',
      { ids },
    ),
  reindexCollection: (
    api: ApiClient,
    collectionId: string,
    scope: { statuses?: string[]; folderId?: string | null },
  ) =>
    api.post<{ queued: string[]; skipped: { id: string; reason: string }[] }>(
      `/rag/collections/${collectionId}/reindex`,
      scope,
    ),
  stats: (api: ApiClient, collectionId: string) =>
    api.get<CollectionStats>(`/rag/collections/${collectionId}/stats`),
  limits: (api: ApiClient) =>
    api.get<{ maxFileSizeBytes: number; maxFilesPerUpload: number; trashRetentionDays: number }>(
      '/rag/limits',
    ),
  replace: (api: ApiClient, id: string, file: File, onProgress?: (fraction: number) => void) => {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('lastModified', String(file.lastModified || 0));
    return api.uploadForm<KnowledgeRecord & { version: number }>(
      `/rag/records/${id}/replace`,
      form,
      onProgress,
    );
  },
  upload: (
    api: ApiClient,
    target: { collectionId: string; folderId: string | null },
    items: UploadItem[],
    onProgress?: (fraction: number) => void,
  ) => {
    const form = new FormData();
    form.append('knowledgeBase', target.collectionId);
    if (target.folderId) form.append('folderId', target.folderId);
    const withPaths = items.some((item) => item.path);
    for (const item of items) {
      form.append('files', item.file, item.file.name);
      form.append('lastModified', String(item.file.lastModified || 0));
      if (withPaths) form.append('paths', item.path ?? item.file.name);
    }
    return api.uploadForm<{ records: (KnowledgeRecord & { duplicate: boolean })[] }>(
      '/rag/documents',
      form,
      onProgress,
    );
  },
};

const KEY = ['knowledge'] as const;
const BUSY = new Set<IndexingStatus>(['QUEUED', 'IN_PROGRESS']);

export function useHubNodes(query: HubQuery) {
  const { api } = useAuth();
  return useQuery({
    queryKey: [...KEY, 'hub', query],
    queryFn: () => hubApi.nodes(api, query),
    placeholderData: keepPreviousData,
    // Files being read are watched until they settle.
    refetchInterval: (state) =>
      state.state.data?.items.some((n) => n.indexingStatus && BUSY.has(n.indexingStatus))
        ? 2500
        : false,
  });
}

// The attachments of each expanded email, loaded when it opens.
export function useAttachments(emailIds: string[]) {
  const { api } = useAuth();
  return useQueries({
    queries: emailIds.map((id) => ({
      queryKey: [...KEY, 'hub', { parent: { type: 'record', id } }],
      queryFn: () => hubApi.nodes(api, { parent: { type: 'record', id } }),
    })),
    combine: (results) =>
      new Map(
        emailIds.map((id, i) => [
          id,
          { items: results[i]?.data?.items ?? [], loading: results[i]?.isPending ?? true },
        ]),
      ),
  });
}

// A file that came attached to an email (listed under it, removed with it).
export const isAttachment = (node: HubNode) =>
  node.nodeType === 'record' && node.sourceType === 'mail' && node.recordType === 'FILE';

export function useCollections() {
  const { api } = useAuth();
  return useQuery({
    queryKey: [...KEY, 'collections'],
    queryFn: () => hubApi.collections(api),
    select: (data) => data.collections,
  });
}

export function useRecordDetails(id: string | null) {
  const { api } = useAuth();
  return useQuery({
    queryKey: [...KEY, 'details', id],
    queryFn: () => hubApi.record(api, id!),
    enabled: id !== null,
    refetchInterval: (state) => {
      const status = state.state.data?.status;
      return status === 'queued' || status === 'in_progress' ? 3000 : false;
    },
  });
}

export function useCollectionStats(id: string | null) {
  const { api } = useAuth();
  return useQuery({
    queryKey: [...KEY, 'stats', id],
    queryFn: () => hubApi.stats(api, id!),
    enabled: id !== null,
  });
}

export function useUploadLimits() {
  const { api } = useAuth();
  return useQuery({
    queryKey: [...KEY, 'limits'],
    queryFn: () => hubApi.limits(api),
    staleTime: Infinity,
  });
}

// Any change to collections, folders or records: every knowledge view is read again.
export function useHubMutation<TInput, TResult>(
  run: (api: ApiClient, input: TInput) => Promise<TResult>,
) {
  const { api } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: TInput) => run(api, input),
    onSettled: () => client.invalidateQueries({ queryKey: KEY }),
  });
}
