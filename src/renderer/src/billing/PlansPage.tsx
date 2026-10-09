import Badge from '@cloudscape-design/components/badge';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Container from '@cloudscape-design/components/container';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import SegmentedControl from '@cloudscape-design/components/segmented-control';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useOptionalFlash } from '../settings/flash';
import { useUiVersion } from '../theme/UiVersionProvider';
import { Icon, type IconName } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { useSnackbar } from '../ui/Snackbar';
import { useBilling } from './billing';
import {
  ANNUAL_SAVING,
  formatCredits,
  formatRupees,
  PLANS,
  type BillingInterval,
  type Plan,
} from './plans';
import styles from './PlansPage.module.css';

const BADGE: Partial<Record<Plan['id'], IconName>> = { STANDARD: 'bolt', PRO: 'crown' };
// The plan most people should pick, shown with emphasis.
const RECOMMENDED: Plan['id'] = 'STANDARD';
const NOTE =
  "Credits pay for AI features such as sorting, summaries and drafts. Each action uses credits based on the AI model's cost; mail, labels and cloud storage are always free.";

// Each plan's colour, also the strip on top of its card in the console.
const PLAN_STRIP: Record<Plan['id'], string> = {
  FREE: 'linear-gradient(160deg, #e8f1fd, #a9cdf6)',
  STANDARD: '#202124',
  PRO: 'linear-gradient(135deg, #fde7c8, #f8c9d9, #d7e3fb)',
};

const featureIcon = (feature: string): IconName =>
  /AI|credit|Suggestion|Summar|draft|model/i.test(feature) ? 'sparkle' : 'check';

function usePlansState() {
  const billing = useBilling();
  const flash = useOptionalFlash();
  const snackbar = useSnackbar();
  const [interval, setBillingInterval] = useState<BillingInterval>('monthly');
  const choose = (plan: Plan) => {
    const text = `Payments are coming soon. You'll be able to move to ${plan.name} here.`;
    if (flash) flash({ type: 'info', content: text });
    else snackbar({ text });
  };
  return { interval, setBillingInterval, current: billing.data?.subscription.plan, choose };
}

const priceOf = (plan: Plan, interval: BillingInterval) =>
  interval === 'annual' ? plan.annualMonthlyPrice : plan.monthlyPrice;

const billedLine = (plan: Plan, interval: BillingInterval) =>
  plan.monthlyPrice === 0
    ? 'Free forever, no card needed'
    : interval === 'annual'
      ? `${formatRupees(plan.annualMonthlyPrice * 12)} billed yearly`
      : 'Billed monthly, cancel anytime';

const yearlySaving = (plan: Plan) => (plan.monthlyPrice - plan.annualMonthlyPrice) * 12;

