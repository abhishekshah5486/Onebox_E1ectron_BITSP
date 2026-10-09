import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { paymentsApi } from '../api/payments';
import { useAuth } from '../auth/AuthProvider';
import { describeError } from '../auth/errors';
import { useOptionalFlash, type FlashInput } from '../settings/flash';
import { useSnackbar } from '../ui/Snackbar';
import { planById, type BillingInterval, type PlanId } from './plans';
import { openRazorpayCheckout } from './razorpay';

// Upgrading: start a subscription, pay in Razorpay's checkout, confirm it, and say how it went
// in a banner (v2) or the snackbar (v1).
export function useCheckout() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const flash = useOptionalFlash();
  const snackbar = useSnackbar();
  const [busy, setBusy] = useState<PlanId | null>(null);

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
    setBusy(plan);
    try {
      const session = await paymentsApi.checkout(api, plan, interval);
      const outcome = await openRazorpayCheckout({
        keyId: session.keyId,
        subscriptionId: session.subscriptionId,
        description: `${name} plan, billed ${interval === 'annual' ? 'yearly' : 'monthly'}`,
        email: session.email,
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
      notify({
        type: 'error',
        header: `Couldn't start ${name}.`,
        content: describeError(error),
        action: again,
      });
    } finally {
      setBusy(null);
    }
  }

  return { upgrade, busy, notify };
}
