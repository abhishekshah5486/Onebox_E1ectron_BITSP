import Box from '@cloudscape-design/components/box';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import Link from '@cloudscape-design/components/link';
import Pagination from '@cloudscape-design/components/pagination';
import Popover from '@cloudscape-design/components/popover';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Table from '@cloudscape-design/components/table';
import { useState } from 'react';
import tableStyles from '../ui/DataTable.module.css';
import { useBilling, type LedgerEntry } from './billing';
import styles from './BillingSection.module.css';
import { formatCredits } from './plans';
import { ModelLogo } from '../settings/ModelLogo';
import { SubscriptionSection } from './SubscriptionSection';

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

// Settings → Billing: the plan (with its payments), the credits left and where they went.
export function BillingSection() {
  const billing = useBilling();
  const [page, setPage] = useState(1);
  const data = billing.data;
  const ledger = data?.ledger ?? [];
  const pages = Math.max(1, Math.ceil(ledger.length / PAGE));
  const low = data ? data.balance <= data.periodCredits * 0.2 : false;
  // A plan stopped for non-payment pauses AI even with credits left.
  const paused = data?.subscription.status === 'halted';

  return (
    <SpaceBetween size="l">
      <SubscriptionSection />

      <Container
        header={
          <Header
            variant="h2"
            info={
              <Popover
                header="How credits work"
                triggerType="custom"
                dismissButton={false}
                size="medium"
                content="Credits pay for AI features such as sorting, summaries and drafts. Each action uses credits based on the AI model's cost; mail, labels and cloud storage are always free."
              >
                <Link variant="info">Info</Link>
              </Popover>
            }
            description="Credits pay for AI features. AI sorting, summaries and drafts stop when your credits run out."
          >
            Credits
          </Header>
        }
      >
        {data && (
          <ColumnLayout columns={3} variant="text-grid">
            <div>
              <Box variant="awsui-key-label">Credits left</Box>
              <span className={styles.valueRow}>
                <Box
                  variant="awsui-value-large"
                  color={data.balance <= 0 ? 'text-status-error' : 'text-status-info'}
                >
                  {formatCredits(data.balance)}
                </Box>
                <Box variant="span" color="text-body-secondary">
                  of {formatCredits(data.periodCredits)}
                </Box>
              </span>
            </div>
            <div>
              <Box variant="awsui-key-label">Credits reset</Box>
              <div>
                {data.subscription.renewsAt
                  ? new Date(data.subscription.renewsAt).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : 'Never (Free credits are given once)'}
              </div>
            </div>
            <div>
              <Box variant="awsui-key-label">Status</Box>
              <StatusIndicator
                type={paused || data.balance <= 0 ? 'error' : low ? 'warning' : 'success'}
              >
                {paused
                  ? 'Paused until payment'
                  : data.balance <= 0
                    ? 'Out of credits'
                    : low
                      ? 'Running low'
                      : 'AI features available'}
              </StatusIndicator>
            </div>
          </ColumnLayout>
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
            {
              id: 'model',
              header: 'Model',
              cell: (item) =>
                item.model ? (
                  <span className={styles.paidWith}>
                    <ModelLogo model={item.modelId ?? item.model.toLowerCase()} />
                    {item.model}
                  </span>
                ) : (
                  '–'
                ),
            },
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
