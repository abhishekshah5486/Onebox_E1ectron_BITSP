import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ButtonDropdown from '@cloudscape-design/components/button-dropdown';
import Header from '@cloudscape-design/components/header';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Table from '@cloudscape-design/components/table';
import { useState } from 'react';
import {
  useIntegrations,
  useRemoveIntegration,
  useRotateSecret,
  useTestIntegration,
  useUpdateIntegration,
} from '../api/queries';
import { INTEGRATION_EVENTS, type Integration } from '../api/settings';
import { describeError } from '../auth/errors';
import { AddIntegrationModal } from './AddIntegrationModal';
import { useFlash } from './flash';
import { SecretModal } from './SecretModal';

function IntegrationStatus({ item }: { item: Integration }) {
  if (!item.enabled) return <StatusIndicator type="stopped">Disabled</StatusIndicator>;
  if (item.lastTestOk === null) return <StatusIndicator type="pending">Not tested</StatusIndicator>;
  return item.lastTestOk ? (
    <StatusIndicator type="success">Working</StatusIndicator>
  ) : (
    <span title={item.lastError ?? undefined}>
      <StatusIndicator type="error">Failing</StatusIndicator>
    </span>
  );
}

const eventLabel = (value: string) =>
  INTEGRATION_EVENTS.find((e) => e.value === value)?.label ?? value;

export function IntegrationsSection() {
  const integrations = useIntegrations();
  const test = useTestIntegration();
  const update = useUpdateIntegration();
  const rotate = useRotateSecret();
  const remove = useRemoveIntegration();
  const flash = useFlash();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);

  const items = integrations.data ?? [];
  const current = items.find((item) => item.id === selectedId) ?? null;
  const fail = (error: unknown) => flash({ type: 'error', content: describeError(error) });

  const actionItems = current
    ? [
        { id: 'toggle', text: current.enabled ? 'Disable' : 'Enable' },
        ...(current.type === 'WEBHOOK' ? [{ id: 'rotate', text: 'Rotate signing secret' }] : []),
        { id: 'remove', text: 'Remove' },
      ]
    : [];

  const onAction = (id: string) => {
    if (!current) return;
    if (id === 'toggle') {
      update.mutate({ id: current.id, enabled: !current.enabled }, { onError: fail });
    } else if (id === 'rotate') {
      rotate.mutate(current.id, {
        onSuccess: (result) => setSecret(result.secret ?? null),
        onError: fail,
      });
    } else if (id === 'remove') {
      setConfirmRemove(true);
    }
  };

  return (
    <>
      <Table
        variant="container"
        loading={integrations.isLoading}
        loadingText="Loading integrations"
        selectionType="single"
        selectedItems={current ? [current] : []}
        onSelectionChange={({ detail }) => setSelectedId(detail.selectedItems[0]?.id ?? null)}
        trackBy="id"
        items={items}
        ariaLabels={{
          selectionGroupLabel: 'Integrations',
          itemSelectionLabel: (_, item) => item.name,
          allItemsSelectionLabel: () => 'all',
        }}
        header={
          <Header
            variant="h2"
            counter={items.length ? `(${items.length})` : undefined}
            description="Bring OneBox events into the tools you use"
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  disabled={!current}
                  loading={test.isPending}
                  onClick={() =>
                    current &&
                    test.mutate(current.id, {
                      onSuccess: (result) =>
                        flash(
                          result.ok
                            ? {
                                type: 'success',
                                content: `Test message delivered to ${current.name}.`,
                              }
                            : {
                                type: 'error',
                                header: `${current.name} did not accept the test`,
                                content: result.error,
                              },
                        ),
                      onError: fail,
                    })
                  }
                >
                  Send test
                </Button>
                <ButtonDropdown
                  disabled={!current}
                  items={actionItems}
                  onItemClick={({ detail }) => onAction(detail.id)}
                >
                  Actions
                </ButtonDropdown>
                <Button variant="primary" onClick={() => setAdding(true)}>
                  Add integration
                </Button>
              </SpaceBetween>
            }
          >
            Integrations
          </Header>
        }
        columnDefinitions={[
          { id: 'name', header: 'Name', cell: (item) => <Box fontWeight="bold">{item.name}</Box> },
          {
            id: 'type',
            header: 'Type',
            cell: (item) => (item.type === 'SLACK' ? 'Slack' : 'Webhook'),
          },
          { id: 'target', header: 'Destination', cell: (item) => item.target },
          {
            id: 'events',
            header: 'Events',
            cell: (item) => item.events.map(eventLabel).join(', '),
          },
          { id: 'status', header: 'Status', cell: (item) => <IntegrationStatus item={item} /> },
        ]}
        empty={
          <Box textAlign="center" color="inherit" padding="m">
            <SpaceBetween size="xs">
              <b>No integrations yet</b>
              <Box color="inherit">Send alerts to Slack or signed events to your own systems.</Box>
              <Button onClick={() => setAdding(true)}>Add integration</Button>
            </SpaceBetween>
          </Box>
        }
      />

      <AddIntegrationModal
        visible={adding}
        onDismiss={() => setAdding(false)}
        onCreated={(integration) => {
          flash({
            type: 'success',
            content: `Added ${integration.name}. Send a test to check it.`,
          });
          if (integration.secret) setSecret(integration.secret);
        }}
      />
      <SecretModal secret={secret} onDismiss={() => setSecret(null)} />

      <Modal
        visible={confirmRemove && !!current}
        onDismiss={() => setConfirmRemove(false)}
        header="Remove integration"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setConfirmRemove(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={remove.isPending}
                onClick={() =>
                  current &&
                  remove.mutate(current.id, {
                    onSuccess: () => {
                      flash({ type: 'success', content: `Removed ${current.name}.` });
                      setSelectedId(null);
                      setConfirmRemove(false);
                    },
                    onError: fail,
                  })
                }
              >
                Remove
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        Remove <b>{current?.name}</b>? OneBox will stop sending events to it.
      </Modal>
    </>
  );
}
