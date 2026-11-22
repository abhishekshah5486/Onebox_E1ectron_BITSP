import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Form from '@cloudscape-design/components/form';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Modal from '@cloudscape-design/components/modal';
import Select from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { useState } from 'react';
import { useConnectStorageKeys } from '../api/queries';
import type {
  KeyStorageConnect,
  KeyStorageProviderId,
  S3Preset,
  StorageAccount,
} from '../api/settings';
import { describeError } from '../auth/errors';
import { STORAGE_PROVIDERS } from '../storage/providers';

type Values = Record<string, string>;

// What the form asks for, given the service (for S3, the preset picked).
function fieldsFor(provider: KeyStorageProviderId, preset: S3Preset | undefined) {
  if (provider === 'AZURE_BLOB') {
    return [
      { key: 'accountName', label: 'Storage account name', placeholder: 'mystorageaccount' },
      { key: 'container', label: 'Container', placeholder: 'onebox' },
      { key: 'accountKey', label: 'Account key', secret: true },
    ];
  }
  return [
    ...(preset?.needsEndpoint
      ? [{ key: 'endpoint', label: 'Endpoint', placeholder: 'https://minio.example.com' }]
      : []),
    ...(preset?.needsAccount ? [{ key: 'account', label: 'Account ID' }] : []),
    { key: 'bucket', label: 'Bucket', placeholder: 'onebox-files' },
    { key: 'region', label: 'Region' },
    { key: 'accessKeyId', label: 'Access key ID' },
    { key: 'secretAccessKey', label: 'Secret access key', secret: true },
  ];
}

function bodyOf(provider: KeyStorageProviderId, presetId: string, values: Values) {
  const value = (key: string) => values[key]?.trim() ?? '';
  const optional = (key: string) => (value(key) ? { [key]: value(key) } : {});
  if (provider === 'AZURE_BLOB') {
    return {
      provider,
      credentials: {
        accountName: value('accountName'),
        accountKey: value('accountKey'),
        container: value('container'),
      },
    } satisfies KeyStorageConnect;
  }
  return {
    provider,
    credentials: {
      preset: presetId,
      bucket: value('bucket'),
      region: value('region'),
      accessKeyId: value('accessKeyId'),
      secretAccessKey: value('secretAccessKey'),
      ...optional('account'),
      ...optional('endpoint'),
    },
  } satisfies KeyStorageConnect;
}

// Connects a bucket or container with keys. OneBox writes a small file to it first, so keys
// that can't save files are caught here.
export function KeyStorageModal({
  provider,
  presets,
  onDismiss,
  onConnected,
}: {
  provider: KeyStorageProviderId;
  presets: S3Preset[];
  onDismiss: () => void;
  onConnected: (account: StorageAccount) => void;
}) {
  const connect = useConnectStorageKeys();
  const [presetId, setPresetId] = useState(presets[0]?.id ?? 'custom');
  const preset = presets.find((p) => p.id === presetId);
  const [values, setValues] = useState<Values>({ region: preset?.region ?? '' });
  const fields = fieldsFor(provider, preset);
  const missing = fields.some((field) => !values[field.key]?.trim());
  const name = STORAGE_PROVIDERS[provider].name;

  const submit = () =>
    connect.mutate(bodyOf(provider, presetId, values), { onSuccess: onConnected });

  return (
    <Modal
      visible
      onDismiss={onDismiss}
      header={`Connect ${name}`}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={missing}
              loading={connect.isPending}
              onClick={submit}
            >
              Check and connect
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!missing) submit();
        }}
      >
        <Form>
          <SpaceBetween size="m">
            {provider === 'S3' && (
              <FormField label="Service">
                <Select
                  selectedOption={{ value: presetId, label: preset?.name ?? presetId }}
                  options={presets.map((p) => ({ value: p.id, label: p.name }))}
                  onChange={({ detail }) => {
                    const next = presets.find((p) => p.id === detail.selectedOption.value);
                    setPresetId(detail.selectedOption.value!);
                    setValues((old) => ({ ...old, region: next?.region ?? old.region ?? '' }));
                  }}
                />
              </FormField>
            )}
            {fields.map((field) => (
              <FormField key={field.key} label={field.label}>
                <Input
                  value={values[field.key] ?? ''}
                  type={field.secret ? 'password' : 'text'}
                  placeholder={field.placeholder}
                  autoComplete={false}
                  onChange={({ detail }) =>
                    setValues((old) => ({ ...old, [field.key]: detail.value }))
                  }
                />
              </FormField>
            ))}
            {connect.isError && (
              <Alert type="error" header="Couldn't connect">
                {describeError(connect.error)}
              </Alert>
            )}
            <Box variant="small" color="text-body-secondary">
              Keys are stored encrypted and only used to save the files you choose. OneBox checks
              them by writing and deleting a small test file.
            </Box>
          </SpaceBetween>
        </Form>
      </form>
    </Modal>
  );
}
