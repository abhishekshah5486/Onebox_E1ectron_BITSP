import { useCollection } from '@cloudscape-design/collection-hooks';
import Alert from '@cloudscape-design/components/alert';
import Badge from '@cloudscape-design/components/badge';
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
import Table from '@cloudscape-design/components/table';
import TextFilter from '@cloudscape-design/components/text-filter';
import { useState } from 'react';
import { useSemanticStatus, type SemanticStatus } from '../api/ai';
import {
  ONEBOX_STORE,
  useAddIndexingStore,
  useIndexingStores,
  useRemoveIndexingStore,
  useSearchWithStore,
  useUpdateIndexingStore,
  useVectorStores,
  type IndexingStore,
  type VectorStoreInfo,
} from '../api/providers';
import { describeError } from '../auth/errors';
import { LoadError } from '../ui/LoadError';
import { useFlash } from './flash';
import styles from './ModelProvidersSection.module.css';
import { PAGE_LABELS } from './page-labels';
import { ProviderMark } from './ProviderMark';

const PAGE_SIZE = 6;
const markId = (provider: string) => provider.toLowerCase();

type StoreStatus = NonNullable<SemanticStatus['stores']>[number];

// Like a phone's photo backups: every store that isn't paused gets each new email; a paused one
// catches up on only what it missed once resumed.
function StatusCell({ store, status }: { store: IndexingStore; status?: StoreStatus | undefined }) {
  if (store.paused) return <StatusIndicator type="stopped">Paused</StatusIndicator>;
  if (status?.catchup) {
    return (
      <StatusIndicator type="in-progress">
        Backing up {status.catchup.done.toLocaleString()} of {status.catchup.total.toLocaleString()}
      </StatusIndicator>
    );
  }
  if (status && !status.upToDate) {
    return <StatusIndicator type="pending">Waiting to back up</StatusIndicator>;
  }
  return <StatusIndicator type="success">Backed up</StatusIndicator>;
}

