import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { mailApi, type Thread, type ThreadFilter, type ThreadPage } from './mail';

// Until the realtime channel exists, lists refresh on an interval.
const REFRESH_MS = 30_000;

export const mailKeys = {
  all: ['mail'] as const,
  threads: (filter: ThreadFilter) => ['mail', 'threads', filter] as const,
  thread: (id: string) => ['mail', 'thread', id] as const,
  stats: ['mail', 'stats'] as const,
};

export function useThreads(filter: ThreadFilter) {
  const { api } = useAuth();
  return useInfiniteQuery({
    queryKey: mailKeys.threads(filter),
    queryFn: ({ pageParam }) => mailApi.listThreads(api, { filter, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
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

function patchThreadEverywhere(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
  update: (thread: Thread) => Thread,
) {
  queryClient.setQueriesData<InfiniteData<ThreadPage>>({ queryKey: ['mail', 'threads'] }, (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.map((thread) => (thread.id === id ? update(thread) : thread)),
          })),
        }
      : data,
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