// v1: like Google's plan picker, centred cards with a large price and pill buttons.
function GmailPlans() {
  const navigate = useNavigate();
  const { interval, setBillingInterval, current, choose } = usePlansState();

  return (
    <div className={styles.page}>
      <IconButton
        className={styles.close}
        icon="close"
        label="Close plans"
        onClick={() => void navigate(-1)}
      />
      <header className={styles.header}>
        <h1>Choose your plan</h1>
        <p>Pick the plan that suits you. Upgrade or downgrade at any time.</p>
        <div className={styles.segmented} role="radiogroup" aria-label="Billing period">
          {(['monthly', 'annual'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={interval === value}
              className={interval === value ? styles.segmentOn : undefined}
              onClick={() => setBillingInterval(value)}
            >
              {interval === value && <Icon name="check" size={18} />}
              {value === 'monthly' ? 'Monthly' : `Annually · save ${ANNUAL_SAVING}`}
            </button>
          ))}
        </div>
      </header>

      <div className={styles.grid}>
        {PLANS.map((plan) => {
          const isCurrent = plan.id === current;
          const recommended = plan.id === RECOMMENDED;
          const badge = BADGE[plan.id];
          return (
            <article
              key={plan.id}
              className={`${styles.card} ${styles[plan.id.toLowerCase()]} ${recommended ? styles.recommended : ''}`}
            >
              <h2 className={styles.name}>
                {plan.name}
                {badge && <Icon name={badge} size={22} />}
                <span className={styles.tag}>
                  {formatCredits(plan.credits)} credits{plan.monthlyPrice ? '/mo' : ''}
                </span>
              </h2>
              <p className={styles.tagline}>{plan.tagline}</p>
              {interval === 'annual' && plan.monthlyPrice > 0 ? (
                <span className={styles.save}>Save {formatRupees(yearlySaving(plan))}</span>
              ) : (
                <span className={styles.saveSpace} />
              )}
              <p className={styles.price}>
                {formatRupees(priceOf(plan, interval))}
                <span>/mo</span>
              </p>
              <p className={styles.billed}>{billedLine(plan, interval)}</p>

              <button
                type="button"
                className={`${styles.cta} ${isCurrent ? styles.ctaCurrent : recommended ? styles.ctaPrimary : styles.ctaTonal}`}
                disabled={isCurrent}
                onClick={() => choose(plan)}
              >
                {isCurrent ? 'Current plan' : plan.monthlyPrice ? 'Subscribe' : 'Switch to Free'}
              </button>

              <ul className={styles.features}>
                {plan.bonusCredits > 0 && (
                  <li className={styles.bonus}>
                    <Icon name="credit" size={22} />
                    {formatCredits(plan.bonusCredits)} bonus credits in the first month
                  </li>
                )}
                {plan.features.map((feature) => (
                  <li key={feature}>
                    <Icon name={featureIcon(feature)} size={22} />
                    {feature}
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
      <p className={styles.note}>{NOTE}</p>
    </div>
  );
}

// v2: the AWS console way, a page header with the period switch and one container per plan.
function ConsolePlans() {
  const { interval, setBillingInterval, current, choose } = usePlansState();

  return (
    <ContentLayout
      header={
        <Header
          variant="h1"
          description="Pick the plan that suits you. Upgrade or downgrade at any time."
          actions={
            <SegmentedControl
              label="Billing period"
              selectedId={interval}
              onChange={({ detail }) => setBillingInterval(detail.selectedId as BillingInterval)}
              options={[
                { id: 'monthly', text: 'Monthly' },
                { id: 'annual', text: `Annually (save ${ANNUAL_SAVING})` },
              ]}
            />
          }
        >
          Plans
        </Header>
      }
    >
      <SpaceBetween size="l">
        <ColumnLayout columns={3}>
          {PLANS.map((plan) => {
            const isCurrent = plan.id === current;
            const badge = BADGE[plan.id];
            return (
              <Container
                key={plan.id}
                fitHeight
                media={{
                  content: (
                    <div
                      className={styles.strip}
                      style={{ background: PLAN_STRIP[plan.id] }}
                      aria-hidden="true"
                    />
                  ),
                  position: 'top',
                  height: '8px',
                }}
                header={
                  <Header
                    variant="h2"
                    description={plan.tagline}
                    actions={
                      isCurrent ? (
                        <Badge color="blue">Current plan</Badge>
                      ) : plan.id === RECOMMENDED ? (
                        <Badge color="green">Recommended</Badge>
                      ) : undefined
                    }
                  >
                    <span className={styles.consoleName}>
                      {plan.name}
                      {badge && <Icon name={badge} size={18} />}
                    </span>
                  </Header>
                }
              >
                <SpaceBetween size="m">
                  <div>
                    <Box variant="awsui-value-large">
                      {formatRupees(priceOf(plan, interval))}
                      <Box variant="span" color="text-body-secondary" fontSize="body-m">
                        {' '}
                        /month
                      </Box>
                    </Box>
                    <Box color="text-body-secondary" fontSize="body-s">
                      {billedLine(plan, interval)}
                      {interval === 'annual' && plan.monthlyPrice > 0 && (
                        <> · saves {formatRupees(yearlySaving(plan))} a year</>
                      )}
                    </Box>
                  </div>
                  <div className={styles.consoleCredits}>
                    <Icon name="credit" size={16} />
                    <span>
                      <b>{formatCredits(plan.credits)}</b> credits{' '}
                      {plan.monthlyPrice ? 'per month' : 'to start'}
                      {plan.bonusCredits > 0 && (
                        <> + {formatCredits(plan.bonusCredits)} bonus in the first month</>
                      )}
                    </span>
                  </div>
                  <Button
                    fullWidth
                    variant={!isCurrent && plan.id === RECOMMENDED ? 'primary' : 'normal'}
                    disabled={isCurrent}
                    onClick={() => choose(plan)}
                  >
                    {isCurrent ? 'Current plan' : `Choose ${plan.name}`}
                  </Button>
                  <ul className={styles.consoleFeatures}>
                    {plan.features.map((feature) => (
                      <li key={feature}>
                        <Icon name="check" size={16} />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </SpaceBetween>
              </Container>
            );
          })}
        </ColumnLayout>
        <Box color="text-body-secondary" fontSize="body-s" textAlign="center">
          {NOTE}
        </Box>
      </SpaceBetween>
    </ContentLayout>
  );
}

export function PlansPage() {
  const { version } = useUiVersion();
  return version === 'v2' ? <ConsolePlans /> : <GmailPlans />;
}

export default PlansPage;
