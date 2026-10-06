import { ApiError } from '../api/client';

export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'RATE_LIMITED')
      return 'Too many attempts. Please wait a minute and try again.';
    if (error.status >= 500) return 'OneBox is having trouble right now. Please try again.';
    return error.message;
  }
  return 'Could not reach OneBox. Check your connection and try again.';
}
