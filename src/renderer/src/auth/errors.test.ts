import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/client';
import { describeError } from './errors';

describe('describeError', () => {
  it('hides server failures behind a general message', () => {
    expect(describeError(new ApiError(502, 'EXTERNAL_SERVICE_ERROR', 'upstream said no'))).toBe(
      'OneBox is having trouble right now. Please try again.',
    );
  });

  it('passes on why a payment provider is unavailable', () => {
    const message = "Razorpay subscriptions aren't turned on for this account yet.";
    expect(describeError(new ApiError(503, 'PROVIDER_UNAVAILABLE', message))).toBe(message);
  });
});
