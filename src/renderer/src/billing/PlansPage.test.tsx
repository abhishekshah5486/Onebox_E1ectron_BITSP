import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { FlashProvider } from '../settings/flash';
import { fakeApi, routedGet, testUser } from '../test/fake-api';
import { renderPage } from '../test/render';
import { SnackbarProvider } from '../ui/Snackbar';
import { BillingSection } from './BillingSection';
import { PlansPage } from './PlansPage';

function Signed({ children }: { children: React.ReactNode }) {
  return useAuth().state.status === 'authenticated' ? (
    <SnackbarProvider>{children}</SnackbarProvider>
  ) : null;
}

const render = (ui: React.ReactNode, overrides: Partial<ApiClient> = {}) =>
  renderPage(<Signed>{ui}</Signed>, {
    path: '/plans',
    api: fakeApi({ restoreSession: vi.fn(async () => testUser), ...overrides }),
  });

// Both providers set up; Stripe's checkout is a page in a new tab, paid once the test says so.
function stripeSetup(paid: { current: boolean }) {
  const tab = { document: { title: '' }, location: { href: '' }, closed: false, close: vi.fn() };
  const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
  const get = routedGet({
    '/payments/config': () => ({ providers: ['RAZORPAY', 'STRIPE'] }),
    '/payments/checkout/cs_1/status': () =>
      paid.current
        ? { state: 'paid', subscription: { id: 's1', plan: 'PRO', status: 'active' } }
        : { state: 'open', subscription: null },
  });
  const post = vi.fn(async () => ({
    provider: 'STRIPE',
    sessionId: 'cs_1',
    url: 'https://checkout.stripe.com/c/cs_1',
    plan: 'PRO',
    interval: 'monthly',
    amount: 149_900,
    currency: 'INR',
    email: 'a@onebox.dev',
  }));
  return { tab, open, get, post: post as unknown as ApiClient['post'] };
}

const providersLoaded = async (get: ApiClient['get']) => {
  await vi.waitFor(() => expect(get).toHaveBeenCalledWith('/payments/config'));
  await new Promise((resolve) => setTimeout(resolve, 0));
};

