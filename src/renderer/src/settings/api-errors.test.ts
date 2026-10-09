import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/client';
import { toFieldError } from './api-errors';

describe('toFieldError', () => {
  it.each([
    ['AUTH_FAILED', 'password'],
    ['UNREACHABLE', 'host'],
    ['TLS_ERROR', 'host'],
  ])('puts a %s connection failure on the %s field', (reason, field) => {
    const error = new ApiError(422, 'CONNECTION_FAILED', 'Nope', { reason });
    expect(toFieldError(error)).toEqual({ field, message: 'Nope' });
  });

  it('maps known codes to fields', () => {
    expect(toFieldError(new ApiError(409, 'ACCOUNT_EXISTS', 'Dup')).field).toBe('emailAddress');
    expect(toFieldError(new ApiError(400, 'INSECURE_URL', 'http')).field).toBe('url');
  });

  it('falls back to a form-level message', () => {
    expect(toFieldError(new ApiError(409, 'ACCOUNT_LIMIT_REACHED', 'Max 20'))).toEqual({
      field: null,
      message: 'Max 20',
    });
    expect(toFieldError(new TypeError('fetch failed')).field).toBeNull();
  });
});
