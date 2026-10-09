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

export type PaymentProvider = 'RAZORPAY' | 'STRIPE';

interface CheckoutBase {
  plan: PlanId;
  interval: BillingInterval;
  amount: number;
  currency: string;
  email: string;
}

// What the provider's checkout needs: Razorpay's opens in the app, Stripe's is a hosted page.
export type CheckoutSession =
  | (CheckoutBase & { provider: 'RAZORPAY'; keyId: string; subscriptionId: string })
  | (CheckoutBase & { provider: 'STRIPE'; sessionId: string; url: string });

export interface CheckoutStatus {
  state: 'open' | 'paid' | 'expired';
  subscription: Subscription | null;
}

export interface PaymentRecord {
  id: string;
  provider: PaymentProvider;
  amount: number;
  currency: string;
  status: 'captured' | 'failed' | 'refunded';
  method: string | null;
  failureReason: string | null;
  createdAt: string;
}

export const paymentsApi = {
  providers: async (api: ApiClient) =>
    (await api.get<{ providers: PaymentProvider[] }>('/payments/config')).providers,
  checkout: (api: ApiClient, plan: PlanId, interval: BillingInterval, provider?: PaymentProvider) =>
    api.post<CheckoutSession>('/payments/checkout', { plan, interval, provider }),
  checkoutStatus: (api: ApiClient, id: string) =>
    api.get<CheckoutStatus>(`/payments/checkout/${encodeURIComponent(id)}/status`),
  confirm: (
    api: ApiClient,
    input: { paymentId: string; subscriptionId: string; signature: string },
  ) => api.post<Subscription>('/payments/checkout/confirm', input),
  subscription: async (api: ApiClient) =>
    (await api.get<{ subscription: Subscription | null }>('/payments/subscription')).subscription,
  cancel: (api: ApiClient) => api.post<Subscription>('/payments/subscription/cancel'),
  change: (api: ApiClient, plan: PlanId, interval: BillingInterval) =>
    api.post<Subscription>('/payments/subscription/change', { plan, interval }),
  portal: (api: ApiClient) => api.post<{ url: string }>('/payments/portal'),
  history: async (api: ApiClient) =>
    (await api.get<{ items: PaymentRecord[] }>('/payments/history')).items,
};

export const paymentKeys = {
  providers: ['payments', 'providers'] as const,
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

// Which providers can take payments; the choice is offered when there are several.
export function usePaymentProviders() {
  const { api } = useAuth();
  return useQuery({
    queryKey: paymentKeys.providers,
    queryFn: () => paymentsApi.providers(api),
    staleTime: 5 * 60_000,
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
