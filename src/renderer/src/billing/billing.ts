import { useQuery, type QueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import type { BillingInterval, PlanId } from './plans';

export interface Subscription {
  plan: PlanId;
  interval: BillingInterval | null;
  // free: no paid plan. past_due: a renewal failed and is being retried. halted: retries ran
  // out, so AI features are paused until it is paid.
  status: 'free' | 'active' | 'past_due' | 'halted';
  // When the monthly credits next reset; null for Free.
  renewsAt: string | null;
}

export interface LedgerEntry {
  id: string;
  at: string;
  kind: 'grant' | 'charge' | 'refund' | 'expiry';
  description: string;
  model: string | null;
  // e.g. perplexity/glm-5.3-flash, for the maker's logo; missing on older entries.
  modelId: string | null;
  // Positive for credits added, negative for credits used.
  credits: number;
  balanceAfter: number;
}

export interface Billing {
  subscription: Subscription;
  balance: number;
  // Credits granted in the current period, for the progress bar.
  periodCredits: number;
  ledger: LedgerEntry[];
}

export const billingKey = ['billing'] as const;

export function useBilling() {
  const { api } = useAuth();
  return useQuery({ queryKey: billingKey, queryFn: () => api.get<Billing>('/billing') });
}

// Credits follow a payment through a queue, so they're read again once they've had time to land.
export function refreshBilling(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: billingKey });
  setTimeout(() => void queryClient.invalidateQueries({ queryKey: billingKey }), 2_500);
}
