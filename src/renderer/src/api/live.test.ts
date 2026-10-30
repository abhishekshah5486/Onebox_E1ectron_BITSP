import { describe, expect, it, vi } from 'vitest';
import { ApiError } from './client';
import { connectLive, type LiveEvent } from './live';

const encoder = new TextEncoder();

// A server stream that sends these chunks, then stays open or ends.
function serverStream(chunks: string[], { end = false } = {}) {
  return (_path: string, signal: AbortSignal) =>
    Promise.resolve(
      new ReadableStream<Uint8Array>({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
          if (end) controller.close();
          else signal.addEventListener('abort', () => controller.close());
        },
      }),
    );
}

describe('connectLive', () => {
  it('reports when it is live and passes events on, skipping anything malformed', async () => {
    const events: LiveEvent[] = [];
    const status: boolean[] = [];
    const close = connectLive({
      api: {
        stream: vi.fn(
          serverStream([
            'retry: 5000\nevent: ready\ndata: {}\n\n',
            ': ping\n\n',
            'data: {"type":"thread.changed","threadId":"t1","accountId":"a1"}\n\n',
            'data: not json\n\ndata: {"type":"other"}\n\n',
            'data: {"type":"thread.re',
            'moved","threadId":"t2"}\n\n',
          ]),
        ),
      },
      onEvent: (event) => events.push(event),
      onStatus: (connected) => status.push(connected),
    });
    await vi.waitFor(() => expect(events).toHaveLength(2));
    expect(events).toEqual([
      { type: 'thread.changed', threadId: 't1', accountId: 'a1' },
      { type: 'thread.removed', threadId: 't2' },
    ]);
    expect(status).toEqual([true]);
    close();
  });

  it('reconnects after the stream ends or fails', async () => {
    const stream = vi
      .fn()
      .mockImplementationOnce(serverStream(['event: ready\ndata: {}\n\n'], { end: true }))
      .mockRejectedValueOnce(new TypeError('network down'))
      .mockImplementation(serverStream(['event: ready\ndata: {}\n\n']));
    const status: boolean[] = [];
    const close = connectLive({
      api: { stream },
      onEvent: () => {},
      onStatus: (connected) => status.push(connected),
      minDelayMs: 1,
      maxDelayMs: 2,
    });
    await vi.waitFor(() => expect(stream).toHaveBeenCalledTimes(3));
    await vi.waitFor(() => expect(status).toEqual([true, false, false, true]));
    close();
  });

  it('stops once the session has ended', async () => {
    const stream = vi.fn().mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'Signed out'));
    const status: boolean[] = [];
    connectLive({
      api: { stream },
      onEvent: () => {},
      onStatus: (c) => status.push(c),
      minDelayMs: 1,
    });
    await vi.waitFor(() => expect(stream).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(stream).toHaveBeenCalledTimes(1);
    expect(status).toEqual([]);
  });
});
