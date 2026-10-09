import Alert from '@cloudscape-design/components/alert';
import Badge from '@cloudscape-design/components/badge';
import BreadcrumbGroup from '@cloudscape-design/components/breadcrumb-group';
import Button from '@cloudscape-design/components/button';
import Box from '@cloudscape-design/components/box';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Container from '@cloudscape-design/components/container';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Toggle from '@cloudscape-design/components/toggle';
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
  plansFor,
  type BillingInterval,
  type Plan,
} from './plans';
import { ConsoleFeatureIcon, GMAIL_FEATURE_ICON } from './featureIcons';
import styles from './PlansPage.module.css';
import { ShowcasePlans } from './ShowcasePlans';

const BADGE: Partial<Record<Plan['id'], IconName>> = { STANDARD: 'bolt', PRO: 'crown' };
// The plan most people should pick, shown with emphasis.
const RECOMMENDED: Plan['id'] = 'STANDARD';
const NOTE =
  "Credits pay for AI features such as sorting, summaries and drafts. Each action uses credits based on the AI model's cost; mail, labels and cloud storage are always free.";

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

// Monthly or yearly prices, as Material segmented buttons.
function PeriodToggle({
  interval,
  onChange,
}: {
  interval: BillingInterval;
  onChange: (value: BillingInterval) => void;
}) {
  return (
    <div className={styles.segmented} role="radiogroup" aria-label="Billing period">
      {(['monthly', 'annual'] as const).map((value) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={interval === value}
          className={interval === value ? styles.segmentOn : undefined}
          onClick={() => onChange(value)}
        >
          {interval === value && <Icon name="check" size={18} />}
          {value === 'monthly' ? 'Monthly' : 'Annually'}
          {value === 'annual' && <span className={styles.saveTag}>Save {ANNUAL_SAVING}</span>}
        </button>
      ))}
    </div>
  );
}

// Google One style plans (centred cards, large green price). Not in use: v1 shows the
// showcase design; kept so it can come back.
export function GmailPlans() {
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
        <PeriodToggle interval={interval} onChange={setBillingInterval} />
      </header>

      <div className={styles.grid}>
        {plansFor(interval).map((plan) => {
          const isCurrent = plan.id === current;
          const recommended = plan.id === RECOMMENDED;
          const badge = BADGE[plan.id];
          return (
            <article
              key={plan.id}
              className={`${styles.card} ${recommended ? styles.recommended : ''}`}
            >
              <div className={`${styles.cardHead} ${styles[plan.id.toLowerCase()]}`}>
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
              </div>

              <ul className={styles.features}>
                {plan.bonusCredits > 0 && (
                  <li className={styles.bonus}>
                    <Icon name="credit" size={20} />
                    {formatCredits(plan.bonusCredits)} bonus credits in the first month
                  </li>
                )}
                {plan.features.map((feature) => (
                  <li key={feature.text}>
                    <Icon name={GMAIL_FEATURE_ICON[feature.kind]} size={20} />
                    {feature.text}
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

// v2: an AWS console page: breadcrumbs, a header with the yearly-billing toggle, and one container
// per plan whose short coloured band carries its name and price.
function ConsolePlans() {
  const navigate = useNavigate();
  const { interval, setBillingInterval, current, choose } = usePlansState();
  const follow = (event: CustomEvent<{ href: string }>) => {
    event.preventDefault();
    void navigate(event.detail.href);
  };

  return (
    <ContentLayout
      breadcrumbs={
        <BreadcrumbGroup
          ariaLabel="Breadcrumbs"
          onFollow={follow}
          items={[
            { text: 'Settings', href: '/settings' },
            { text: 'Billing', href: '/settings/billing' },
            { text: 'Plans', href: '/plans' },
          ]}
        />
      }
      header={
        <Header
          variant="h1"
          description="Pick the plan that suits you. Upgrade or downgrade at any time."
          actions={
            <SpaceBetween direction="horizontal" size="xs" alignItems="center">
              <Toggle
                checked={interval === 'annual'}
                onChange={({ detail }) => setBillingInterval(detail.checked ? 'annual' : 'monthly')}
              >
                Pay annually
              </Toggle>
              <Badge color="green">Save {ANNUAL_SAVING}</Badge>
            </SpaceBetween>
          }
        >
          Plans
        </Header>
      }
    >
      <SpaceBetween size="l">
        <ColumnLayout columns={plansFor(interval).length}>
          {plansFor(interval).map((plan) => {
            const isCurrent = plan.id === current;
            const badge = BADGE[plan.id];
            return (
              <Container key={plan.id} fitHeight disableContentPaddings>
                <div className={styles.consoleCard}>
                  <div className={`${styles.consoleHead} ${styles[plan.id.toLowerCase()]}`}>
                    <div className={styles.consoleTitle}>
                      <h2>
                        {plan.name}
                        {badge && <Icon name={badge} size={20} />}
                      </h2>
                      {isCurrent ? (
                        <Badge color="blue">Current plan</Badge>
                      ) : plan.id === RECOMMENDED ? (
                        <Badge color="green">Recommended</Badge>
                      ) : null}
                    </div>
                    <p className={styles.consoleTagline}>{plan.tagline}</p>
                    <p className={styles.consolePrice}>
                      {formatRupees(priceOf(plan, interval))}
                      <span>/month</span>
                    </p>
                  </div>
                  <div className={styles.consoleBody}>
                    <SpaceBetween size="m">
                      <Box color="text-body-secondary">
                        {billedLine(plan, interval)}
                        {interval === 'annual' && plan.monthlyPrice > 0 && (
                          <> · saves {formatRupees(yearlySaving(plan))} a year</>
                        )}
                      </Box>
                      <div className={styles.consoleCredits}>
                        <Icon name="credit" size={22} />
                        <span>
                          <b>{formatCredits(plan.credits)}</b> credits{' '}
                          {plan.monthlyPrice ? 'per month' : 'to start'}
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
                        {plan.bonusCredits > 0 && (
                          <li className={styles.consoleBonus}>
                            <ConsoleFeatureIcon kind="credit" />
                            {formatCredits(plan.bonusCredits)} bonus credits in the first month
                          </li>
                        )}
                        {plan.features.map((feature) => (
                          <li key={feature.text}>
                            <ConsoleFeatureIcon kind={feature.kind} />
                            {feature.text}
                          </li>
                        ))}
                      </ul>
                    </SpaceBetween>
                  </div>
                </div>
              </Container>
            );
          })}
        </ColumnLayout>
        <Alert type="info">{NOTE}</Alert>
      </SpaceBetween>
    </ContentLayout>
  );
}

// v1 shows the showcase design, v2 the console one.
export function PlansPage() {
  const { version } = useUiVersion();
  return version === 'v2' ? <ConsolePlans /> : <ShowcasePlans />;
}

export default PlansPage;
