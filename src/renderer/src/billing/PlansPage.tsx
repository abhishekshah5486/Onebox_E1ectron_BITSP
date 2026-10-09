import Alert from '@cloudscape-design/components/alert';
import BreadcrumbGroup from '@cloudscape-design/components/breadcrumb-group';
import Button from '@cloudscape-design/components/button';
import Box from '@cloudscape-design/components/box';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Container from '@cloudscape-design/components/container';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Link from '@cloudscape-design/components/link';
import Popover from '@cloudscape-design/components/popover';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Table from '@cloudscape-design/components/table';
import Toggle from '@cloudscape-design/components/toggle';
import CloudscapeIcon from '@cloudscape-design/components/icon';
import { useNavigate } from 'react-router';
import { useUiVersion } from '../theme/UiVersionProvider';
import { Icon, type IconName } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { usePlanChoice } from './usePlanChoice';
import {
  ANNUAL_SAVING,
  formatCredits,
  formatRupees,
  COMPARISON,
  plansFor,
  type ComparisonRow,
  type BillingInterval,
  type Plan,
} from './plans';
import { ConsoleFeatureIcon, GMAIL_FEATURE_ICON } from './featureIcons';
import tableStyles from '../ui/DataTable.module.css';
import styles from './PlansPage.module.css';
import { ShowcasePlans } from './ShowcasePlans';

const BADGE: Partial<Record<Plan['id'], IconName>> = { STANDARD: 'bolt', PRO: 'crown' };
// The plan most people should pick, shown with emphasis.
const RECOMMENDED: Plan['id'] = 'STANDARD';
const NOTE =
  "Credits pay for AI features such as sorting, summaries and drafts. Each action uses credits based on the AI model's cost; mail, labels and cloud storage are always free.";

const usePlansState = usePlanChoice;

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
  const {
    interval,
    setBillingInterval,
    isCurrent: isCurrentPlan,
    choose,
    busy,
    overlay,
  } = usePlansState();

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
          const isCurrent = isCurrentPlan(plan.id);
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
                  disabled={isCurrent || busy !== null}
                  onClick={() => choose(plan)}
                >
                  {isCurrent
                    ? 'Current plan'
                    : busy === plan.id
                      ? 'Opening checkout…'
                      : plan.monthlyPrice
                        ? 'Subscribe'
                        : 'Switch to Free'}
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
      {overlay}
      <p className={styles.note}>{NOTE}</p>
    </div>
  );
}

// v2: an AWS console page: breadcrumbs, a header with the yearly-billing toggle, and one container
// per plan whose short coloured band carries its name and price.
function ConsolePlans() {
  const navigate = useNavigate();
  const {
    interval,
    setBillingInterval,
    isCurrent: isCurrentPlan,
    choose,
    busy,
    overlay,
  } = usePlansState();
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
          info={<CreditsInfo />}
          description="Pick the plan that suits you. Upgrade or downgrade at any time."
          actions={
            <Toggle
              checked={interval === 'annual'}
              onChange={({ detail }) => setBillingInterval(detail.checked ? 'annual' : 'monthly')}
            >
              Pay annually (save {ANNUAL_SAVING})
            </Toggle>
          }
        >
          Plans
        </Header>
      }
    >
      <SpaceBetween size="l">
        {overlay}
        <Alert type="info">{NOTE}</Alert>
        <div className={interval === 'annual' ? styles.consoleNarrow : undefined}>
          <ColumnLayout columns={plansFor(interval).length}>
            {plansFor(interval).map((plan) => {
              const isCurrent = isCurrentPlan(plan.id);
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
                          <span className={styles.consoleStatus}>
                            <StatusIndicator type="success">Current plan</StatusIndicator>
                          </span>
                        ) : plan.id === RECOMMENDED ? (
                          // Shaped like Current plan; Recommended is only ever on the dark Standard card.
                          <span className={`${styles.consoleStatus} ${styles.recommended}`}>
                            <Icon name="sparkle" size={16} />
                            Recommended
                          </span>
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
                          disabled={isCurrent || (busy !== null && busy !== plan.id)}
                          loading={busy === plan.id}
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
        </div>
        <div id="compare-plans" className={`${tableStyles.table} ${tableStyles.static}`}>
          <Table
            variant="container"
            header={
              <Header variant="h2" description="What each plan includes, side by side.">
                Compare plans
              </Header>
            }
            trackBy="feature"
            items={COMPARISON}
            columnDefinitions={[
              { id: 'feature', header: 'Feature', cell: (row) => row.feature },
              ...plansFor(interval).map((plan) => ({
                id: plan.id,
                header: plan.name,
                cell: (row: ComparisonRow) => <ComparisonValue value={row.values[plan.id]} />,
              })),
            ]}
          />
        </div>
      </SpaceBetween>
    </ContentLayout>
  );
}

// Included, not included, or a short value, the way AWS tables show them.
function ComparisonValue({ value }: { value: boolean | string }) {
  if (value === true) return <CloudscapeIcon name="check" variant="success" ariaLabel="Included" />;
  if (value === false) {
    return (
      <Box color="text-status-inactive">
        <span aria-label="Not included">–</span>
      </Box>
    );
  }
  return <>{value}</>;
}

// The Info link next to the title: what credits are and what they pay for.
function CreditsInfo() {
  return (
    <Popover
      header="How credits work"
      content={NOTE}
      triggerType="custom"
      dismissButton={false}
      size="medium"
    >
      <Link variant="info">Info</Link>
    </Popover>
  );
}

// v1 shows the showcase design, v2 the console one.
export function PlansPage() {
  const { version } = useUiVersion();
  return version === 'v2' ? <ConsolePlans /> : <ShowcasePlans />;
}

export default PlansPage;
