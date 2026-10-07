import { describe, expect, it } from 'vitest';
import { ApiError } from './client';
import { createQueryClient } from './queries';

describe('query client retry policy', () => {
  const retry = createQueryClient().getDefaultOptions().queries!.retry as (
    failures: number,
    error: unknown,
  ) => boolean;

  it('does not retry client errors', () => {
    expect(retry(0, new ApiError(404, 'NOT_FOUND', 'x'))).toBe(false);
    expect(retry(0, new ApiError(422, 'CONNECTION_FAILED', 'x'))).toBe(false);
  });

  it('retries server and network errors twice', () => {
    expect(retry(0, new ApiError(503, 'UPSTREAM_UNAVAILABLE', 'x'))).toBe(true);
    expect(retry(1, new TypeError('fetch failed'))).toBe(true);
    expect(retry(2, new TypeError('fetch failed'))).toBe(false);
  });
});
