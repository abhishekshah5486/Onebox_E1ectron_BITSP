import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fakeApi } from '../test/fake-api';
import { isLive } from './liveStatus';
import { useLiveUpdates } from './useLiveUpdates';

const encoder = new TextEncoder();
let api = fakeApi();
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ api }) }));

describe('useLiveUpdates', () => {
  it('refreshes the changed conversation and the lists once per burst', async () => {
    api = fakeApi({
      stream: vi.fn(async (_path: string, signal: AbortSignal) => {
        return new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode('event: ready\ndata: {}\n\n'));
            for (const id of ['t1', 't2', 't1']) {
              controller.enqueue(
                encoder.encode(
                  `data: {"type":"thread.changed","threadId":"${id}","accountId":"a"}\n\n`,
                ),
              );
            }
            signal.addEventListener('abort', () => controller.close());
          },
        });
      }),
    });
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { unmount } = renderHook(() => useLiveUpdates(), { wrapper });

    await vi.waitFor(() => expect(invalidate).toHaveBeenCalledTimes(3));
    expect(isLive()).toBe(true);
    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toEqual([['mail', 'thread', 't1'], ['mail', 'thread', 't2'], undefined]);
    const lists = invalidate.mock.calls[2]![0]!.predicate!;
    const query = (queryKey: unknown[]) => ({ queryKey }) as unknown as Parameters<typeof lists>[0];
    expect(lists(query(['mail', 'threads', {}, 1]))).toBe(true);
    expect(lists(query(['mail', 'search', 'keyword', 'x', 1]))).toBe(true);
    expect(lists(query(['mail', 'thread', 't9']))).toBe(false);
    expect(lists(query(['billing']))).toBe(false);

    unmount();
    expect(isLive()).toBe(false);
  });
});
