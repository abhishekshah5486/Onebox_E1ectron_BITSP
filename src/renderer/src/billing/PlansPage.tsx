import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useOptionalFlash } from '../settings/flash';
import { Icon, type IconName } from '../ui/Icon';
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

function PlanCard({
  plan,
  interval,
  current,
  onChoose,
}: {
  plan: Plan;
  interval: BillingInterval;
  current: boolean;
  onChoose: () => void;
}) {
  const free = plan.monthlyPrice === 0;
  const price = interval === 'annual' ? plan.annualMonthlyPrice : plan.monthlyPrice;
  const yearlySaving = (plan.monthlyPrice - plan.annualMonthlyPrice) * 12;
  const badge = BADGE[plan.id];

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
          <Icon name="credit" size={18} />
          {plan.bonusCredits > 0 && (
            <span className={styles.bonus}>{formatCredits(plan.bonusCredits)} bonus +</span>
          )}
          <span>
            {formatCredits(plan.credits)} credits {free ? 'to start' : '/mo'}
          </span>
        </div>

        <button type="button" className={styles.choose} disabled={current} onClick={onChoose}>
          {current ? 'Your current plan' : free ? 'Switch to Free' : `Upgrade to ${plan.name}`}
        </button>
      </div>

      <ul className={styles.features}>
        {plan.bonusCredits > 0 && (
          <li className={styles.bonusLine}>
            <Icon name="credit" size={18} />
            {formatCredits(plan.bonusCredits)} bonus credits in the first month
          </li>
        )}
        {plan.features.map((feature) => (
          <li key={feature}>
            <Icon name="check" size={18} />
            {feature}
          </li>
        ))}
      </ul>
    </article>
  );
}

// Plans, like a pricing page: monthly or yearly prices, credits and what each plan includes.
export function PlansPage() {
  const navigate = useNavigate();
  const billing = useBilling();
  const flash = useOptionalFlash();
  const snackbar = useSnackbar();
  const [interval, setBillingInterval] = useState<BillingInterval>('monthly');
  const currentPlan = billing.data?.subscription.plan;

  const choose = (plan: Plan) => {
    const text = `Payments are coming soon. You'll be able to move to ${plan.name} here.`;
    if (flash) flash({ type: 'info', content: text });
    else snackbar({ text });
  };

  return (
    <div className={styles.page}>
      <button
        type="button"
        className={styles.close}
        aria-label="Close plans"
        data-tooltip="Close"
        onClick={() => void navigate(-1)}
      >
        <Icon name="close" size={22} />
      </button>

      <header className={styles.header}>
        <h1>Choose your plan</h1>
        <p>Pick the plan that suits you. Upgrade or downgrade at any time.</p>
        <div className={styles.toggle} role="radiogroup" aria-label="Billing period">
          {(['monthly', 'annual'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={interval === value}
              className={interval === value ? styles.toggleOn : undefined}
              onClick={() => setBillingInterval(value)}
            >
              {value === 'monthly' ? 'Monthly' : 'Annually'}
              {value === 'annual' && <span className={styles.saveTag}>Save {ANNUAL_SAVING}</span>}
            </button>
          ))}
        </div>
      </header>

      <div className={styles.grid}>
        {PLANS.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            interval={interval}
            current={plan.id === currentPlan}
            onChoose={() => choose(plan)}
          />
        ))}
      </div>

      <p className={styles.note}>
        Credits pay for AI features such as sorting, summaries and drafts. Each action uses credits
        based on the AI model's cost; mail, labels and cloud storage are always free.
      </p>
    </div>
  );
}

export default PlansPage;
