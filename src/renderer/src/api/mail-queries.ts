import {
  keepPreviousData,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import type { FolderRole } from '../mail/folders';
import { mailApi, type Thread, type ThreadFilter, type ThreadPage } from './mail';

// Until the realtime channel exists, lists and counts refresh on an interval.
const REFRESH_MS = 30_000;
const FETCHING_POLL_MS = 1500;

export type ThreadScope =
  | { kind: 'unified'; filter: ThreadFilter; folder: FolderRole | null }
  | { kind: 'account'; accountId: string; folder: FolderRole };

export const mailKeys = {
  all: ['mail'] as const,
  threads: (scope: ThreadScope, page: number) => ['mail', 'threads', scope, page] as const,
  thread: (id: string) => ['mail', 'thread', id] as const,
  summary: (accountId: string, folder: FolderRole) =>
    ['mail', 'summary', accountId, folder] as const,
  folders: (accountId: string) => ['mail', 'folders', accountId] as const,
  stats: ['mail', 'stats'] as const,
};

export function useThreadPage(scope: ThreadScope, page: number) {
  const { api } = useAuth();
  return useQuery({
    queryKey: mailKeys.threads(scope, page),
    queryFn: () =>
      scope.kind === 'account'
        ? mailApi.listAccountThreads(api, scope.accountId, scope.folder, page)
        : mailApi.listThreads(api, scope.filter, scope.folder, page),
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

export function useMailboxSummary(accountId: string, folder: FolderRole) {
  const { api } = useAuth();
  return useQuery({
    queryKey: mailKeys.summary(accountId, folder),
    queryFn: () => mailApi.summary(api, accountId, folder),
    // Poll quickly only while older mail is being fetched for this folder.
    refetchInterval: (query) =>
      query.state.data?.history.status === 'fetching' ? FETCHING_POLL_MS : REFRESH_MS,
  });
}

// Server-side counts for every folder the connector found, one query per account.
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

function patchThreadEverywhere(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
  update: (thread: Thread) => Thread,
) {
  queryClient.setQueriesData<ThreadPage>({ queryKey: ['mail', 'threads'] }, (page) =>
    page
      ? { ...page, items: page.items.map((thread) => (thread.id === id ? update(thread) : thread)) }
      : page,
  );
}

// Optimistic so read/star toggles feel instant; the server response settles the truth.
export function useUpdateThread() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...changes }: { id: string; isRead?: boolean; isStarred?: boolean }) =>
      mailApi.updateThread(api, id, changes),
    onMutate: async ({ id, isRead, isStarred }) => {
      await queryClient.cancelQueries({ queryKey: ['mail', 'threads'] });
      patchThreadEverywhere(queryClient, id, (thread) => ({
        ...thread,
        ...(isRead !== undefined && { unreadCount: isRead ? 0 : Math.max(1, thread.unreadCount) }),
        ...(isStarred !== undefined && { isStarred }),
      }));
    },
    onSuccess: (thread) => patchThreadEverywhere(queryClient, thread.id, () => thread),
    onSettled: () => queryClient.invalidateQueries({ queryKey: mailKeys.all }),
  });
}
