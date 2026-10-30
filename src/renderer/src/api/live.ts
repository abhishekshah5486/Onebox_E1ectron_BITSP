import { createParser, type EventSourceMessage } from 'eventsource-parser';
import { ApiError, type ApiClient } from './client';

export type LiveEvent =
  | { type: 'thread.changed'; threadId: string; accountId: string }
  | { type: 'thread.removed'; threadId: string };

export interface LiveOptions {
  api: Pick<ApiClient, 'stream'>;
  onEvent: (event: LiveEvent) => void;
  onStatus: (connected: boolean) => void;
  minDelayMs?: number;
  maxDelayMs?: number;
}

const isLiveEvent = (value: unknown): value is LiveEvent =>
  typeof value === 'object' &&
  value !== null &&
  ['thread.changed', 'thread.removed'].includes((value as { type?: string }).type ?? '') &&
  typeof (value as { threadId?: unknown }).threadId === 'string';

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    });
  });

// Keeps one stream of the user's live events open, reconnecting with growing pauses when it
// drops. Returns a function that closes it for good.
export function connectLive({
  api,
  onEvent,
  onStatus,
  minDelayMs = 1_000,
  maxDelayMs = 30_000,
}: LiveOptions): () => void {
  const controller = new AbortController();
  const { signal } = controller;
  let delay = minDelayMs;

  const handle = (message: EventSourceMessage) => {
    if (message.event === 'ready') {
      delay = minDelayMs;
      onStatus(true);
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(message.data);
    } catch {
      return;
    }
    if (isLiveEvent(parsed)) onEvent(parsed);
  };

  void (async () => {
    while (!signal.aborted) {
      try {
        const reader = (await api.stream('/events', signal)).getReader();
        const decoder = new TextDecoder();
        const parser = createParser({ onEvent: (message) => handle(message) });
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          parser.feed(decoder.decode(value, { stream: true }));
        }
      } catch (err) {
        if (signal.aborted) break;
        // Signed out: the app is leaving this page anyway.
        if (err instanceof ApiError && err.status === 401) break;
      }
      onStatus(false);
      // Jitter spreads reconnects out after a server restart.
      await wait(delay * (0.5 + Math.random() / 2), signal);
      delay = Math.min(delay * 2, maxDelayMs);
    }
  })();

  return () => controller.abort();
}
