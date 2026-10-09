import { useQueryClient } from '@tanstack/react-query';
import { createElement, useCallback, useRef, useState } from 'react';
import { paymentsApi, usePaymentProviders, type PaymentProvider } from '../api/payments';
import { useAuth } from '../auth/AuthProvider';
import { describeError } from '../auth/errors';
import { useOptionalFlash, type FlashInput } from '../settings/flash';
import { useSnackbar } from '../ui/Snackbar';
import { refreshBilling } from './billing';
import { CheckoutOverlay, type CheckoutStep } from './CheckoutOverlay';
import { formatRupees, planById, type BillingInterval, type PlanId } from './plans';
import { openInBrowser } from './openInBrowser';
import { openRazorpayCheckout } from './razorpay';

const POLL_MS = 2_000;
// Stop waiting on a Stripe tab after this long; a later payment still starts the plan.
const WAIT_LIMIT_MS = 30 * 60_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const deadline = () => Date.now() + WAIT_LIMIT_MS;
const before = (until: number) => Date.now() < until;

// Upgrading: pick a provider when there are several, pay in its checkout (Razorpay's window in
// the app, or Stripe's page in the browser), and say how it went in a banner (v2) or the
// snackbar (v1).
export function useCheckout() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const providers = usePaymentProviders();
  const flash = useOptionalFlash();
  const snackbar = useSnackbar();
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [step, setStep] = useState<CheckoutStep | null>(null);
  // The plan waiting on a provider choice.
  const [choosing, setChoosing] = useState<{ plan: PlanId; interval: BillingInterval } | null>(
    null,
  );
  // Each checkout's number; cancelling moves it on, so an older flow knows to stop.
  const run = useRef(0);

  // Plain text, so the snackbar (v1) can show it too.
  const notify = (message: FlashInput & { header?: string; content: string }) => {
    if (flash) return flash(message);
    snackbar({
      text: [message.header, message.content].filter(Boolean).join(' '),
      ...(message.action && { action: message.action }),
    });
  };

  const purchase = (plan: PlanId, interval: BillingInterval) => {
    const details = planById(plan);
    return {
      planName: details.name,
      price:
        interval === 'annual'
          ? `${formatRupees(details.annualMonthlyPrice * 12)}/year`
          : `${formatRupees(details.monthlyPrice)}/month`,
    };
  };

  const activated = async (name: string) => {
    await queryClient.invalidateQueries({ queryKey: ['payments'] });
    refreshBilling(queryClient);
    notify({
      type: 'success',
      header: `You're on ${name}.`,
      content: 'Payment received and your plan is active.',
    });
  };

  async function payWithRazorpay(
    session: { keyId: string; subscriptionId: string; email: string },
    name: string,
    interval: BillingInterval,
    again: { label: string; onClick: () => void },
  ) {
    const outcome = await openRazorpayCheckout({
      keyId: session.keyId,
      subscriptionId: session.subscriptionId,
      description: `${name} plan, billed ${interval === 'annual' ? 'yearly' : 'monthly'}`,
      email: session.email,
      onOpen: () => setStep(null),
    });
    if (outcome.kind === 'dismissed') {
      notify({ type: 'info', tone: 'burgundy', content: "Checkout closed. You weren't charged." });
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
    await activated(name);
  }

  // Stripe's page is in another tab, so the app asks until the payment shows up.
  async function waitForStripe(sessionId: string, name: string, stopped: () => boolean) {
    const until = deadline();
    let failures = 0;
    while (before(until)) {
      await sleep(POLL_MS);
      if (stopped()) return;
      try {
        const status = await paymentsApi.checkoutStatus(api, sessionId);
        failures = 0;
        if (status.state === 'paid') return activated(name);
        if (status.state === 'expired') {
          notify({
            type: 'info',
            tone: 'burgundy',
            content: "Checkout expired. You weren't charged.",
          });
          return;
        }
      } catch (error) {
        if (++failures >= 5) throw error;
      }
    }
    if (!stopped()) {
      notify({
        type: 'info',
        tone: 'amber',
        content: 'Stopped waiting for checkout. If you finish paying, your plan starts on its own.',
      });
    }
  }

  async function pay(plan: PlanId, interval: BillingInterval, provider?: PaymentProvider) {
    const shown = purchase(plan, interval);
    const again = { label: 'Try again', onClick: () => void upgrade(plan, interval) };
    const mine = ++run.current;
    const stopped = () => run.current !== mine;
    setBusy(plan);
    setStep({ kind: 'preparing', provider: provider ?? 'RAZORPAY', ...shown });
    try {
      const session = await paymentsApi.checkout(api, plan, interval, provider);
      if (stopped()) return;
      if (session.provider === 'RAZORPAY') {
        await payWithRazorpay(session, shown.planName, interval, again);
        return;
      }
      setStep({
        kind: openInBrowser(session.url) ? 'waiting' : 'ready',
        url: session.url,
        ...shown,
      });
      await waitForStripe(session.sessionId, shown.planName, stopped);
    } catch (error) {
      if (stopped()) return;
      notify({
        type: 'error',
        header: `Couldn't start ${shown.planName}.`,
        content: describeError(error),
        action: again,
      });
    } finally {
      if (!stopped()) {
        setStep(null);
        setBusy(null);
      }
    }
  }

  function upgrade(plan: PlanId, interval: BillingInterval) {
    if (busy) return;
    const available = providers.data ?? [];
    if (available.length > 1) {
      setChoosing({ plan, interval });
      setBusy(plan);
      setStep({ kind: 'choose', ...purchase(plan, interval) });
      return;
    }
    void pay(plan, interval, available[0]);
  }

  const pick = useCallback(
    (provider: PaymentProvider) => {
      setChoosing(null);
      if (choosing) void pay(choosing.plan, choosing.interval, provider);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pay is rebuilt each render
    [choosing],
  );

  const cancel = useCallback(() => {
    run.current++;
    setChoosing(null);
    if (step?.kind === 'waiting' || step?.kind === 'ready') {
      notify({
        type: 'info',
        tone: 'burgundy',
        content: 'Stopped waiting for checkout. If you finish paying, your plan starts on its own.',
      });
    }
    setStep(null);
    setBusy(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- notify is rebuilt each render
  }, [step]);

  const overlay = createElement(CheckoutOverlay, {
    step,
    onCancel: cancel,
    onPick: pick,
    onOpen: () => {
      if (step?.kind !== 'waiting' && step?.kind !== 'ready') return;
      openInBrowser(step.url);
      setStep({ ...step, kind: 'waiting' });
    },
  });
  return { upgrade, busy, notify, overlay };
}
