import { useQueryClient } from '@tanstack/react-query';
import { createElement, useCallback, useRef, useState } from 'react';
import { paymentsApi } from '../api/payments';
import { useAuth } from '../auth/AuthProvider';
import { describeError } from '../auth/errors';
import { useOptionalFlash, type FlashInput } from '../settings/flash';
import { useSnackbar } from '../ui/Snackbar';
import { CheckoutOverlay, type PreparingCheckout } from './CheckoutOverlay';
import { formatRupees, planById, type BillingInterval, type PlanId } from './plans';
import { openRazorpayCheckout } from './razorpay';

// Upgrading: start a subscription, pay in Razorpay's checkout, confirm it, and say how it went
// in a banner (v2) or the snackbar (v1).
export function useCheckout() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const flash = useOptionalFlash();
  const snackbar = useSnackbar();
  const [busy, setBusy] = useState<PlanId | null>(null);
  // While checkout is being prepared; cancelling it means Razorpay's window never opens.
  const [preparing, setPreparing] = useState<PreparingCheckout | null>(null);
  const cancelled = useRef(false);
  const cancelPreparing = useCallback(() => {
    cancelled.current = true;
    setPreparing(null);
  }, []);

  // Plain text, so the snackbar (v1) can show it too.
  const notify = (message: FlashInput & { header?: string; content: string }) => {
    if (flash) return flash(message);
    snackbar({
      text: [message.header, message.content].filter(Boolean).join(' '),
      ...(message.action && { action: message.action }),
    });
  };

  async function upgrade(plan: PlanId, interval: BillingInterval) {
    if (busy) return;
    const name = planById(plan).name;
    const again = { label: 'Try again', onClick: () => void upgrade(plan, interval) };
    const details = planById(plan);
    setBusy(plan);
    cancelled.current = false;
    setPreparing({
      planName: name,
      price:
        interval === 'annual'
          ? `${formatRupees(details.annualMonthlyPrice * 12)}/year`
          : `${formatRupees(details.monthlyPrice)}/month`,
    });
    try {
      const session = await paymentsApi.checkout(api, plan, interval);
      if (cancelled.current) return;
      const outcome = await openRazorpayCheckout({
        keyId: session.keyId,
        subscriptionId: session.subscriptionId,
        description: `${name} plan, billed ${interval === 'annual' ? 'yearly' : 'monthly'}`,
        email: session.email,
        onOpen: () => setPreparing(null),
      });
      if (outcome.kind === 'dismissed') {
        notify({
          type: 'info',
          tone: 'burgundy',
          content: "Checkout closed. You weren't charged.",
        });
        return;
      }
      if (outcome.kind === 'failed') {
        notify({
          type: 'error',
          header: "Payment didn't go through.",
          content: `${outcome.reason} Please try again.`,
          action: again,
        });
        return;
      }
      await paymentsApi.confirm(api, {
        paymentId: outcome.paymentId,
        subscriptionId: outcome.subscriptionId,
        signature: outcome.signature,
      });
      await queryClient.invalidateQueries({ queryKey: ['payments'] });
      notify({
        type: 'success',
        header: `You're on ${name}.`,
        content: 'Payment received and your plan is active.',
      });
    } catch (error) {
      if (cancelled.current) return;
      notify({
        type: 'error',
        header: `Couldn't start ${name}.`,
        content: describeError(error),
        action: again,
      });
    } finally {
      setPreparing(null);
      setBusy(null);
    }
  }

  const overlay = createElement(CheckoutOverlay, { preparing, onCancel: cancelPreparing });
  return { upgrade, busy, notify, overlay };
}
