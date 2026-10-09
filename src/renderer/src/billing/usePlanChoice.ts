import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useSubscription } from '../api/payments';
import type { BillingInterval, Plan, PlanId } from './plans';
import { useCheckout } from './useCheckout';

// A subscription that holds a paid plan, even while a renewal is being retried.
const HOLDS_PLAN = new Set(['authenticated', 'active', 'pending', 'halted']);

// The plans page's state, shared by every layout: the period shown, the plan the user is on,
// and choosing another.
export function usePlanChoice() {
  const navigate = useNavigate();
  const subscription = useSubscription();
  const { upgrade, busy, notify } = useCheckout();
  const [interval, setBillingInterval] = useState<BillingInterval>('monthly');
  const paid =
    subscription.data && HOLDS_PLAN.has(subscription.data.status) ? subscription.data : null;
  const current: PlanId = paid?.plan ?? 'FREE';

  const choose = (plan: Plan) => {
    if (plan.id !== 'FREE') return void upgrade(plan.id, interval);
    notify({
      type: 'info',
      header: 'Moving to Free',
      content: 'Cancel your plan in Billing; it stays active until the end of the paid period.',
      action: { label: 'Open Billing', onClick: () => void navigate('/settings/billing') },
    });
  };

  return { interval, setBillingInterval, current, choose, busy };
}
