import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { mailApi, type MailboxSummary } from '../api/mail';
import { mailKeys } from '../api/mail-queries';
import { useAuth } from '../auth/AuthProvider';
import type { MailboxView } from './folders';
import { PAGE_SIZE } from './paging';

const POLL_MS = 1500;
const MAX_BATCHES = 10;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Opens a page of one account folder or label, first fetching older mail from the server until enough
// conversations are stored for that page (or the server has nothing older).
export function useLoadPage(accountId: string, view: MailboxView, onReady: (page: number) => void) {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [failedPage, setFailedPage] = useState<number | null>(null);
  const run = useRef(0);

  async function freshSummary() {
    const summary = await mailApi.summary(api, accountId, view);
    queryClient.setQueryData(mailKeys.summary(accountId, view), summary);
    return summary;
  }

  async function load(page: number) {
    const id = ++run.current;
    setLoading(true);
    setFailedPage(null);
    try {
      let summary: MailboxSummary = await freshSummary();
      for (let batch = 0; batch < MAX_BATCHES; batch++) {
        const enough = summary.fetched.conversations >= page * PAGE_SIZE;
        if (enough || !summary.hasMoreOnServer) break;
        await mailApi.requestHistory(api, accountId, view);
        do {
          await sleep(POLL_MS);
          if (id !== run.current) return;
          summary = await freshSummary();
        } while (summary.history.status === 'fetching');
        if (summary.history.status === 'error')
          throw new Error(summary.history.error ?? 'fetch failed');
      }
      if (id !== run.current) return;
      await queryClient.invalidateQueries({ queryKey: ['mail', 'threads'] });
      onReady(page);
    } catch {
      if (id === run.current) setFailedPage(page);
    } finally {
      if (id === run.current) setLoading(false);
    }
  }

  // Stable, so an unmount cleanup can call it without cancelling on every re-render.
  const cancel = useCallback(() => {
    run.current += 1;
  }, []);

  return { load, loading, failedPage, cancel };
}
