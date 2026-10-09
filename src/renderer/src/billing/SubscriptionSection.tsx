import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ButtonDropdown from '@cloudscape-design/components/button-dropdown';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator, {
  type StatusIndicatorProps,
} from '@cloudscape-design/components/status-indicator';
import Table from '@cloudscape-design/components/table';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  paymentsApi,
  useCancelSubscription,
  usePaymentHistory,
  useSubscription,
  type PaymentRecord,
  type Subscription,
} from '../api/payments';
import { useAuth } from '../auth/AuthProvider';
import { describeError } from '../auth/errors';
import { useFlash } from '../settings/flash';
import tableStyles from '../ui/DataTable.module.css';
import styles from './BillingSection.module.css';
import { PROVIDER_NAME } from './CheckoutOverlay';
import { ProviderLogo } from './ProviderLogo';
import { openInBrowser } from './openInBrowser';
import { formatRupees, planById } from './plans';

// Subscriptions that still hold a paid plan.
const HOLDS_PLAN = new Set(['authenticated', 'active', 'pending', 'halted']);

const formatDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '–';

function status(sub: Subscription): { type: StatusIndicatorProps.Type; text: string } {
  if (sub.status === 'halted') return { type: 'error', text: 'Payment failed' };
  if (sub.status === 'pending') return { type: 'pending', text: 'Retrying payment' };
  if (sub.cancelAtPeriodEnd)
    return { type: 'warning', text: `Ends ${formatDate(sub.currentPeriodEnd)}` };
  return { type: 'success', text: 'Active' };
}

const PAYMENT_STATUS: Record<PaymentRecord['status'], StatusIndicatorProps.Type> = {
  captured: 'success',
  failed: 'error',
  refunded: 'info',
};

