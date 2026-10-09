import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router';
import { Icon, type IconName } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { usePlanChoice } from './usePlanChoice';
import {
  ANNUAL_SAVING,
  formatCredits,
  formatRupees,
  plansFor,
  type BillingInterval,
  type Plan,
} from './plans';
import { GMAIL_FEATURE_ICON } from './featureIcons';
import styles from './ShowcasePlans.module.css';

const BADGE: Partial<Record<Plan['id'], IconName>> = { STANDARD: 'bolt', PRO: 'crown' };
// The plan most people should pick gets the filled button.
const RECOMMENDED: Plan['id'] = 'STANDARD';

function PlanCard({
  plan,
  interval,
  current,
  onPaidPlan,
  busy,
  onChoose,
}: {
  plan: Plan;
  interval: BillingInterval;
  current: boolean;
  // Already paying: another plan is a switch, not a checkout.
  onPaidPlan: boolean;
  busy: Plan['id'] | null;
  onChoose: () => void;
}) {
  const free = plan.monthlyPrice === 0;
  const price = interval === 'annual' ? plan.annualMonthlyPrice : plan.monthlyPrice;
  const yearlySaving = (plan.monthlyPrice - plan.annualMonthlyPrice) * 12;
  const badge = BADGE[plan.id];
  const button = current ? styles.outlined : plan.id === RECOMMENDED ? styles.filled : styles.tonal;

  return (
    <article className={`${styles.plan} ${styles[plan.id.toLowerCase()]}`}>
      <div className={styles.head}>
        <h2 className={styles.name}>
          {plan.name}
          {badge && <Icon name={badge} size={20} />}
          {current && <span className={styles.current}>Current plan</span>}
        </h2>
        <p className={styles.tagline}>{plan.tagline}</p>

        <div className={styles.priceRow}>
          <span className={styles.price}>{free ? '₹0' : formatRupees(price)}</span>
          <span className={styles.per}>{free ? 'forever' : '/mo'}</span>
          {!free && interval === 'annual' && (
            <span className={styles.save}>Save {formatRupees(yearlySaving)}</span>
          )}
        </div>
        <p className={styles.billed}>
          {free
            ? 'No card needed'
            : interval === 'annual'
              ? `${formatRupees(plan.annualMonthlyPrice * 12)} billed yearly`
              : 'Billed monthly'}
        </p>

        <div className={styles.credits}>
          <Icon name="credit" size={20} />
          <span>
            {formatCredits(plan.credits)} credits {free ? 'to start' : 'every month'}
          </span>
        </div>

        <button
          type="button"
          className={`${styles.choose} ${button}`}
          disabled={current || busy !== null}
          onClick={onChoose}
        >
          {current
            ? 'Current plan'
            : busy === plan.id
              ? onPaidPlan
                ? 'Switching…'
                : 'Opening checkout…'
              : free || onPaidPlan
                ? `Switch to ${plan.name}`
                : `Upgrade to ${plan.name}`}
        </button>
      </div>

      <ul className={styles.features}>
        {plan.bonusCredits > 0 && (
          <li className={styles.bonusLine}>
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
}

// The first plans design (bold cards with coloured tops, credits up front, features below),
// with Gmail's type, Material buttons and segmented control. Used by the v1 interface.
export function ShowcasePlans() {
  const navigate = useNavigate();
  const {
    interval,
    setBillingInterval,
    current: currentPlan,
    isCurrent,
    choose,
    busy,
    overlay,
  } = usePlanChoice();

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
              {value === 'monthly' ? 'Monthly' : 'Annually'}
              {value === 'annual' && <span className={styles.saveTag}>Save {ANNUAL_SAVING}</span>}
            </button>
          ))}
        </div>
      </header>

      <div
        className={styles.grid}
        style={{ '--plan-count': plansFor(interval).length } as CSSProperties}
      >
        {plansFor(interval).map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            interval={interval}
            current={isCurrent(plan.id)}
            onPaidPlan={currentPlan !== 'FREE'}
            busy={busy}
            onChoose={() => choose(plan)}
          />
        ))}
      </div>

      {overlay}
      <p className={styles.note}>
        Credits pay for AI features such as sorting, summaries and drafts. Each action uses credits
        based on the AI model's cost; mail, labels and cloud storage are always free.
      </p>
    </div>
  );
}
