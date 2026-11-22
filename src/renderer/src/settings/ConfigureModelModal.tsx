import Alert from '@cloudscape-design/components/alert';
import Autosuggest from '@cloudscape-design/components/autosuggest';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Form from '@cloudscape-design/components/form';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Link from '@cloudscape-design/components/link';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Textarea from '@cloudscape-design/components/textarea';
import Toggle from '@cloudscape-design/components/toggle';
import { useMemo, useState } from 'react';
import {
  useAddUserModel,
  useDiscoverModels,
  useProvider,
  useUpdateUserModel,
  type CatalogModel,
  type ModelKind,
  type ProviderField,
  type UserModel,
} from '../api/providers';
import { describeError } from '../auth/errors';
import { ProviderMark } from './ProviderMark';

const tokens = (count: number | null) => (count ? `${count.toLocaleString()} tokens` : null);

// What the model list says about each model, to tell them apart while picking.
function describeModel(model: CatalogModel) {
  return [
    tokens(model.contextTokens) && `${tokens(model.contextTokens)} context`,
    model.reasoning && 'reasoning',
    model.multimodal && 'images',
    model.usdPerMillion && `$${model.usdPerMillion.input} / $${model.usdPerMillion.output} per 1M`,
  ]
    .filter(Boolean)
    .join(' · ');
}

const fitsKind = (model: CatalogModel, kind: ModelKind) =>
  !model.deprecated && (kind === 'embedding' ? model.embedding : !model.embedding);

function CredentialField({
  field,
  value,
  editing,
  onChange,
}: {
  field: ProviderField;
  value: string;
  editing: UserModel | null;
  onChange: (value: string) => void;
}) {
  // Saved values never come back, so editing leaves every field optional.
  const kept = editing
    ? field.secret && editing.keyHint
      ? `Saved (${editing.keyHint})`
      : 'Saved'
    : '';
  const label = field.required && !editing ? field.label : `${field.label} (optional)`;
  return (
    <FormField
      label={label}
      constraintText={editing ? 'Leave empty to keep what is saved.' : undefined}
    >
      {field.multiline ? (
        <Textarea
          value={value}
          rows={4}
          placeholder={kept || field.default}
          ariaLabel={field.label}
          onChange={({ detail }) => onChange(detail.value)}
        />
      ) : (
        <Input
          value={value}
          type={field.secret ? 'password' : 'text'}
          placeholder={kept || field.default}
          autoComplete={false}
          ariaLabel={field.label}
          onChange={({ detail }) => onChange(detail.value)}
        />
      )}
    </FormField>
  );
}