// Where semantic search keeps the vectors made from the user's mail: OneBox's own store and any
// number of vector databases of theirs, several of one kind too. One answers searches.
export function IndexingStorageSection() {
  const current = useIndexingStores();
  const catalogue = useVectorStores();
  const semantic = useSemanticStatus();
  const update = useUpdateIndexingStore();
  const searchWith = useSearchWithStore();
  const remove = useRemoveIndexingStore();
  const flash = useFlash();
  const [configuring, setConfiguring] = useState<{
    info: VectorStoreInfo;
    editing: IndexingStore | null;
  } | null>(null);
  const [removing, setRemoving] = useState<IndexingStore | null>(null);
  const mine = current.data?.stores ?? [];
  const infoOf = (provider: string) => catalogue.data?.find((info) => info.id === provider);
  const statusOf = (id: string) => semantic.data?.stores?.find((status) => status.id === id);
  const failed = (error: unknown) => flash({ type: 'error', content: describeError(error) });

  const { items, actions, filterProps, paginationProps } = useCollection(catalogue.data ?? [], {
    filtering: {
      filteringFunction: (info, text) =>
        `${info.name} ${info.id} ${info.description}`
          .toLowerCase()
          .includes(text.trim().toLowerCase()),
    },
    pagination: { pageSize: PAGE_SIZE },
  });

  const setPaused = (store: IndexingStore, paused: boolean) =>
    update.mutate(
      { id: store.id, paused },
      {
        onSuccess: () =>
          flash({
            type: 'success',
            content: paused
              ? `${store.name} is paused. New mail isn’t backed up to it until you resume it.`
              : `${store.name} is backing up again, starting with only the mail it missed.`,
          }),
        onError: failed,
      },
    );

  const switchSearch = (store: IndexingStore) =>
    searchWith.mutate(store.id, {
      onSuccess: () => flash({ type: 'success', content: `Searches now go to ${store.name}.` }),
      onError: failed,
    });

  return (
    <SpaceBetween size="l">
      <Table
        variant="container"
        header={
          <Header
            variant="h2"
            counter={mine.length ? `(${mine.length})` : undefined}
            description="Your mail’s search vectors are backed up to every store that isn’t paused. Searches use the one marked Search."
          >
            Indexing storage
          </Header>
        }
        loading={current.isPending}
        loadingText="Loading your vector stores"
        items={mine}
        trackBy="id"
        columnDefinitions={[
          {
            id: 'name',
            header: 'Store',
            cell: (store) => (
              <span className={styles.modelCell}>
                <ProviderMark
                  providerId={markId(store.provider)}
                  icon={infoOf(store.provider)?.icon}
                  logoUrl={null}
                  name={store.name}
                  size={28}
                />
                <span>
                  <Box fontWeight="bold">
                    {store.name} {store.search && <Badge color="blue">Search</Badge>}
                  </Box>
                  <Box color="text-body-secondary" fontSize="body-s">
                    {store.provider === 'ONEBOX'
                      ? 'Hosted by OneBox'
                      : (infoOf(store.provider)?.name ?? store.provider)}
                  </Box>
                </span>
              </span>
            ),
          },
          {
            id: 'status',
            header: 'Backup',
            cell: (store) => <StatusCell store={store} status={statusOf(store.id)} />,
          },
          {
            id: 'actions',
            header: 'Actions',
            cell: (store) => {
              const info = infoOf(store.provider);
              return (
                <SpaceBetween direction="horizontal" size="xs">
                  {!store.search && (
                    <Button
                      variant="inline-link"
                      ariaLabel={`Search with ${store.name}`}
                      onClick={() => switchSearch(store)}
                    >
                      Use for search
                    </Button>
                  )}
                  {!store.search && (
                    <Button
                      variant="inline-link"
                      ariaLabel={`${store.paused ? 'Resume' : 'Pause'} ${store.name}`}
                      onClick={() => setPaused(store, !store.paused)}
                    >
                      {store.paused ? 'Resume' : 'Pause'}
                    </Button>
                  )}
                  {store.id !== ONEBOX_STORE && info && (
                    <Button
                      variant="inline-link"
                      ariaLabel={`Edit ${store.name}`}
                      onClick={() => setConfiguring({ info, editing: store })}
                    >
                      Edit
                    </Button>
                  )}
                  {store.id !== ONEBOX_STORE && (
                    <Button
                      variant="inline-link"
                      ariaLabel={`Remove ${store.name}`}
                      onClick={() => setRemoving(store)}
                    >
                      Remove
                    </Button>
                  )}
                </SpaceBetween>
              );
            },
          },
        ]}
        empty={
          current.isError ? (
            <LoadError
              error={current.error}
              header="Your vector stores could not be loaded"
              onRetry={() => void current.refetch()}
            />
          ) : null
        }
      />

      <Cards
        variant="container"
        header={
          <Header
            variant="h2"
            description="Add as many as you like, several of one kind too. Each new one is filled with all your mail."
          >
            Add a vector database
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
        loading={catalogue.isPending}
        loadingText="Loading vector databases"
        items={items}
        trackBy="id"
        cardsPerRow={[{ cards: 1 }, { minWidth: 640, cards: 2 }]}
        cardDefinition={{
          header: (info) => {
            const count = mine.filter((store) => store.provider === info.id).length;
            return (
              <div className={styles.card}>
                <ProviderMark
                  providerId={markId(info.id)}
                  icon={info.icon}
                  logoUrl={null}
                  name={info.name}
                />
                <div className={styles.cardText}>
                  <span className={styles.cardName}>{info.name}</span>
                  <Box color="text-body-secondary" fontSize="body-s">
                    {count ? `${count} added` : 'Vector database'}
                  </Box>
                </div>
                <Button
                  iconName="add-plus"
                  ariaLabel={`Add ${info.name}`}
                  onClick={() => setConfiguring({ info, editing: null })}
                >
                  Add
                </Button>
              </div>
            );
          },
          sections: [
            {
              id: 'description',
              content: (info) => (
                <Box color="text-body-secondary" fontSize="body-s">
                  {info.description}
                </Box>
              ),
            },
          ],
        }}
        empty={
          catalogue.isError ? (
            <LoadError
              error={catalogue.error}
              header="Vector databases could not be loaded"
              onRetry={() => void catalogue.refetch()}
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
          info={configuring.info}
          editing={configuring.editing}
          onDismiss={() => setConfiguring(null)}
          onSaved={(name) => {
            const edited = Boolean(configuring.editing);
            setConfiguring(null);
            flash({
              type: 'success',
              header: edited ? `${name} saved` : `${name} added`,
              content: edited
                ? 'Searches and backups use the new settings.'
                : 'All your mail is being backed up to it; searches keep working meanwhile.',
            });
          }}
        />
      )}

      <Modal
        visible={removing !== null}
        onDismiss={() => setRemoving(null)}
        header={`Remove ${removing?.name ?? 'store'}?`}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setRemoving(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={remove.isPending}
                onClick={() =>
                  removing &&
                  remove.mutate(removing.id, {
                    onSuccess: () => {
                      flash({ type: 'success', content: `${removing.name} removed.` });
                      setRemoving(null);
                    },
                    onError: failed,
                  })
                }
              >
                Remove
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <Alert type="warning">
          OneBox forgets this store’s address and keys and stops backing up to it. The vectors
          already in it stay there.
          {removing?.search && ' Searches go back to OneBox’s own store.'}
        </Alert>
      </Modal>
    </SpaceBetween>
  );
}

// The store's own fields, as the catalogue describes them. Saved secrets are never shown; left
// blank, they're kept.
function ConfigureStoreModal({
  info,
  editing,
  onDismiss,
  onSaved,
}: {
  info: VectorStoreInfo;
  editing: IndexingStore | null;
  onDismiss: () => void;
  onSaved: (name: string) => void;
}) {
  const add = useAddIndexingStore();
  const update = useUpdateIndexingStore();
  const save = editing ? update : add;
  const [name, setName] = useState(editing?.name ?? '');
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      info.fields.map((field): [string, string] => [
        field.key,
        field.secret ? '' : (editing?.settings?.[field.key] ?? field.default ?? ''),
      ]),
    ),
  );
  const missing = info.fields.some(
    (field) => field.required && !values[field.key]?.trim() && !(field.secret && editing),
  );

  const submit = () => {
    const settings = Object.fromEntries(
      Object.entries(values).filter(([, value]) => value.trim() !== ''),
    );
    const named = name.trim() || undefined;
    if (editing) {
      update.mutate(
        { id: editing.id, settings, ...(named && { name: named }) },
        { onSuccess: () => onSaved(named ?? editing.name) },
      );
    } else {
      add.mutate(
        { provider: info.id, settings, ...(named && { name: named }) },
        { onSuccess: (store) => onSaved(store.name) },
      );
    }
  };

  return (
    <Modal
      visible
      onDismiss={onDismiss}
      header={
        <span className={styles.card}>
          <ProviderMark
            providerId={markId(info.id)}
            icon={info.icon}
            logoUrl={null}
            name={info.name}
            size={32}
          />
          {editing ? `Edit ${editing.name}` : `Add ${info.name}`}
        </span>
      }
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss}>
              Cancel
            </Button>
            <Button variant="primary" disabled={missing} loading={save.isPending} onClick={submit}>
              {editing ? 'Check and save' : 'Check and add'}
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
            {info.description}{' '}
            {info.docsUrl && (
              <Link href={info.docsUrl} external>
                Docs
              </Link>
            )}
          </Box>
          <FormField label="Name (optional)" description="To tell this store apart from others.">
            <Input
              value={name}
              placeholder={info.name}
              onChange={({ detail }) => setName(detail.value)}
            />
          </FormField>
          {info.fields.map((field) => (
            <FormField
              key={field.key}
              label={field.required ? field.label : `${field.label} (optional)`}
            >
              <Input
                value={values[field.key] ?? ''}
                type={field.secret ? 'password' : 'text'}
                autoComplete={false}
                placeholder={
                  field.secret && editing
                    ? editing.keyHint
                      ? `Saved (…${editing.keyHint})`
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
