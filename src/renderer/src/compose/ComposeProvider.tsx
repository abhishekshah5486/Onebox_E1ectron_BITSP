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
  send: (composition: Composition, draftId?: string) => Promise<boolean>;
  // v1's floating windows.
  windows: ComposeWindowState[];
  close: (key: string) => void;
}

const ComposeContext = createContext<ComposeContextValue | null>(null);

export function useCompose() {
  const value = useContext(ComposeContext);
  if (!value) throw new Error('useCompose must be used inside ComposeProvider');
  return value;
}

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
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

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
    [api, notify, open, queryClient],
  );

  const undo = useCallback(
    async (outboxId: string) => {
      try {
        const draft = await composeApi.undo(api, outboxId);
        await queryClient.invalidateQueries({ queryKey: composeKeys.drafts });
        notify({
          id: `send-${outboxId}`,
          type: 'info',
          tone: 'burgundy',
          content: 'Sending undone.',
        });
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
    async (composition: Composition, draftId?: string) => {
      try {
        const queued = await composeApi.send(api, { ...composition, ...(draftId && { draftId }) });
        await queryClient.invalidateQueries({ queryKey: composeKeys.drafts });
        notify({
          id: `send-${queued.id}`,
          type: 'success',
          content: 'Message sent.',
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

  const value = useMemo(() => ({ open, send, windows, close }), [open, send, windows, close]);
  return <ComposeContext.Provider value={value}>{children}</ComposeContext.Provider>;
}
