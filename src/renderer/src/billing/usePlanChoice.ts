import { useQueryClient } from '@tanstack/react-query';
import { createElement, Fragment, useState } from 'react';
import { useNavigate } from 'react-router';
import { paymentsApi, useSubscription } from '../api/payments';
import { useAuth } from '../auth/AuthProvider';
import { describeError } from '../auth/errors';
import { refreshBilling } from './billing';
import { ChangePlanDialog, type PlanChange } from './ChangePlanDialog';
import { planById, type BillingInterval, type Plan, type PlanId } from './plans';
import { useCheckout } from './useCheckout';

// A subscription that holds a paid plan, even while a renewal is being retried.
const HOLDS_PLAN = new Set(['authenticated', 'active', 'pending', 'halted']);

// The plans page's state, shared by every layout: the period shown, the plan the user is on,
// and choosing another (checkout from Free, a switch from a paid plan).
export function usePlanChoice() {
  const navigate = useNavigate();
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const subscription = useSubscription();
  const { upgrade, busy: paying, notify, overlay } = useCheckout();
  const [interval, setBillingInterval] = useState<BillingInterval>('monthly');
  const [change, setChange] = useState<PlanChange | null>(null);
  const [switching, setSwitching] = useState<PlanId | null>(null);
  const paid =
    subscription.data && HOLDS_PLAN.has(subscription.data.status) ? subscription.data : null;
  const current: PlanId = paid?.plan ?? 'FREE';
  // Free has one price; a paid plan is current only at the interval it's billed.
  const isCurrent = (plan: PlanId) =>
    plan === current && (plan === 'FREE' || paid?.interval === interval);

  const choose = (plan: Plan) => {
    if (plan.id === 'FREE') {
      notify({
        type: 'info',
        header: 'Moving to Free',
        content: 'Cancel your plan in Billing; it stays active until the end of the paid period.',
        action: { label: 'Open Billing', onClick: () => void navigate('/settings/billing') },
      });
      return;
    }
    if (paid) return setChange({ from: planById(paid.plan), to: plan, interval });
    upgrade(plan.id, interval);
  };

  async function confirmChange() {
    if (!change) return;
    const { to, interval: chosen } = change;
    setChange(null);
    setSwitching(to.id);
    try {
      await paymentsApi.change(api, to.id, chosen);
      await queryClient.invalidateQueries({ queryKey: ['payments'] });
      refreshBilling(queryClient);
      notify({
        type: 'success',
        header: `You're on ${to.name}.`,
        content: 'Your plan changed and its credits are ready.',
      });
    } catch (error) {
      notify({
        type: 'error',
        header: `Couldn't switch to ${to.name}.`,
        content: describeError(error),
      });
    } finally {
      setSwitching(null);
    }
  }

  return {
    interval,
    setBillingInterval,
    current,
    isCurrent,
    choose,
    busy: paying ?? switching,
    overlay: createElement(
      Fragment,
      null,
      overlay,
      createElement(ChangePlanDialog, {
        change,
        onConfirm: () => void confirmChange(),
        onCancel: () => setChange(null),
      }),
    ),
  };
}
