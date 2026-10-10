import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router';
import { ApiError } from '../api/client';
import { composeApi, composeKeys, type Composition, type OutboxItem } from '../api/compose';
import { mailKeys } from '../api/mail-queries';
import { useAccounts, usePreferences } from '../api/queries';
import { useAuth } from '../auth/AuthProvider';
import { describeError } from '../auth/errors';
import { useUiVersion } from '../theme/UiVersionProvider';
import { useNotify } from '../ui/useNotify';
import { emptyComposition } from './model';

export interface ComposeRequest {
  composition: Composition;
  // Set when continuing a saved draft.
  draftId?: string;
}

export interface ComposeWindowState extends ComposeRequest {
  key: string;
}

interface ComposeContextValue {
  // Starts writing: a new message by default, or the given reply, forward or draft.
  open: (request?: Partial<ComposeRequest>) => void;
  // Queues a message; it goes after a few seconds, so the banner offers Undo.
  // With `sendAt`, it goes at that time instead (scheduled send).
  send: (composition: Composition, draftId?: string, sendAt?: Date) => Promise<boolean>;
  // v1's floating windows.
  windows: ComposeWindowState[];
  close: (key: string) => void;
  // A window's draft got saved: remembered, so it reopens after a refresh.
  saved: (key: string, draftId: string) => void;
}

const ComposeContext = createContext<ComposeContextValue | null>(null);

export function useCompose() {
  const value = useContext(ComposeContext);
  if (!value) throw new Error('useCompose must be used inside ComposeProvider');
  return value;
}

// The drafts open in compose windows, kept in this browser so they reopen after a refresh.
const OPEN_DRAFTS = 'onebox.compose.open';
const readOpenDrafts = (): string[] => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(OPEN_DRAFTS) ?? '[]');
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
};
const writeOpenDrafts = (ids: string[]) => {
  try {
    localStorage.setItem(OPEN_DRAFTS, JSON.stringify(ids));
  } catch {
    // Only a convenience.
  }
};

const POLL_MS = 2_000;
const FOLLOW_FOR_MS = 2 * 60_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Where messages are written and sent from, in either interface.
export function ComposeProvider({ children }: { children: ReactNode }) {
  const { api } = useAuth();
  const { version } = useUiVersion();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const accounts = useAccounts();
  const preferences = usePreferences();
  const [windows, setWindows] = useState<ComposeWindowState[]>([]);
  const alive = useRef(true);
  // Set on every mount: React mounts twice in development, and a stale false would stop
  // following sends.
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const open = useCallback(
    (request: Partial<ComposeRequest> = {}) => {
      const sender =
        accounts.data?.find((account) => account.status === 'CONNECTED') ?? accounts.data?.[0];
      const full: ComposeRequest = {
        composition:
          request.composition ??
          emptyComposition(sender?.id ?? null, preferences.data?.signature ?? null),
        ...(request.draftId && { draftId: request.draftId }),
      };
      if (version === 'v2') {
        void navigate(full.draftId ? `/compose/${full.draftId}` : '/compose', { state: full });
        return;
      }
      setWindows((current) => {
        // A draft already open just comes back to the front.
        if (full.draftId && current.some((w) => w.draftId === full.draftId)) return current;
        return [...current, { ...full, key: crypto.randomUUID() }];
      });
    },
    [accounts.data, preferences.data, version, navigate],
  );

  const close = useCallback((key: string) => {
    setWindows((current) => current.filter((w) => w.key !== key));
  }, []);

  const saved = useCallback((key: string, draftId: string) => {
    setWindows((current) => current.map((w) => (w.key === key ? { ...w, draftId } : w)));
  }, []);

  // Open windows survive a refresh: their drafts are reopened from the server.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || version === 'v2') return;
    restored.current = true;
    for (const id of readOpenDrafts()) {
      void composeApi
        .draft(api, id)
        .then((draft) =>
          setWindows((current) =>
            current.some((w) => w.draftId === draft.id)
              ? current
              : [...current, { composition: draft, draftId: draft.id, key: crypto.randomUUID() }],
          ),
        )
        // Sent or discarded since: nothing to reopen.
        .catch(() => undefined);
    }
  }, [api, version]);
  useEffect(() => {
    if (restored.current) writeOpenDrafts(windows.flatMap((w) => (w.draftId ? [w.draftId] : [])));
  }, [windows]);

  // After the undo window, waits to hear how sending went and says so if it failed.
  const follow = useCallback(
    async (queued: OutboxItem) => {
      const until = Date.now() + FOLLOW_FOR_MS;
      await sleep(Math.max(0, new Date(queued.sendAt).getTime() - Date.now()) + 1_000);
      while (alive.current && Date.now() < until) {
        const item = (await composeApi.outbox(api).catch(() => [])).find((o) => o.id === queued.id);
        if (!item || item.status === 'cancelled') return;
        if (item.status === 'sent') {
          await queryClient.invalidateQueries({ queryKey: mailKeys.all });
          // The console's banner moves on from Undo (too late now) to the sent message.
          if (version === 'v2') {
            notify({
              id: `send-${queued.id}`,
              type: 'success',
              content: 'Message sent.',
              action: {
                label: 'View message',
                onClick: () => void navigate(item.threadId ? `/sent/${item.threadId}` : '/sent'),
              },
            });
          }
          return;
        }
        if (item.status === 'failed') {
          await queryClient.invalidateQueries({ queryKey: composeKeys.drafts });
          notify({
            type: 'error',
            header: `Couldn't send "${queued.subject || '(no subject)'}".`,
            content: item.error ?? 'The mail server refused it.',
            action: {
              label: 'Open draft',
              onClick: () =>
                void composeApi
                  .draft(api, `failed-${queued.id}`)
                  .then((draft) => open({ composition: draft, draftId: draft.id })),
            },
          });
          return;
        }
        await sleep(POLL_MS);
      }
    },
    [api, navigate, notify, open, queryClient, version],
  );

  const undo = useCallback(
    async (outboxId: string) => {
      try {
        const draft = await composeApi.undo(api, outboxId);
        await queryClient.invalidateQueries({ queryKey: composeKeys.drafts });
        open({ composition: draft, draftId: draft.id });
      } catch (error) {
        notify({
          id: `send-${outboxId}`,
          type: 'warning',
          content:
            error instanceof ApiError && error.code === 'ALREADY_SENT'
              ? 'Too late to undo: the message has been sent.'
              : describeError(error),
        });
      }
    },
    [api, notify, open, queryClient],
  );

  const send = useCallback(
    async (composition: Composition, draftId?: string, sendAt?: Date) => {
      try {
        const queued = await composeApi.send(api, {
          ...composition,
          ...(draftId && { draftId }),
          ...(sendAt && { sendAt: sendAt.toISOString() }),
        });
        await queryClient.invalidateQueries({ queryKey: composeKeys.drafts });
        notify({
          id: `send-${queued.id}`,
          type: 'success',
          content: sendAt
            ? `Send scheduled for ${sendAt.toLocaleString(undefined, {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                hour: 'numeric',
                minute: '2-digit',
              })}.`
            : 'Message sent.',
          action: { label: 'Undo', onClick: () => void undo(queued.id) },
        });
        void follow(queued);
        return true;
      } catch (error) {
        notify({ type: 'error', header: "Couldn't send.", content: describeError(error) });
        return false;
      }
    },
    [api, follow, notify, queryClient, undo],
  );

  const value = useMemo(
    () => ({ open, send, windows, close, saved }),
    [open, send, windows, close, saved],
  );
  return <ComposeContext.Provider value={value}>{children}</ComposeContext.Provider>;
}
