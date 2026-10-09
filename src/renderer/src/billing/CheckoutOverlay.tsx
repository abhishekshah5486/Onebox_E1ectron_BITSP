import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Spinner from '@cloudscape-design/components/spinner';
import Tiles from '@cloudscape-design/components/tiles';
import * as tokens from '@cloudscape-design/design-tokens';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PaymentProvider } from '../api/payments';
import { useUiVersion } from '../theme/UiVersionProvider';
import { Icon } from '../ui/Icon';
import styles from './CheckoutOverlay.module.css';
import { ProviderLogo, ProviderLogos } from './ProviderLogo';

interface Purchase {
  planName: string;
  price: string;
}

// Where an upgrade stands until the provider's checkout takes over (or, for Stripe's page in
// another tab, until the payment shows up).
export type CheckoutStep =
  | (Purchase & { kind: 'choose' })
  | (Purchase & { kind: 'preparing'; provider: PaymentProvider })
  | (Purchase & { kind: 'ready' | 'waiting'; url: string });

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
  if (step.kind === 'ready') {
    return {
      title: 'Checkout is ready',
      detail: `Your browser held back the new tab. Open checkout to pay for ${what}.`,
    };
  }
  return {
    title: 'Finish paying in your browser',
    detail: `Checkout for ${what} opened in a new tab. This updates as soon as your payment goes through.`,
  };
}

// The provider this step is about; Stripe's is the only checkout that opens in a tab.
const providerOf = (step: CheckoutStep): PaymentProvider | null =>
  step.kind === 'choose' ? null : step.kind === 'preparing' ? step.provider : 'STRIPE';

// Both logos while choosing, otherwise the one in use. Decorative: the title says it all.
function Mark({ step, size, ring }: { step: CheckoutStep; size: number; ring: string }) {
  const provider = providerOf(step);
  return (
    <span aria-hidden="true" className={styles.mark}>
      {provider ? (
        <ProviderLogo provider={provider} size={size} label={false} />
      ) : (
        <ProviderLogos size={size} ring={ring} />
      )}
    </span>
  );
}

const SECURE = 'Payments are processed securely. OneBox never sees your card or UPI details.';

export function CheckoutOverlay({
  step,
  onCancel,
  onPick,
  onOpen,
}: {
  step: CheckoutStep | null;
  onCancel: () => void;
  onPick: (provider: PaymentProvider) => void;
  onOpen: () => void;
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
        header={
          <span className={styles.modalHeader}>
            <Mark step={step} size={28} ring={tokens.colorBackgroundContainerContent} />
            {title}
          </span>
        }
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
                <Button iconName="external" iconAlign="right" onClick={onOpen}>
                  Open checkout again
                </Button>
              )}
              {step.kind === 'ready' && (
                <Button variant="primary" iconName="external" iconAlign="right" onClick={onOpen}>
                  Open checkout
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
                items={PROVIDER_OPTIONS.map((option) => ({
                  ...option,
                  image: <ProviderLogo provider={option.value} size={36} label={false} />,
                }))}
              />
            </>
          ) : step.kind === 'ready' ? (
            <Box>{detail}</Box>
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
        {step.kind === 'preparing' || step.kind === 'waiting' ? (
          // The provider's logo inside the progress ring.
          <div className={styles.loading}>
            <div className={styles.spinner} aria-hidden="true" />
            <Mark step={step} size={28} ring="var(--ob-dialog-bg)" />
          </div>
        ) : (
          <Mark step={step} size={44} ring="var(--ob-dialog-bg)" />
        )}
        <h2 id="checkout-overlay-title" className={styles.title}>
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
                  <ProviderLogo provider={option.value} size={36} label={false} />
                  <span className={styles.optionText}>
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
            <button type="button" className={styles.cancel} onClick={onOpen}>
              Open checkout again
            </button>
          )}
          <button type="button" className={styles.cancel} onClick={onCancel}>
            Cancel
          </button>
          {step.kind === 'ready' && (
            <button type="button" className={styles.primary} onClick={onOpen}>
              Open checkout
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
