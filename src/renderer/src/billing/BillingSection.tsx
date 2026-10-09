import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import KeyValuePairs from '@cloudscape-design/components/key-value-pairs';
import Pagination from '@cloudscape-design/components/pagination';
import ProgressBar from '@cloudscape-design/components/progress-bar';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Table from '@cloudscape-design/components/table';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import tableStyles from '../ui/DataTable.module.css';
import { IS_BILLING_PREVIEW, useBilling, type LedgerEntry } from './billing';
import { formatCredits, formatRupees, planById } from './plans';

const PAGE = 10;

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

const signed = (credits: number) =>
  `${credits > 0 ? '+' : credits < 0 ? '−' : ''}${formatCredits(Math.abs(credits))}`;

const KIND: Record<LedgerEntry['kind'], string> = {
  grant: 'Added',
  charge: 'Used',
  refund: 'Returned',
  expiry: 'Expired',
};

// Settings → Billing: the plan, the credits left this period and where they went.
export function BillingSection() {
  const navigate = useNavigate();
  const billing = useBilling();
  const [page, setPage] = useState(1);
  const data = billing.data;
  const plan = data ? planById(data.subscription.plan) : null;
  const ledger = data?.ledger ?? [];
  const pages = Math.max(1, Math.ceil(ledger.length / PAGE));
  const used = data ? Math.max(0, data.periodCredits - data.balance) : 0;

  return (
    <SpaceBetween size="l">
      {IS_BILLING_PREVIEW && (
        <Alert type="info" header="Billing preview">
          Plans and credits are being built. The numbers here are examples; payments are not
          connected yet.
        </Alert>
      )}

      <Container
        header={
          <Header
            variant="h2"
            description="Credits pay for AI features such as sorting, summaries and drafts."
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button disabled>Buy credits</Button>
                <Button variant="primary" onClick={() => void navigate('/plans')}>
                  {data?.subscription.plan === 'FREE' ? 'Upgrade plan' : 'Change plan'}
                </Button>
              </SpaceBetween>
            }
          >
            Plan and credits
          </Header>
        }
      >
        {data && plan && (
          <SpaceBetween size="l">
            <KeyValuePairs
              columns={4}
              items={[
                { label: 'Plan', value: <Box fontWeight="bold">{plan.name}</Box> },
                {
                  label: 'Price',
                  value:
                    plan.monthlyPrice === 0
                      ? 'Free'
                      : `${formatRupees(
                          data.subscription.interval === 'annual'
                            ? plan.annualMonthlyPrice
                            : plan.monthlyPrice,
                        )}/mo`,
                },
                {
                  label: plan.monthlyPrice === 0 ? 'Credits' : 'Credits reset on',
                  value: data.subscription.renewsAt
                    ? new Date(data.subscription.renewsAt).toLocaleDateString()
                    : `${formatCredits(plan.credits)} once, at sign-up`,
                },
                { label: 'Credits left', value: formatCredits(data.balance) },
              ]}
            />
            <ProgressBar
              label="Credits used"
              value={data.periodCredits ? (used / data.periodCredits) * 100 : 0}
              additionalInfo={`${formatCredits(used)} of ${formatCredits(data.periodCredits)} used`}
              description={
                data.balance <= 0
                  ? 'You are out of credits. Upgrade to keep using AI features.'
                  : undefined
              }
              status={data.balance <= 0 ? 'error' : 'in-progress'}
            />
          </SpaceBetween>
        )}
      </Container>

      <div className={tableStyles.table}>
        <Table
          variant="container"
          loading={billing.isLoading}
          loadingText="Loading credit history"
          trackBy="id"
          items={ledger.slice((page - 1) * PAGE, page * PAGE)}
          header={
            <Header
              variant="h2"
              counter={ledger.length ? `(${ledger.length})` : undefined}
              description="Every time credits were added or used"
            >
              Credit history
            </Header>
          }
          pagination={
            <Pagination
              currentPageIndex={page}
              pagesCount={pages}
              ariaLabels={{
                nextPageLabel: 'Next page',
                previousPageLabel: 'Previous page',
                pageLabel: (number) => `Page ${number}`,
              }}
              onChange={({ detail }) => setPage(detail.currentPageIndex)}
            />
          }
          columnDefinitions={[
            { id: 'when', header: 'When', cell: (item) => formatWhen(item.at) },
            { id: 'kind', header: 'Type', cell: (item) => KIND[item.kind] },
            { id: 'activity', header: 'Activity', cell: (item) => item.description },
            { id: 'model', header: 'Model', cell: (item) => item.model ?? '–' },
            {
              id: 'credits',
              header: 'Credits',
              cell: (item) => (
                <Box color={item.credits > 0 ? 'text-status-success' : 'inherit'}>
                  {signed(item.credits)}
                </Box>
              ),
            },
            { id: 'balance', header: 'Balance', cell: (item) => formatCredits(item.balanceAfter) },
          ]}
          empty={
            <Box textAlign="center" color="inherit" padding="m">
              <b>No credit activity yet</b>
            </Box>
          }
        />
      </div>
    </SpaceBetween>
  );
}
