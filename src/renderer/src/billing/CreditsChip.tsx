import { useNavigate } from 'react-router';
import { Icon } from '../ui/Icon';
import { useBilling } from './billing';
import styles from './CreditsChip.module.css';
import { formatCredits } from './plans';

// The credits left, in the top bar; opens the plans.
export function CreditsChip() {
  const navigate = useNavigate();
  const billing = useBilling();
  if (!billing.data) return null;
  const { balance, periodCredits } = billing.data;
  const low = balance <= periodCredits * 0.2;
  return (
    <button
      type="button"
      className={`${styles.chip} ${low ? styles.low : ''}`}
      aria-label={`${formatCredits(balance)} credits left. See plans`}
      data-tooltip={low ? 'Running low on credits. See plans' : 'Credits left. See plans'}
      onClick={() => void navigate('/plans')}
    >
      <Icon name="credit" size={18} />
      {formatCredits(balance)}
    </button>
  );
}
