import { ApiError } from '../api/client';

export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'RATE_LIMITED')
      return 'Too many attempts. Please wait a minute and try again.';
    // A payment provider that can't take payments yet says why, and what to do instead.
    if (error.code === 'PROVIDER_UNAVAILABLE') return error.message;
    if (error.status >= 500) return 'OneBox is having trouble right now. Please try again.';
    return error.message;
  }
  return 'Could not reach OneBox. Check your connection and try again.';
}
