import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Form from '@cloudscape-design/components/form';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Modal from '@cloudscape-design/components/modal';
import Multiselect from '@cloudscape-design/components/multiselect';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Tiles from '@cloudscape-design/components/tiles';
import { useState } from 'react';
import { useCreateIntegration } from '../api/queries';
import {
  INTEGRATION_EVENTS,
  type IntegrationEvent,
  type IntegrationType,
  type IntegrationWithSecret,
} from '../api/settings';
import { toFieldError, type FieldError } from './api-errors';

export function AddIntegrationModal({
  visible,
  onDismiss,
  onCreated,
}: {
  visible: boolean;
  onDismiss: () => void;
  onCreated: (integration: IntegrationWithSecret) => void;
}) {
  const [type, setType] = useState<IntegrationType>('SLACK');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<IntegrationEvent[]>(['email.interested']);
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<FieldError | null>(null);
  const create = useCreateIntegration();

  const clientErrors: Record<string, string | undefined> = {
    name: name.trim() ? undefined : 'Give it a name',
    url: /^https?:\/\/\S+$/.test(url.trim())
      ? undefined
      : 'Enter a full URL starting with https://',
    events: events.length ? undefined : 'Pick at least one event',
  };
  // Host problems (private or unknown host) belong to the URL field in this form.
  const serverField = serverError?.field === 'host' ? 'url' : serverError?.field;
  const errorFor = (field: string) =>
    (submitted ? clientErrors[field] : undefined) ??
    (serverField === field ? serverError?.message : undefined);

  const close = () => {
    setName('');
    setUrl('');
    setEvents(['email.interested']);
    setSubmitted(false);
    setServerError(null);
    create.reset();
    onDismiss();
  };

  const submit = () => {
    setSubmitted(true);
    if (Object.values(clientErrors).some(Boolean)) return;
    const base = { name: name.trim(), events };
    create.mutate(
      type === 'SLACK'
        ? { ...base, type, webhookUrl: url.trim() }
        : { ...base, type, url: url.trim() },
      {
        onSuccess: (integration) => {
          onCreated(integration);
          close();
        },
        onError: (error) => setServerError(toFieldError(error)),
      },
    );
  };

  return (
    <Modal
      visible={visible}
      onDismiss={close}
      header="Add integration"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={close}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit} loading={create.isPending}>
              Add integration
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Form errorText={serverError && !serverField ? serverError.message : undefined}>
          <SpaceBetween size="m">
            <Tiles
              ariaLabel="Integration type"
              value={type}
              onChange={({ detail }) => setType(detail.value as IntegrationType)}
              items={[
                { value: 'SLACK', label: 'Slack', description: 'Post alerts to a channel' },
                {
                  value: 'WEBHOOK',
                  label: 'Webhook',
                  description: 'Send signed JSON to your server',
                },
              ]}
            />
            <FormField label="Name" errorText={errorFor('name')}>
              <Input
                value={name}
                placeholder={type === 'SLACK' ? '#sales alerts' : 'CRM sync'}
                onChange={({ detail }) => {
                  setName(detail.value);
                  setServerError(null);
                }}
                ariaLabel="Name"
              />
            </FormField>
            <FormField
              label={type === 'SLACK' ? 'Slack webhook URL' : 'Endpoint URL'}
              description={
                type === 'SLACK'
                  ? 'In Slack: Apps → Incoming Webhooks → Add to channel, then copy the URL.'
                  : 'Must be https. Each request is signed so you can verify it came from OneBox.'
              }
              errorText={errorFor('url')}
            >
              <Input
                value={url}
                placeholder={
                  type === 'SLACK'
                    ? 'https://hooks.slack.com/services/…'
                    : 'https://example.com/onebox'
                }
                onChange={({ detail }) => {
                  setUrl(detail.value);
                  setServerError(null);
                }}
                ariaLabel="URL"
              />
            </FormField>
            <FormField label="Events" errorText={errorFor('events')}>
              <Multiselect
                ariaLabel="Events"
                selectedOptions={INTEGRATION_EVENTS.filter((event) => events.includes(event.value))}
                options={INTEGRATION_EVENTS}
                onChange={({ detail }) =>
                  setEvents(
                    detail.selectedOptions.map((option) => option.value as IntegrationEvent),
                  )
                }
              />
            </FormField>
          </SpaceBetween>
        </Form>
      </form>
    </Modal>
  );
}
