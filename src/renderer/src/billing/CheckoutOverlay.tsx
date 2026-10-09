import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Spinner from '@cloudscape-design/components/spinner';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useUiVersion } from '../theme/UiVersionProvider';
import { Icon } from '../ui/Icon';
import styles from './CheckoutOverlay.module.css';

export interface PreparingCheckout {
  planName: string;
  price: string;
}

// Shown between clicking Upgrade and Razorpay's window opening, so the wait is explained.
export function CheckoutOverlay({
  preparing,
  onCancel,
}: {
  preparing: PreparingCheckout | null;
  onCancel: () => void;
}) {
  const { version } = useUiVersion();

  useEffect(() => {
    if (!preparing || version === 'v2') return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onCancel();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [preparing, version, onCancel]);

  if (!preparing) return null;
  const detail = `Taking you to Razorpay to pay for ${preparing.planName} (${preparing.price}).`;

  if (version === 'v2') {
    return (
      <Modal
        visible
        onDismiss={onCancel}
        header="Opening secure checkout"
        footer={
          <Box float="right">
            <Button variant="link" onClick={onCancel}>
              Cancel
            </Button>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <SpaceBetween direction="horizontal" size="s" alignItems="center">
            <Spinner size="big" />
            <Box>{detail}</Box>
          </SpaceBetween>
          <Box color="text-body-secondary" fontSize="body-s">
            Payments are processed securely by Razorpay. OneBox never sees your card or UPI details.
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
        <div className={styles.spinner} aria-hidden="true" />
        <h2 id="checkout-overlay-title" className={styles.title}>
          Opening secure checkout
        </h2>
        <p className={styles.detail}>{detail}</p>
        <p className={styles.secure}>
          <Icon name="lock" size={16} />
          Payments are processed securely by Razorpay.
        </p>
        <button type="button" className={styles.cancel} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>,
    document.body,
  );
}