describe('PlansPage in v1 (showcase)', () => {
  it('shows monthly prices, then yearly ones with the saving', async () => {
    render(<PlansPage />);
    const standard = (await screen.findByRole('heading', { name: /Standard/ })).closest('article')!;
    expect(within(standard).getByText('₹499')).toBeInTheDocument();
    expect(within(standard).getByText('Billed monthly')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: /Annually/ }));
    expect(within(standard).getByText('₹415')).toBeInTheDocument();
    expect(within(standard).getByText('Save ₹1,008')).toBeInTheDocument();
    // Free has no yearly price, so it is not listed.
    expect(screen.queryByRole('heading', { name: /^Free/ })).toBeNull();
  });

  // Stands in for Razorpay's checkout: pays, or is closed, as the test asks.
  function fakeRazorpay(outcome: 'paid' | 'dismissed') {
    window.Razorpay = class {
      constructor(private options: Record<string, unknown>) {}
      on() {}
      open() {
        if (outcome === 'paid') {
          (this.options.handler as (r: Record<string, string>) => void)({
            razorpay_payment_id: 'pay_1',
            razorpay_subscription_id: 'sub_1',
            razorpay_signature: 'sig',
          });
        } else {
          (this.options.modal as { ondismiss: () => void }).ondismiss();
        }
      }
    };
  }

  const checkoutApi = () =>
    vi.fn(async (path: string) =>
      path === '/payments/checkout'
        ? {
            provider: 'RAZORPAY',
            keyId: 'rzp_test_key',
            subscriptionId: 'sub_1',
            plan: 'PRO',
            interval: 'monthly',
            amount: 149_900,
            currency: 'INR',
            email: 'a@onebox.dev',
          }
        : { id: 's1', plan: 'PRO', status: 'active' },
    );

  it('upgrades through checkout and confirms the payment', async () => {
    fakeRazorpay('paid');
    const post = checkoutApi();
    render(<PlansPage />, { post: post as ApiClient['post'] });
    expect(await screen.findByRole('button', { name: 'Current plan' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Upgrade to Pro' }));

    expect(await screen.findByText(/You're on Pro/)).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith('/payments/checkout', {
      plan: 'PRO',
      interval: 'monthly',
      provider: 'RAZORPAY',
    });
    expect(post).toHaveBeenCalledWith('/payments/checkout/confirm', {
      paymentId: 'pay_1',
      subscriptionId: 'sub_1',
      signature: 'sig',
    });
    delete window.Razorpay;
  });

  it('explains the wait, and cancelling it keeps checkout from opening', async () => {
    const opened = vi.fn();
    window.Razorpay = class {
      on() {}
      open = opened;
    };
    let answer!: (session: unknown) => void;
    const post = vi.fn(() => new Promise((resolve) => (answer = resolve)));
    render(<PlansPage />, { post: post as unknown as ApiClient['post'] });
    await userEvent.click(await screen.findByRole('button', { name: 'Upgrade to Pro' }));

    const waiting = await screen.findByRole('dialog', { name: 'Opening secure checkout' });
    expect(within(waiting).getByText(/pay for Pro \(₹1,499\/month\)/)).toBeInTheDocument();
    await userEvent.click(within(waiting).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Opening secure checkout' })).toBeNull();

    answer({ provider: 'RAZORPAY', keyId: 'k', subscriptionId: 'sub_1', email: 'a@onebox.dev' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(opened).not.toHaveBeenCalled();
    delete window.Razorpay;
  });

  it("asks how to pay, then waits for Stripe's page in another tab", async () => {
    const paid = { current: false };
    const { tab, open, get, post } = stripeSetup(paid);
    render(<PlansPage />, { get, post });
    await providersLoaded(get);
    await userEvent.click(await screen.findByRole('button', { name: 'Upgrade to Pro' }));

    const choose = await screen.findByRole('dialog', { name: 'Choose how to pay' });
    await userEvent.click(within(choose).getByRole('button', { name: /Stripe/ }));
    expect(post).toHaveBeenCalledWith('/payments/checkout', {
      plan: 'PRO',
      interval: 'monthly',
      provider: 'STRIPE',
    });
    expect(
      await screen.findByRole('dialog', { name: 'Finish paying in your browser' }),
    ).toBeInTheDocument();
    expect(tab.location.href).toBe('https://checkout.stripe.com/c/cs_1');

    paid.current = true;
    expect(await screen.findByText(/You're on Pro/, {}, { timeout: 5_000 })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Finish paying in your browser' })).toBeNull();
    open.mockRestore();
  });

  it('says nothing was charged when checkout is closed', async () => {
    fakeRazorpay('dismissed');
    const post = checkoutApi();
    render(<PlansPage />, { post: post as ApiClient['post'] });
    await userEvent.click(await screen.findByRole('button', { name: 'Upgrade to Pro' }));
    expect(await screen.findByText(/You weren't charged/)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalledWith('/payments/checkout/confirm', expect.anything());
    delete window.Razorpay;
  });
});

describe('PlansPage in v2 (console)', () => {
  beforeEach(() => localStorage.setItem('onebox.ui-version', 'v2'));
  afterEach(() => localStorage.removeItem('onebox.ui-version'));

  it('switches to yearly prices with the toggle and offers the plans as console buttons', async () => {
    render(<PlansPage />);
    expect(await screen.findByRole('heading', { name: 'Plans', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('₹499', { exact: false })).toHaveTextContent('₹499/month');

    await userEvent.click(screen.getByRole('checkbox', { name: /Pay annually/ }));
    expect(screen.getByText('₹415', { exact: false })).toHaveTextContent('₹415/month');
    expect(screen.queryByRole('button', { name: 'Current plan' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Choose Pro' })).toBeEnabled();
    // The comparison follows the cards, without Free when billing yearly.
    const compare = within(screen.getByRole('table'));
    expect(compare.getByText('Priority support')).toBeInTheDocument();
    expect(compare.queryByRole('columnheader', { name: 'Free' })).toBeNull();
  });
  it('picks Stripe from the tiles and stops waiting when cancelled', async () => {
    const { open, get, post } = stripeSetup({ current: false });
    render(
      <FlashProvider>
        <PlansPage />
      </FlashProvider>,
      { get, post },
    );
    await providersLoaded(get);
    await userEvent.click(await screen.findByRole('button', { name: 'Choose Pro' }));

    const choose = within(await screen.findByRole('dialog', { name: 'Choose how to pay' }));
    await userEvent.click(choose.getByRole('radio', { name: /Stripe/ }));
    await userEvent.click(choose.getByRole('button', { name: 'Continue' }));

    const waiting = within(
      await screen.findByRole('dialog', { name: 'Finish paying in your browser' }),
    );
    await userEvent.click(waiting.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByText(/Stopped waiting for checkout/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose Pro' })).toBeEnabled();
    open.mockRestore();
  });
});

describe('BillingSection', () => {
  it('shows the plan, the credits left and the history', async () => {
    render(
      <FlashProvider>
        <BillingSection />
      </FlashProvider>,
    );
    expect(await screen.findByText('Credits preview')).toBeInTheDocument();
    expect(await screen.findByText(/You're on the Free plan/)).toBeInTheDocument();
    expect(await screen.findByText('Credits and usage')).toBeInTheDocument();
    expect(await screen.findByText(/of 20 credits/)).toBeInTheDocument();
    expect(screen.getAllByText('Free').length).toBeGreaterThan(0);
    // Newest first, ten to a page: the sign-up grant is on the second page.
    expect(screen.getAllByText('Sorted an email into labels').length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: /page 2/i }));
    expect(await screen.findByText('Free plan credits')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actions' })).toBeEnabled();
    expect(screen.getByRole('link', { name: 'View all plans' })).toBeInTheDocument();
  });

  it('shows a paid plan and cancels it at the end of the period after asking', async () => {
    const subscription = {
      id: 's1',
      provider: 'RAZORPAY',
      plan: 'STANDARD',
      interval: 'monthly',
      status: 'active',
      currentPeriodStart: '2026-10-09T00:00:00.000Z',
      currentPeriodEnd: '2026-11-09T00:00:00.000Z',
      cancelAtPeriodEnd: false,
      createdAt: '2026-10-09T00:00:00.000Z',
    };
    const post = vi.fn(async () => ({ ...subscription, cancelAtPeriodEnd: true }));
    render(
      <FlashProvider>
        <BillingSection />
      </FlashProvider>,
      {
        get: routedGet({
          '/payments/subscription': () => ({ subscription }),
          '/payments/history': () => ({
            items: [
              {
                id: 'p1',
                amount: 49_900,
                currency: 'INR',
                status: 'captured',
                method: 'upi',
                failureReason: null,
                createdAt: '2026-10-09T00:00:00.000Z',
              },
            ],
          }),
        }),
        post: post as ApiClient['post'],
      },
    );
    expect(await screen.findByText('Active')).toBeInTheDocument();
    expect(screen.getByText('UPI')).toBeInTheDocument();

    // The subscription's Actions come first, above the credits'.
    await userEvent.click(screen.getAllByRole('button', { name: 'Actions' })[0]!);
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Cancel subscription' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Cancel subscription' }));
    await userEvent.click(dialog.getByRole('button', { name: 'Cancel subscription' }));
    expect(post).toHaveBeenCalledWith('/payments/subscription/cancel');
    expect(await screen.findByText(/plan is cancelled/)).toBeInTheDocument();
  });
});
