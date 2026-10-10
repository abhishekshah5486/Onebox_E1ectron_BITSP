import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import Icon from '@cloudscape-design/components/icon';
import SpaceBetween from '@cloudscape-design/components/space-between';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useBilling } from './billing';
import styles from './PlanGate.module.css';
import { PLANS, planById, type PlanId } from './plans';

const rank = (id: PlanId) => PLANS.findIndex((plan) => plan.id === id);

// A feature for a higher plan: below it, a locked card offering the upgrade in its place.
// Shown as usual until the plan is known, so nothing flickers locked.
export function PlanGate({
  needs,
  title,
  description,
  children,
}: {
  needs: PlanId;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const plan = useBilling().data?.subscription.plan;
  if (!plan || rank(plan) >= rank(needs)) return <>{children}</>;

  return (
    <Container header={<Header variant="h2">{title}</Header>}>
      <div className={styles.locked}>
        <SpaceBetween size="s" alignItems="center">
          <Icon name="lock-private" size="medium" variant="subtle" />
          <Box variant="h3" padding="n">
            {planById(needs).name} plan required
          </Box>
          <Box color="text-body-secondary" textAlign="center">
            {description}
          </Box>
          <Button variant="primary" onClick={() => void navigate('/plans')}>
            Upgrade plan
          </Button>
        </SpaceBetween>
      </div>
    </Container>
  );
}