// Adds a model from a provider with the user's own credentials, or changes one. The server
// checks the credentials with a real call before saving.
export function ConfigureModelModal({
  providerId,
  kind,
  editing = null,
  onDismiss,
  onSaved,
}: {
  providerId: string;
  kind: ModelKind;
  editing?: UserModel | null;
  onDismiss: () => void;
  onSaved: (model: UserModel) => void;
}) {
  const provider = useProvider(providerId);
  const discover = useDiscoverModels();
  const add = useAddUserModel();
  const update = useUpdateUserModel();
  const saving = editing ? update : add;
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [modelId, setModelId] = useState(editing?.modelId ?? '');
  const [name, setName] = useState(editing?.name ?? '');
  const [context, setContext] = useState(editing?.contextTokens?.toString() ?? '');
  const [reasoning, setReasoning] = useState(editing?.reasoning ?? false);
  const [multimodal, setMultimodal] = useState(editing?.multimodal ?? false);

  const fields = provider.data?.fields ?? [];
  const catalog = useMemo(
    () => (provider.data?.models ?? []).filter((model) => fitsKind(model, kind)),
    [provider.data, kind],
  );
  const found = discover.data?.items.filter((id) => !catalog.some((m) => m.id === id)) ?? [];
  const options = [
    ...catalog.map((model) => ({
      value: model.id,
      label: model.name === model.id ? model.id : `${model.name}`,
      description:
        model.name === model.id ? describeModel(model) : `${model.id} · ${describeModel(model)}`,
    })),
    ...found.map((id) => ({ value: id, description: 'Found with your credentials' })),
  ];
  const filled = (key: string) => (settings[key] ?? '').trim() !== '';
  const missing =
    !modelId.trim() ||
    (!editing && fields.some((field) => field.required && !field.default && !filled(field.key)));

  // Picking a known model fills in what the catalogue knows about it.
  const pick = (id: string) => {
    setModelId(id);
    const known = catalog.find((model) => model.id === id);
    if (!known) return;
    if (known.contextTokens) setContext(known.contextTokens.toString());
    setReasoning(known.reasoning);
    setMultimodal(known.multimodal);
  };

  // What was typed, with defaults filled in when adding; empty fields are left out.
  const typed = (): Record<string, string> =>
    Object.fromEntries(
      fields
        .map((field): [string, string] => [
          field.key,
          (settings[field.key] ?? '').trim() || (editing ? '' : (field.default ?? '')),
        ])
        .filter(([, value]) => value !== ''),
    );
  const contextTokens = Number.parseInt(context, 10) || undefined;

  const save = () => {
    const shared = {
      modelId: modelId.trim(),
      ...(name.trim() && { name: name.trim() }),
      ...(contextTokens && { contextTokens }),
      ...(kind === 'llm' && { reasoning, multimodal }),
    };
    if (editing) {
      const changed = typed();
      update.mutate(
        {
          id: editing.id,
          changes: { ...shared, ...(Object.keys(changed).length && { settings: changed }) },
        },
        { onSuccess: onSaved },
      );
    } else {
      add.mutate({ kind, providerId, settings: typed(), ...shared }, { onSuccess: onSaved });
    }
  };

  const title = provider.data?.name ?? providerId;
  return (
    <Modal
      visible
      size="medium"
      onDismiss={onDismiss}
      header={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <ProviderMark logoUrl={provider.data?.logoUrl ?? null} name={title} size={24} />
          {editing ? `Edit ${editing.name}` : `Configure ${title}`}
        </span>
      }
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss}>
              Cancel
            </Button>
            <Button variant="primary" disabled={missing} loading={saving.isPending} onClick={save}>
              {editing ? 'Save' : 'Check and add'}
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      {provider.isPending ? (
        <StatusIndicator type="loading">Loading {providerId}</StatusIndicator>
      ) : provider.isError ? (
        <Alert type="error">{describeError(provider.error)}</Alert>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!missing) save();
          }}
        >
          <Form>
            <SpaceBetween size="m">
              {provider.data?.docsUrl && (
                <Box variant="small" color="text-body-secondary">
                  Get your credentials from{' '}
                  <Link href={provider.data.docsUrl} external variant="primary" fontSize="body-s">
                    {title}'s docs
                  </Link>
                  .
                </Box>
              )}
              {fields.map((field) => (
                <CredentialField
                  key={field.key}
                  field={field}
                  value={settings[field.key] ?? ''}
                  editing={editing}
                  onChange={(value) => setSettings((old) => ({ ...old, [field.key]: value }))}
                />
              ))}
              <FormField
                label="Model"
                description={
                  catalog.length
                    ? `${catalog.length} ${kind === 'embedding' ? 'embedding ' : ''}models listed; any other model name works too.`
                    : 'Type the model name, or find the ones your credentials can use.'
                }
                secondaryControl={
                  <Button
                    iconName="search"
                    loading={discover.isPending}
                    onClick={() => discover.mutate({ id: providerId, settings: typed() })}
                  >
                    Find models
                  </Button>
                }
                errorText={discover.isError ? describeError(discover.error) : undefined}
              >
                <Autosuggest
                  value={modelId}
                  options={options}
                  ariaLabel="Model"
                  placeholder={
                    kind === 'embedding' ? 'text-embedding-3-small' : 'Pick or type a model'
                  }
                  enteredTextLabel={(value) => `Use "${value}"`}
                  empty="No models listed"
                  onChange={({ detail }) => pick(detail.value)}
                  filteringType="auto"
                />
              </FormField>
              <ColumnLayout columns={2}>
                <FormField label="Display name (optional)">
                  <Input
                    value={name}
                    placeholder={modelId || 'My model'}
                    onChange={({ detail }) => setName(detail.value)}
                  />
                </FormField>
                <FormField label="Context length (tokens)">
                  <Input
                    value={context}
                    type="number"
                    inputMode="numeric"
                    placeholder="128000"
                    onChange={({ detail }) => setContext(detail.value)}
                  />
                </FormField>
              </ColumnLayout>
              {kind === 'llm' && (
                <SpaceBetween size="xs">
                  <Toggle
                    checked={reasoning}
                    onChange={({ detail }) => setReasoning(detail.checked)}
                  >
                    Reasoning model
                  </Toggle>
                  <Toggle
                    checked={multimodal}
                    onChange={({ detail }) => setMultimodal(detail.checked)}
                  >
                    Understands images
                  </Toggle>
                </SpaceBetween>
              )}
              {saving.isError && (
                <Alert type="error" header="Couldn't save this model">
                  {describeError(saving.error)}
                </Alert>
              )}
              <Box variant="small" color="text-body-secondary">
                Your credentials are stored encrypted and never shown again. Calls with your own key
                don't use OneBox credits; they still show in usage.
              </Box>
            </SpaceBetween>
          </Form>
        </form>
      )}
    </Modal>
  );
}
