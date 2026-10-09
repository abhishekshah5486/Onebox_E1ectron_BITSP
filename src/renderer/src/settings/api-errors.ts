import { ApiError } from '../api/client';
import { describeError } from '../auth/errors';

// Field names an API error code belongs to, so forms can show it beside the right input.
const FIELD_BY_CODE: Record<string, string> = {
  ACCOUNT_EXISTS: 'emailAddress',
  HOST_NOT_ALLOWED: 'host',
  HOST_NOT_FOUND: 'host',
  INVALID_SLACK_WEBHOOK: 'url',
  INSECURE_URL: 'url',
  INTEGRATION_EXISTS: 'name',
};

const FIELD_BY_CONNECTION_REASON: Record<string, string> = {
  AUTH_FAILED: 'password',
  UNREACHABLE: 'host',
  TLS_ERROR: 'host',
};

export interface FieldError {
  field: string | null;
  message: string;
}

export function toFieldError(error: unknown): FieldError {
  const message = describeError(error);
  if (!(error instanceof ApiError)) return { field: null, message };
  if (error.code === 'CONNECTION_FAILED') {
    const reason = (error.details as { reason?: string } | undefined)?.reason ?? '';
    return { field: FIELD_BY_CONNECTION_REASON[reason] ?? null, message };
  }
  return { field: FIELD_BY_CODE[error.code] ?? null, message };
}
