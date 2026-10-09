import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Form from '@cloudscape-design/components/form';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Link from '@cloudscape-design/components/link';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Tiles from '@cloudscape-design/components/tiles';
import Toggle from '@cloudscape-design/components/toggle';
import { useState } from 'react';
import type { Account, CreateAccountInput } from '../api/accounts';
import { useCreateAccount } from '../api/queries';
import { toFieldError, type FieldError } from './api-errors';
import { PROVIDER_CHOICES } from './providers';

const EMPTY = {
  emailAddress: '',
  displayName: '',
  password: '',
  host: '',
  port: '993',
  tls: true,
  username: '',
};

export function AddAccountModal({
  visible,
  onDismiss,
  onConnected,
}: {
  visible: boolean;
  onDismiss: () => void;
  onConnected: (account: Account) => void;
}) {
  const [choiceId, setChoiceId] = useState('gmail');
  const choice = PROVIDER_CHOICES.find((c) => c.id === choiceId) ?? PROVIDER_CHOICES[0]!;
  const provider = choice.provider;
  const [form, setForm] = useState(EMPTY);
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<FieldError | null>(null);
  const create = useCreateAccount();

  const set = (key: keyof typeof EMPTY) => (value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }));
    setServerError(null);
  };

  const port = Number(form.port);
  const clientErrors: Record<string, string | undefined> = {
    emailAddress: /^\S+@\S+\.\S+$/.test(form.emailAddress.trim())
      ? undefined
      : 'Enter a valid email address',
    password: form.password ? undefined : 'Enter the password',
    host:
      provider !== 'IMAP' || form.host.trim()
        ? undefined
        : 'Enter the IMAP server, e.g. imap.example.com',
    port:
      provider !== 'IMAP' || (Number.isInteger(port) && port > 0 && port < 65536)
        ? undefined
        : 'Port must be between 1 and 65535',
  };
  const errorFor = (field: string) =>
    (submitted ? clientErrors[field] : undefined) ??
    (serverError?.field === field ? serverError.message : undefined);

  const close = () => {
    setForm(EMPTY);
    setSubmitted(false);
    setServerError(null);
    create.reset();
    onDismiss();
  };

  const submit = () => {
    setSubmitted(true);
    if (Object.values(clientErrors).some(Boolean)) return;
    const base = {
      emailAddress: form.emailAddress.trim(),
      password: form.password,
      ...(form.displayName.trim() && { displayName: form.displayName.trim() }),
    };
    const input: CreateAccountInput =
      provider === 'IMAP'
        ? {
            ...base,
            provider,
            imap: { host: form.host.trim(), port, tls: form.tls },
            ...(form.username.trim() && { username: form.username.trim() }),
          }
        : { ...base, provider: choice.provider as Exclude<typeof provider, 'IMAP'> };
    create.mutate(input, {
      onSuccess: (account) => {
        onConnected(account);
        close();
      },
      onError: (error) => setServerError(toFieldError(error)),
    });
  };

  return (
    <Modal
      visible={visible}
      onDismiss={close}
      header="Connect an email account"
      size="medium"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={close} disabled={create.isPending}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit} loading={create.isPending}>
              {create.isPending ? 'Checking connection…' : 'Connect'}
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
        <Form errorText={serverError && !serverError.field ? serverError.message : undefined}>
          <SpaceBetween size="m">
            <Tiles
              ariaLabel="Provider"
              value={choiceId}
              onChange={({ detail }) => {
                setChoiceId(detail.value);
                setServerError(null);
              }}
              columns={3}
              items={PROVIDER_CHOICES.map(({ id, label, description }) => ({
                value: id,
                label,
                description,
              }))}
            />
            <FormField label="Email address" errorText={errorFor('emailAddress')}>
              <Input
                type="email"
                value={form.emailAddress}
                onChange={({ detail }) => set('emailAddress')(detail.value)}
                ariaLabel="Email address"
                autoFocus
              />
            </FormField>
            <FormField
              label="Password"
              description={choice.passwordHelp}
              errorText={errorFor('password')}
              info={
                choice.appPasswordUrl ? (
                  <Link external href={choice.appPasswordUrl}>
                    Create one
                  </Link>
                ) : undefined
              }
            >
              <Input
                type="password"
                value={form.password}
                onChange={({ detail }) => set('password')(detail.value)}
                ariaLabel="Password"
              />
            </FormField>
            {provider === 'IMAP' && (
              <ColumnLayout columns={2}>
                <FormField label="IMAP server" errorText={errorFor('host')}>
                  <Input
                    value={form.host}
                    placeholder="imap.example.com"
                    onChange={({ detail }) => set('host')(detail.value)}
                    ariaLabel="IMAP server"
                  />
                </FormField>
                <FormField label="Port" errorText={errorFor('port')}>
                  <Input
                    type="number"
                    value={form.port}
                    onChange={({ detail }) => set('port')(detail.value)}
                    ariaLabel="Port"
                  />
                </FormField>
                <FormField label="Username" description="Leave empty to use the email address">
                  <Input
                    value={form.username}
                    onChange={({ detail }) => set('username')(detail.value)}
                    ariaLabel="Username"
                  />
                </FormField>
                <FormField label="Security">
                  <Toggle checked={form.tls} onChange={({ detail }) => set('tls')(detail.checked)}>
                    Use SSL/TLS
                  </Toggle>
                </FormField>
              </ColumnLayout>
            )}
            {provider !== 'IMAP' && errorFor('host') && (
              <Box color="text-status-error">{errorFor('host')}</Box>
            )}
            <FormField label="Display name" description="Optional, shown in your unified inbox">
              <Input
                value={form.displayName}
                placeholder="Work"
                onChange={({ detail }) => set('displayName')(detail.value)}
                ariaLabel="Display name"
              />
            </FormField>
          </SpaceBetween>
        </Form>
      </form>
    </Modal>
  );
}
