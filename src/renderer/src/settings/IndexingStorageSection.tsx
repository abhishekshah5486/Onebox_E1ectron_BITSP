import { useCollection } from '@cloudscape-design/collection-hooks';
import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Cards from '@cloudscape-design/components/cards';
import FormField from '@cloudscape-design/components/form-field';
import Header from '@cloudscape-design/components/header';
import Input from '@cloudscape-design/components/input';
import Link from '@cloudscape-design/components/link';
import Modal from '@cloudscape-design/components/modal';
import Pagination from '@cloudscape-design/components/pagination';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import TextFilter from '@cloudscape-design/components/text-filter';
import { useState } from 'react';
import {
  useClearIndexingStore,
  useIndexingStore,
  useSetIndexingStore,
  useVectorStores,
  isOwnStore,
  type OwnIndexingStore,
  type VectorStoreInfo,
} from '../api/providers';
import { describeError } from '../auth/errors';
import { LoadError } from '../ui/LoadError';
import { useFlash } from './flash';
import styles from './ModelProvidersSection.module.css';
import { PAGE_LABELS } from './page-labels';
import { ProviderMark } from './ProviderMark';

const ONEBOX: VectorStoreInfo = {
  id: 'ONEBOX',
  name: 'OneBox hosted',
  description: 'Kept on OneBox’s vector database. Nothing to set up.',
  docsUrl: '',
  icon: null,
  fields: [],
};
const PAGE_SIZE = 6;

