import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { connectLive } from './live';
import { setLive } from './liveStatus';
import { mailKeys } from './mail-queries';

// Bursts (a sync landing many messages) refresh once.
const BATCH_MS = 300;

// Refreshes mail on screen as the server reports changes, instead of on a timer.
export function useLiveUpdates() {
  const { api } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    const changed = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let connectedBefore = false;
    const refreshLists = () =>
      queryClient.invalidateQueries({
        predicate: ({ queryKey }) => queryKey[0] === 'mail' && queryKey[1] !== 'thread',
      });

    const flush = () => {
      timer = undefined;
      for (const id of changed)
        void queryClient.invalidateQueries({ queryKey: mailKeys.thread(id) });
      changed.clear();
      void refreshLists();
    };

    const close = connectLive({
      api,
      onEvent: (event) => {
        changed.add(event.threadId);
        timer ??= setTimeout(flush, BATCH_MS);
      },
      onStatus: (connected) => {
        setLive(connected);
        // Catch up on anything missed while the stream was down; polling resumes meanwhile.
        if (connected && connectedBefore)
          void queryClient.invalidateQueries({ queryKey: mailKeys.all });
        if (!connected) void refreshLists();
        connectedBefore ||= connected;
      },
    });
    return () => {
      close();
      clearTimeout(timer);
      setLive(false);
    };
  }, [api, queryClient]);
}
