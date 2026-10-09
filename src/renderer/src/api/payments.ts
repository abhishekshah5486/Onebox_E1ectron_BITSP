import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import type { BillingInterval, PlanId } from '../billing/plans';
import type { ApiClient } from './client';

export type SubscriptionStatus =
  | 'created'
  | 'authenticated'
  | 'active'
  | 'pending'
  | 'halted'
  | 'cancelled'
  | 'completed'
  | 'expired';

export interface Subscription {
  id: string;
  provider: 'RAZORPAY' | 'STRIPE';
  plan: PlanId;
  interval: BillingInterval;
  status: SubscriptionStatus;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
}

// What Razorpay's checkout needs to open for a new subscription.
export interface CheckoutSession {
  provider: 'RAZORPAY';
  keyId: string;
  subscriptionId: string;
  plan: PlanId;
  interval: BillingInterval;
  amount: number;
  currency: string;
  email: string;
}

export interface PaymentRecord {
  id: string;
  amount: number;
  currency: string;
  status: 'captured' | 'failed' | 'refunded';
  method: string | null;
  failureReason: string | null;
  createdAt: string;
}

export const paymentsApi = {
  config: (api: ApiClient) => api.get<{ providers: ('RAZORPAY' | 'STRIPE')[] }>('/payments/config'),
  checkout: (api: ApiClient, plan: PlanId, interval: BillingInterval) =>
    api.post<CheckoutSession>('/payments/checkout', { plan, interval }),
  confirm: (
    api: ApiClient,
    input: { paymentId: string; subscriptionId: string; signature: string },
  ) => api.post<Subscription>('/payments/checkout/confirm', input),
  subscription: async (api: ApiClient) =>
    (await api.get<{ subscription: Subscription | null }>('/payments/subscription')).subscription,
  cancel: (api: ApiClient) => api.post<Subscription>('/payments/subscription/cancel'),
  history: async (api: ApiClient) =>
    (await api.get<{ items: PaymentRecord[] }>('/payments/history')).items,
};

export const paymentKeys = {
  subscription: ['payments', 'subscription'] as const,
  history: ['payments', 'history'] as const,
};

export function useSubscription() {
  const { api } = useAuth();
  return useQuery({
    queryKey: paymentKeys.subscription,
    queryFn: () => paymentsApi.subscription(api),
  });
}

export function usePaymentHistory() {
  const { api } = useAuth();
  return useQuery({ queryKey: paymentKeys.history, queryFn: () => paymentsApi.history(api) });
}

export function useCancelSubscription() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => paymentsApi.cancel(api),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['payments'] }),
  });
}
