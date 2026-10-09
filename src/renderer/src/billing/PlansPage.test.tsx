import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../auth/AuthProvider';
import { fakeApi, testUser } from '../test/fake-api';
import { renderPage } from '../test/render';
import { SnackbarProvider } from '../ui/Snackbar';
import { BillingSection } from './BillingSection';
import { PlansPage } from './PlansPage';

function Signed({ children }: { children: React.ReactNode }) {
  return useAuth().state.status === 'authenticated' ? (
    <SnackbarProvider>{children}</SnackbarProvider>
  ) : null;
}

const render = (ui: React.ReactNode) =>
  renderPage(<Signed>{ui}</Signed>, {
    path: '/plans',
    api: fakeApi({ restoreSession: vi.fn(async () => testUser) }),
  });

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

  it('marks the current plan and says payments are coming when upgrading', async () => {
    render(<PlansPage />);
    expect(await screen.findByRole('button', { name: 'Current plan' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Upgrade to Pro' }));
    expect(await screen.findByText(/Payments are coming soon/)).toBeInTheDocument();
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
});

describe('BillingSection', () => {
  it('shows the plan, the credits left and the history', async () => {
    render(<BillingSection />);
    expect(await screen.findByText('Billing preview')).toBeInTheDocument();
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
});
