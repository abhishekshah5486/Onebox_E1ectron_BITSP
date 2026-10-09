import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Spinner from '@cloudscape-design/components/spinner';
import Tiles from '@cloudscape-design/components/tiles';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PaymentProvider } from '../api/payments';
import { useUiVersion } from '../theme/UiVersionProvider';
import { Icon } from '../ui/Icon';
import styles from './CheckoutOverlay.module.css';

interface Purchase {
  planName: string;
  price: string;
}

// Where an upgrade stands until the provider's checkout takes over (or, for Stripe's page in
// another tab, until the payment shows up).
export type CheckoutStep =
  | (Purchase & { kind: 'choose' })
  | (Purchase & { kind: 'preparing'; provider: PaymentProvider })
  | (Purchase & { kind: 'waiting'; url: string });

export const PROVIDER_NAME: Record<PaymentProvider, string> = {
  RAZORPAY: 'Razorpay',
  STRIPE: 'Stripe',
};

const PROVIDER_OPTIONS: { value: PaymentProvider; label: string; description: string }[] = [
  {
    value: 'RAZORPAY',
    label: 'Razorpay',
    description: 'UPI, Indian cards, net banking and wallets',
  },
  { value: 'STRIPE', label: 'Stripe', description: 'Cards, including international ones' },
];

function copy(step: CheckoutStep) {
  const what = `${step.planName} (${step.price})`;
  if (step.kind === 'choose') {
    return { title: 'Choose how to pay', detail: `Pick a payment provider for ${what}.` };
  }
  if (step.kind === 'preparing') {
    return {
      title: 'Opening secure checkout',
      detail: `Taking you to ${PROVIDER_NAME[step.provider]} to pay for ${what}.`,
    };
  }
  return {
    title: 'Finish paying in your browser',
    detail: `Checkout for ${what} opened in a new tab. This updates as soon as your payment goes through.`,
  };
}

const SECURE = 'Payments are processed securely. OneBox never sees your card or UPI details.';

export function CheckoutOverlay({
  step,
  onCancel,
  onPick,
  onReopen,
}: {
  step: CheckoutStep | null;
  onCancel: () => void;
  onPick: (provider: PaymentProvider) => void;
  onReopen: () => void;
}) {
  const { version } = useUiVersion();
  const [picked, setPicked] = useState<PaymentProvider>('RAZORPAY');

  useEffect(() => {
    if (!step || version === 'v2') return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onCancel();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [step, version, onCancel]);

  if (!step) return null;
  const { title, detail } = copy(step);

  if (version === 'v2') {
    return (
      <Modal
        visible
        onDismiss={onCancel}
        header={title}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={onCancel}>
                Cancel
              </Button>
              {step.kind === 'choose' && (
                <Button variant="primary" onClick={() => onPick(picked)}>
                  Continue
                </Button>
              )}
              {step.kind === 'waiting' && (
                <Button iconName="external" iconAlign="right" onClick={onReopen}>
                  Open checkout again
                </Button>
              )}
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          {step.kind === 'choose' ? (
            <>
              <Box>{detail}</Box>
              <Tiles
                ariaLabel="Payment provider"
                value={picked}
                onChange={({ detail: change }) => setPicked(change.value as PaymentProvider)}
                items={PROVIDER_OPTIONS}
              />
            </>
          ) : (
            <SpaceBetween direction="horizontal" size="s" alignItems="center">
              <Spinner size="big" />
              <Box>{detail}</Box>
            </SpaceBetween>
          )}
          <Box color="text-body-secondary" fontSize="body-s">
            {SECURE}
          </Box>
        </SpaceBetween>
      </Modal>
    );
  }

  return createPortal(
    <div className={styles.backdrop}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-overlay-title"
        className={styles.dialog}
      >
        {step.kind !== 'choose' && <div className={styles.spinner} aria-hidden="true" />}
        <h2
          id="checkout-overlay-title"
          className={`${styles.title} ${step.kind === 'choose' ? styles.titleOnly : ''}`}
        >
          {title}
        </h2>
        <p className={styles.detail}>{detail}</p>
        {step.kind === 'choose' && (
          <ul className={styles.options}>
            {PROVIDER_OPTIONS.map((option) => (
              <li key={option.value}>
                <button
                  type="button"
                  className={styles.option}
                  onClick={() => onPick(option.value)}
                >
                  <span>
                    <b>{option.label}</b>
                    <small>{option.description}</small>
                  </span>
                  <Icon name="chevron" size={20} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className={styles.secure}>
          <Icon name="lock" size={16} />
          {SECURE}
        </p>
        <div className={styles.actions}>
          {step.kind === 'waiting' && (
            <button type="button" className={styles.cancel} onClick={onReopen}>
              Open checkout again
            </button>
          )}
          <button type="button" className={styles.cancel} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
