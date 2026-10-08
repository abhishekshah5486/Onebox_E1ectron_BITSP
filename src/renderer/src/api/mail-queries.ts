import {
  keepPreviousData,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { viewKey, type FolderRole, type GmailCategory, type MailboxView } from '../mail/folders';
import {
  mailApi,
  type ActionRequest,
  type Thread,
  type ThreadFilter,
  type ThreadPage,
} from './mail';

// Until the realtime channel exists, lists and counts refresh on an interval.
const REFRESH_MS = 30_000;
const FETCHING_POLL_MS = 1500;

export type ThreadScope =
  | {
      kind: 'unified';
      filter: ThreadFilter;
      folder: FolderRole | null;
      category?: GmailCategory | null;
    }
  | { kind: 'account'; accountId: string; view: MailboxView; category?: GmailCategory | null };

export const mailKeys = {
  all: ['mail'] as const,
  threads: (scope: ThreadScope, page: number) => ['mail', 'threads', scope, page] as const,
  thread: (id: string) => ['mail', 'thread', id] as const,
  summary: (accountId: string, view: MailboxView) =>
    ['mail', 'summary', accountId, viewKey(view)] as const,
  folders: (accountId: string) => ['mail', 'folders', accountId] as const,
  stats: ['mail', 'stats'] as const,
};

export function useThreadPage(scope: ThreadScope, page: number) {
  const { api } = useAuth();
  return useQuery({
    queryKey: mailKeys.threads(scope, page),
    queryFn: () =>
      scope.kind === 'account'
        ? mailApi.listAccountThreads(api, scope.accountId, scope.view, page, scope.category)
        : mailApi.listThreads(api, scope.filter, scope.folder, page, scope.category),
    placeholderData: keepPreviousData,
    refetchInterval: REFRESH_MS,
  });
}

export function useThread(id: string) {
  const { api } = useAuth();
  return useQuery({ queryKey: mailKeys.thread(id), queryFn: () => mailApi.getThread(api, id) });
}

export function useMailStats() {
  const { api } = useAuth();
  return useQuery({
    queryKey: mailKeys.stats,
    queryFn: () => mailApi.stats(api),
    refetchInterval: REFRESH_MS,
  });
}

export function useMailboxSummary(accountId: string, view: MailboxView) {
  const { api } = useAuth();
  return useQuery({
    queryKey: mailKeys.summary(accountId, view),
    queryFn: () => mailApi.summary(api, accountId, view),
    // Poll quickly only while older mail is being fetched for this folder.
    refetchInterval: (query) =>
      query.state.data?.history.status === 'fetching' ? FETCHING_POLL_MS : REFRESH_MS,
  });
}

// Server-side counts for every folder and label the connector found, one query per account.
export function useAccountFolders(accountIds: string[]) {
  const { api } = useAuth();
  return useQueries({
    queries: accountIds.map((id) => ({
      queryKey: mailKeys.folders(id),
      queryFn: () => mailApi.folders(api, id),
      refetchInterval: REFRESH_MS,
    })),
  });
}

type QueryClient = ReturnType<typeof useQueryClient>;

function patchThreads(
  queryClient: QueryClient,
  ids: Set<string>,
  update: (thread: Thread) => Thread | null,
) {
  queryClient.setQueriesData<ThreadPage>({ queryKey: ['mail', 'threads'] }, (page) => {
    if (!page) return page;
    const items = page.items.flatMap((thread) => {
      if (!ids.has(thread.id)) return [thread];
      const next = update(thread);
      return next ? [next] : [];
    });
    return { ...page, items, total: page.total - (page.items.length - items.length) };
  });
}

const flagChange = (action: ActionRequest['action']): ((thread: Thread) => Thread) | null => {
  switch (action) {
    case 'read':
      return (thread) => ({ ...thread, unreadCount: 0 });
    case 'unread':
      return (thread) => ({ ...thread, unreadCount: Math.max(1, thread.unreadCount) });
    case 'star':
      return (thread) => ({ ...thread, isStarred: true });
    case 'unstar':
      return (thread) => ({ ...thread, isStarred: false });
    default:
      return null;
  }
};

// Optimistic so read/star toggles feel instant; the server response settles the truth.
export function useUpdateThread() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...changes }: { id: string; isRead?: boolean; isStarred?: boolean }) =>
      mailApi.updateThread(api, id, changes),
    onMutate: async ({ id, isRead, isStarred }) => {
      await queryClient.cancelQueries({ queryKey: ['mail', 'threads'] });
      patchThreads(queryClient, new Set([id]), (thread) => ({
        ...thread,
        ...(isRead !== undefined && { unreadCount: isRead ? 0 : Math.max(1, thread.unreadCount) }),
        ...(isStarred !== undefined && { isStarred }),
      }));
    },
    onSuccess: (thread) => patchThreads(queryClient, new Set([thread.id]), () => thread),
    onSettled: () => queryClient.invalidateQueries({ queryKey: mailKeys.all }),
  });
}

// Archive, move, trash, delete and read/star for many conversations at once. Conversations that
// leave a list disappear from it straight away; the refetch afterwards puts them where they went.
export function useThreadAction() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: ActionRequest) => mailApi.act(api, request),
    onMutate: async ({ threadIds, action }) => {
      await queryClient.cancelQueries({ queryKey: ['mail', 'threads'] });
      const ids = new Set(threadIds);
      patchThreads(queryClient, ids, flagChange(action) ?? (() => null));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: mailKeys.all }),
  });
}

// One-click unsubscribes on the server; otherwise the sender's page or address opens outside.
export function useUnsubscribe() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (threadId: string) => mailApi.unsubscribe(api, threadId),
    onSuccess: (result, threadId) => {
      if (result.url) window.open(result.url, '_blank', 'noopener,noreferrer');
      void queryClient.invalidateQueries({ queryKey: mailKeys.thread(threadId) });
      void queryClient.invalidateQueries({ queryKey: ['mail', 'threads'] });
    },
  });
}