// Where semantic search keeps the user's vectors: OneBox's, or a vector database of their own.
// Moving them re-embeds all their mail into the new place.
export function IndexingStorageSection() {
  const current = useIndexingStore();
  const stores = useVectorStores();
  const clear = useClearIndexingStore();
  const flash = useFlash();
  const [configuring, setConfiguring] = useState<VectorStoreInfo | null>(null);
  const [confirmBack, setConfirmBack] = useState(false);
  const inUse = current.data?.provider ?? 'ONEBOX';
  const all = [ONEBOX, ...(stores.data ?? [])];
  const { items, actions, filterProps, paginationProps } = useCollection(all, {
    filtering: {
      filteringFunction: (store, text) =>
        `${store.name} ${store.id} ${store.description}`
          .toLowerCase()
          .includes(text.trim().toLowerCase()),
    },
    pagination: { pageSize: PAGE_SIZE },
  });

  const backToOneBox = () =>
    clear.mutate(undefined, {
      onSuccess: () => {
        setConfirmBack(false);
        flash({
          type: 'success',
          content: 'Search vectors are moving back to OneBox. What’s in your store stays there.',
        });
      },
      onError: (error) => flash({ type: 'error', content: describeError(error) }),
    });

  const status = (store: VectorStoreInfo) =>
    store.id === inUse ? (
      <StatusIndicator type="success">In use</StatusIndicator>
    ) : (
      <Box color="text-body-secondary" fontSize="body-s">
        {store.id === 'ONEBOX' ? 'Default' : 'Vector database'}
      </Box>
    );

  const action = (store: VectorStoreInfo) => {
    if (store.id === 'ONEBOX') {
      return inUse === 'ONEBOX' ? null : (
        <Button onClick={() => setConfirmBack(true)}>Move back</Button>
      );
    }
    return store.id === inUse ? (
      <Button ariaLabel={`Edit ${store.name}`} onClick={() => setConfiguring(store)}>
        Edit
      </Button>
    ) : (
      <Button
        iconName="add-plus"
        ariaLabel={`Configure ${store.name}`}
        onClick={() => setConfiguring(store)}
      >
        Configure
      </Button>
    );
  };

  return (
    <>
      <Cards
        variant="container"
        header={
          <Header
            variant="h2"
            description="Where semantic search keeps the vectors made from your mail."
          >
            Indexing storage
          </Header>
        }
        filter={
          <TextFilter
            {...filterProps}
            filteringPlaceholder="Search…"
            filteringAriaLabel="Search vector databases"
            onChange={({ detail }) => actions.setFiltering(detail.filteringText)}
          />
        }
        pagination={<Pagination {...paginationProps} ariaLabels={PAGE_LABELS} />}
        loading={stores.isPending}
        loadingText="Loading vector databases"
        items={items}
        trackBy="id"
        cardsPerRow={[{ cards: 1 }, { minWidth: 640, cards: 2 }]}
        cardDefinition={{
          header: (store) => (
            <div className={styles.card}>
              <ProviderMark
                providerId={store.id === 'ONEBOX' ? 'onebox' : store.id.toLowerCase()}
                icon={store.icon}
                logoUrl={null}
                name={store.name}
              />
              <div className={styles.cardText}>
                <span className={styles.cardName}>{store.name}</span>
                {status(store)}
              </div>
              {action(store)}
            </div>
          ),
          sections: [
            {
              id: 'description',
              content: (store) => (
                <Box color="text-body-secondary" fontSize="body-s">
                  {store.description}
                </Box>
              ),
            },
          ],
        }}
        empty={
          stores.isError || current.isError ? (
            <LoadError
              error={stores.error ?? current.error}
              header="Indexing storage could not be loaded"
              onRetry={() => void Promise.all([stores.refetch(), current.refetch()])}
            />
          ) : (
            <Box textAlign="center" color="inherit" padding="m">
              <b>No vector databases match “{filterProps.filteringText}”</b>
            </Box>
          )
        }
      />

      {configuring && (
        <ConfigureStoreModal
          store={configuring}
          current={
            isOwnStore(current.data) && current.data.provider === configuring.id
              ? current.data
              : null
          }
          onDismiss={() => setConfiguring(null)}
          onSaved={() => {
            setConfiguring(null);
            flash({
              type: 'success',
              header: `${configuring.name} is connected`,
              content:
                'Your mail is being embedded into it; searches keep working meanwhile. You’ll get a notification once it’s finished.',
            });
          }}
        />
      )}

      <Modal
        visible={confirmBack}
        onDismiss={() => setConfirmBack(false)}
        header="Move search vectors back to OneBox?"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setConfirmBack(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={clear.isPending} onClick={backToOneBox}>
                Move back
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <Alert type="warning">
          All your mail is embedded again on OneBox, and OneBox forgets your store’s address and
          keys. The vectors already in your store stay there.
        </Alert>
      </Modal>
    </>
  );
}

// The store's own fields, as the catalogue describes them. Saved secrets are never shown; left
// blank, they're kept.
function ConfigureStoreModal({
  store,
  current,
  onDismiss,
  onSaved,
}: {
  store: VectorStoreInfo;
  current: OwnIndexingStore | null;
  onDismiss: () => void;
  onSaved: () => void;
}) {
  const save = useSetIndexingStore();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      store.fields.map((field): [string, string] => [
        field.key,
        field.secret ? '' : (current?.settings[field.key] ?? field.default ?? ''),
      ]),
    ),
  );
  const missing = store.fields.some(
    (field) => field.required && !values[field.key]?.trim() && !(field.secret && current),
  );

  const submit = () =>
    save.mutate(
      {
        provider: store.id,
        settings: Object.fromEntries(
          Object.entries(values).filter(([, value]) => value.trim() !== ''),
        ),
      },
      { onSuccess: onSaved },
    );

  return (
    <Modal
      visible
      onDismiss={onDismiss}
      header={
        <span className={styles.card}>
          <ProviderMark
            providerId={store.id.toLowerCase()}
            icon={store.icon}
            logoUrl={null}
            name={store.name}
            size={32}
          />
          {current ? `Edit ${store.name}` : `Connect ${store.name}`}
        </span>
      }
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss}>
              Cancel
            </Button>
            <Button variant="primary" disabled={missing} loading={save.isPending} onClick={submit}>
              {current ? 'Check and update' : 'Check and connect'}
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
        <SpaceBetween size="m">
          <Box color="text-body-secondary">
            {store.description}{' '}
            {store.docsUrl && (
              <Link href={store.docsUrl} external>
                Docs
              </Link>
            )}
          </Box>
          {store.fields.map((field) => (
            <FormField
              key={field.key}
              label={field.required ? field.label : `${field.label} (optional)`}
            >
              <Input
                value={values[field.key] ?? ''}
                type={field.secret ? 'password' : 'text'}
                autoComplete={false}
                placeholder={
                  field.secret && current
                    ? current.keyHint
                      ? `Saved (…${current.keyHint})`
                      : 'Saved'
                    : field.placeholder
                }
                onChange={({ detail }) =>
                  setValues((before) => ({ ...before, [field.key]: detail.value }))
                }
              />
            </FormField>
          ))}
          {save.isError && (
            <Alert type="error" header="Couldn't connect">
              {describeError(save.error)}
            </Alert>
          )}
          {/* Enter submits. */}
          <button type="submit" hidden />
        </SpaceBetween>
      </form>
    </Modal>
  );
}
