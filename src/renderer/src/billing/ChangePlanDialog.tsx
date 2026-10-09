import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { useUiVersion } from '../theme/UiVersionProvider';
import { Dialog } from '../ui/Dialog';
import { formatCredits, type BillingInterval, type Plan } from './plans';

export interface PlanChange {
  from: Plan;
  to: Plan;
  interval: BillingInterval;
}

const describe = ({ from, to, interval }: PlanChange) =>
  `You'll move from ${from.name} to ${to.name}, billed ${interval === 'annual' ? 'yearly' : 'monthly'}, straight away. ` +
  `The difference for the rest of this billing period is charged now, and your credits reset to ` +
  `${to.name}'s ${formatCredits(to.credits)} a month.`;

// Confirms moving a paid plan to another one, in the look of each interface.
export function ChangePlanDialog({
  change,
  onConfirm,
  onCancel,
}: {
  change: PlanChange | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { version } = useUiVersion();
  if (!change) return null;
  const title = `Switch to ${change.to.name}?`;
  const confirmLabel = `Switch to ${change.to.name}`;

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
              <Button variant="primary" onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        {describe(change)}
      </Modal>
    );
  }
  return (
    <Dialog title={title} confirmLabel={confirmLabel} onConfirm={onConfirm} onCancel={onCancel}>
      {describe(change)}
    </Dialog>
  );
}