// Settings → Billing: the paid plan, if any, with cancelling and the payments made.
export function SubscriptionSection() {
  const navigate = useNavigate();
  const { api } = useAuth();
  const flash = useFlash();
  const subscription = useSubscription();
  const history = usePaymentHistory();
  const cancel = useCancelSubscription();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const sub =
    subscription.data && HOLDS_PLAN.has(subscription.data.status) ? subscription.data : null;
  const plan = sub ? planById(sub.plan) : null;

  // Stripe's own page for the saved card and invoices, in the browser.
  async function openPortal() {
    try {
      const { url } = await paymentsApi.portal(api);
      if (openInBrowser(url)) return;
      flash({
        type: 'info',
        content: 'Your payment details page is ready.',
        action: { label: 'Open', onClick: () => openInBrowser(url) },
      });
    } catch (error) {
      flash({ type: 'error', content: describeError(error) });
    }
  }
  const shown = sub ? status(sub) : null;

  return (
    <SpaceBetween size="l">
      <Container
        header={
          <Header
            variant="h2"
            description="Manage your plan and payments. Payments are processed securely by Razorpay or Stripe."
            actions={
              sub ? (
                <ButtonDropdown
                  items={[
                    { id: 'plans', text: 'Change plan' },
                    ...(sub.provider === 'STRIPE'
                      ? [{ id: 'card', text: 'Update payment method', external: true }]
                      : []),
                    {
                      id: 'cancel',
                      text: 'Cancel subscription',
                      disabled: sub.cancelAtPeriodEnd,
                      disabledReason: 'Already ends at the end of this period',
                    },
                  ]}
                  onItemClick={({ detail }) => {
                    if (detail.id === 'plans') void navigate('/plans');
                    else if (detail.id === 'card') void openPortal();
                    else setConfirmCancel(true);
                  }}
                >
                  Actions
                </ButtonDropdown>
              ) : (
                <Button variant="primary" onClick={() => void navigate('/plans')}>
                  Upgrade plan
                </Button>
              )
            }
          >
            Subscription
          </Header>
        }
      >
        {subscription.isLoading ? (
          <StatusIndicator type="loading">Loading subscription</StatusIndicator>
        ) : sub && plan && shown ? (
          <ColumnLayout columns={4} variant="text-grid">
            <div>
              <Box variant="awsui-key-label">Plan</Box>
              <span className={styles.valueRow}>
                <Box variant="awsui-value-large">{plan.name}</Box>
                <Box variant="span" color="text-body-secondary">
                  {sub.interval === 'annual'
                    ? `(${formatRupees(plan.annualMonthlyPrice * 12)}/year)`
                    : `(${formatRupees(plan.monthlyPrice)}/month)`}
                </Box>
              </span>
            </div>
            <div>
              <Box variant="awsui-key-label">Status</Box>
              <StatusIndicator type={shown.type}>{shown.text}</StatusIndicator>
            </div>
            <div>
              <Box variant="awsui-key-label">{sub.cancelAtPeriodEnd ? 'Ends on' : 'Renews on'}</Box>
              <div>{formatDate(sub.currentPeriodEnd)}</div>
            </div>
            <div>
              <Box variant="awsui-key-label">Paid with</Box>
              <span className={styles.paidWith}>
                <ProviderLogo provider={sub.provider} size={20} label={false} />
                {PROVIDER_NAME[sub.provider]}
              </span>
            </div>
          </ColumnLayout>
        ) : (
          <Box color="text-body-secondary">
            You're on the Free plan. Upgrade for monthly credits and every AI feature.
          </Box>
        )}
      </Container>

      <div className={`${tableStyles.table} ${tableStyles.static}`}>
        <Table
          variant="container"
          loading={history.isLoading}
          loadingText="Loading payments"
          trackBy="id"
          items={history.data ?? []}
          header={
            <Header
              variant="h2"
              counter={history.data?.length ? `(${history.data.length})` : undefined}
              description="Every payment for your plan"
            >
              Payments
            </Header>
          }
          columnDefinitions={[
            { id: 'date', header: 'Date', cell: (item) => formatDate(item.createdAt) },
            {
              id: 'amount',
              header: 'Amount',
              cell: (item) =>
                item.currency === 'INR'
                  ? formatRupees(item.amount)
                  : `${item.amount} ${item.currency}`,
            },
            {
              id: 'status',
              header: 'Status',
              cell: (item) => (
                <StatusIndicator type={PAYMENT_STATUS[item.status]}>
                  {item.status === 'captured'
                    ? 'Paid'
                    : item.status === 'failed'
                      ? 'Failed'
                      : 'Refunded'}
                </StatusIndicator>
              ),
            },
            {
              id: 'method',
              header: 'Method',
              cell: (item) => item.failureReason ?? item.method?.toUpperCase() ?? '–',
            },
          ]}
          empty={
            <Box textAlign="center" color="inherit" padding="m">
              <b>No payments yet</b>
            </Box>
          }
        />
      </div>

      <Modal
        visible={confirmCancel}
        onDismiss={() => setConfirmCancel(false)}
        header="Cancel subscription"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setConfirmCancel(false)}>
                Keep my plan
              </Button>
              <Button
                variant="primary"
                loading={cancel.isPending}
                onClick={() =>
                  cancel.mutate(undefined, {
                    onSuccess: (updated) => {
                      setConfirmCancel(false);
                      flash({
                        type: 'info',
                        tone: 'burgundy',
                        content: `Your ${plan?.name ?? ''} plan is cancelled. It stays active until ${formatDate(updated.currentPeriodEnd)}.`,
                      });
                    },
                    onError: (error) => flash({ type: 'error', content: describeError(error) }),
                  })
                }
              >
                Cancel subscription
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        Cancel your <b>{plan?.name}</b> plan? It stays active until{' '}
        <b>{formatDate(sub?.currentPeriodEnd ?? null)}</b>, then you move to Free. You won't be
        charged again.
      </Modal>
    </SpaceBetween>
  );
}
