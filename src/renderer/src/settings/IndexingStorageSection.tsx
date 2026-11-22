import { useCollection } from '@cloudscape-design/collection-hooks';
import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Cards from '@cloudscape-design/components/cards';
import FormField from '@cloudscape-design/components/form-field';
import Header from '@cloudscape-design/components/header';
import Flashbar from '@cloudscape-design/components/flashbar';
import Icon from '@cloudscape-design/components/icon';
import Input from '@cloudscape-design/components/input';
import Link from '@cloudscape-design/components/link';
import Modal from '@cloudscape-design/components/modal';
import Pagination from '@cloudscape-design/components/pagination';
import ProgressBar from '@cloudscape-design/components/progress-bar';
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
import tableStyles from '../ui/DataTable.module.css';
import { LoadError } from '../ui/LoadError';
import { useFlash } from './flash';
import own from './IndexingStorageSection.module.css';
import styles from './ModelProvidersSection.module.css';
import { PAGE_LABELS } from './page-labels';
import { ProviderMark } from './ProviderMark';

const PAGE_SIZE = 6;
const markId = (provider: string) => provider.toLowerCase();
const STACK_AFTER = 3;

type StoreStatus = NonNullable<SemanticStatus['stores']>[number];

// Like a phone's photo backups: every store that isn't paused gets each new email; a paused one
// catches up on only what it missed once resumed.
function StatusCell({ store, status }: { store: IndexingStore; status?: StoreStatus | undefined }) {
  if (store.paused) return <StatusIndicator type="stopped">Paused</StatusIndicator>;
  if (status?.catchup?.total) {
    return (
      <StatusIndicator type="in-progress">Backing up · {percent(status.catchup)}%</StatusIndicator>
    );
  }
  if (status && !status.upToDate) {
    return <StatusIndicator type="in-progress">Backup in progress</StatusIndicator>;
  }
  return <StatusIndicator type="success">Backed up</StatusIndicator>;
}

const percent = ({ done, total }: { done: number; total: number }) =>
  total ? Math.min(100, Math.floor((done / total) * 100)) : 0;

// Stores still filling, as the console's blue progress banners: how far each has got, once its
// job reports a total.
function BackupBanners({ filling }: { filling: { store: IndexingStore; status: StoreStatus }[] }) {
  if (!filling.length) return null;
  return (
    <Flashbar
      // More than a few at once fold into one stack that expands, as the AWS console does.
      stackItems={filling.length > STACK_AFTER}
      i18nStrings={{
        ariaLabel: 'Backups',
        notificationBarText: 'Backups',
        notificationBarAriaLabel: 'Show all backups',
        inProgressIconAriaLabel: 'In progress',
        infoIconAriaLabel: 'Info',
      }}
      items={filling.map(({ store, status }) => {
        // Queued but not yet counted: no total to show.
        const progress = status.catchup?.total ? status.catchup : null;
        return {
          id: store.id,
          type: 'info',
          loading: true,
          header: `Backing up your mail to ${store.name}`,
          content: (
            <ProgressBar
              variant="flash"
              value={progress ? percent(progress) : 0}
              additionalInfo={
                progress
                  ? `${progress.done.toLocaleString()} of ${progress.total.toLocaleString()} emails. New mail is backed up there too.`
                  : 'Starting…'
              }
            />
          ),
        };
      })}
    />
  );
}

type Confirming = { action: 'search' | 'pause' | 'resume'; stores: IndexingStore[] };

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
  const [removing, setRemoving] = useState<IndexingStore[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const mine = current.data?.stores ?? [];
  const selected = mine.filter((store) => selectedIds.includes(store.id));
  const searchStore = mine.find((store) => store.search);
  // The search store keeps backing up, and OneBox's own can't be removed or edited.
  const pausable = selected.filter((store) => !store.search);
  const allPaused = pausable.length > 0 && pausable.every((store) => store.paused);
  const removable = selected.filter((store) => store.id !== ONEBOX_STORE);
  const editable = selected.length === 1 && removable.length === 1 ? removable[0] : undefined;
  const editInfo = editable && infoOf(editable.provider);
  function infoOf(provider: string) {
    return catalogue.data?.find((info) => info.id === provider);
  }
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

  const [confirming, setConfirming] = useState<Confirming | null>(null);
  const [working, setWorking] = useState(false);
  const names = (stores: IndexingStore[]) => stores.map((store) => store.name).join(', ');

  // Runs the confirmed change, keeping the dialog's loader up until the page shows it.
  const confirm = async ({ action, stores }: Confirming) => {
    setWorking(true);
    try {
      if (action === 'search') {
        await searchWith.mutateAsync(stores[0]!.id);
      } else {
        const paused = action === 'pause';
        await Promise.all(stores.map((store) => update.mutateAsync({ id: store.id, paused })));
      }
      await Promise.all([current.refetch(), semantic.refetch()]);
      flash({
        type: 'success',
        content:
          action === 'search'
            ? `Searches now go to ${stores[0]!.name}.`
            : action === 'pause'
              ? `${names(stores)} paused. New mail isn’t backed up there until you resume.`
              : `${names(stores)} backing up again, starting with only the mail missed.`,
      });
    } catch (error) {
      failed(error);
    } finally {
      setWorking(false);
      setConfirming(null);
    }
  };

  return (
    <SpaceBetween size="l">
      <div className={tableStyles.table}>
        <Table
          variant="container"
          selectionType="multi"
          selectedItems={selected}
          onSelectionChange={({ detail }) =>
            setSelectedIds(detail.selectedItems.map((store) => store.id))
          }
          ariaLabels={{
            selectionGroupLabel: 'Vector stores',
            itemSelectionLabel: (_, store) => store.name,
            allItemsSelectionLabel: () => 'Select all vector stores',
          }}
          header={
            <SpaceBetween size="m">
              <Header
                variant="h2"
                counter={mine.length ? `(${mine.length})` : undefined}
                description="Your mail’s search vectors are backed up to every store that isn’t paused."
                actions={
                  <SpaceBetween direction="horizontal" size="xs">
                    <Button
                      iconName="refresh"
                      ariaLabel="Reload vector stores"
                      onClick={() => void Promise.all([current.refetch(), semantic.refetch()])}
                    />
                    <Button
                      disabled={selected.length !== 1 || selected[0]!.search}
                      onClick={() => setConfirming({ action: 'search', stores: selected })}
                    >
                      Use for search
                    </Button>
                    <Button
                      disabled={pausable.length === 0}
                      onClick={() =>
                        setConfirming({
                          action: allPaused ? 'resume' : 'pause',
                          stores: pausable.filter((store) => store.paused === allPaused),
                        })
                      }
                    >
                      {allPaused ? 'Resume' : 'Pause'}
                    </Button>
                    <Button
                      disabled={!editInfo}
                      onClick={() =>
                        editable &&
                        editInfo &&
                        setConfiguring({ info: editInfo, editing: editable })
                      }
                    >
                      Edit
                    </Button>
                    <Button
                      disabled={removable.length === 0}
                      onClick={() => setRemoving(removable)}
                    >
                      Remove
                    </Button>
                  </SpaceBetween>
                }
              >
                Indexing storage
              </Header>
              {searchStore && (
                <div className={own.banner} role="status" aria-label="Search store">
                  <Icon name="status-info" />
                  <span>
                    Searches across your mail use <b>{searchStore.name}</b>.
                  </span>
                </div>
              )}
              <BackupBanners
                filling={mine.flatMap((store) => {
                  const status = statusOf(store.id);
                  return status && !store.paused && !status.upToDate ? [{ store, status }] : [];
                })}
              />
            </SpaceBetween>
          }
          loading={current.isPending}
          loadingText="Loading your vector stores"
          items={mine}
          trackBy="id"
          columnDefinitions={[
            {
              id: 'name',
              header: 'Name',
              cell: (store) => (
                <span className={tableStyles.withLogo}>
                  <ProviderMark
                    providerId={markId(store.provider)}
                    icon={infoOf(store.provider)?.icon}
                    logoUrl={null}
                    name={store.name}
                    size={20}
                    bare
                  />
                  <Box fontWeight="bold">{store.name}</Box>
                </span>
              ),
            },
            {
              id: 'type',
              header: 'Database',
              cell: (store) =>
                store.provider === 'ONEBOX'
                  ? 'Hosted by OneBox'
                  : (infoOf(store.provider)?.name ?? store.provider),
            },
            {
              id: 'status',
              header: 'Backup',
              cell: (store) => <StatusCell store={store} status={statusOf(store.id)} />,
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
      </div>

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

      {confirming && (
        <ConfirmModal
          confirming={confirming}
          status={confirming.stores[0] && statusOf(confirming.stores[0].id)}
          working={working}
          onCancel={() => setConfirming(null)}
          onConfirm={() => void confirm(confirming)}
        />
      )}

      <Modal
        visible={removing.length > 0}
        onDismiss={() => setRemoving([])}
        header={
          removing.length === 1
            ? `Remove ${removing[0]!.name}?`
            : `Remove ${removing.length} stores?`
        }
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setRemoving([])}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={remove.isPending}
                onClick={() =>
                  void Promise.all(removing.map((store) => remove.mutateAsync(store.id))).then(
                    () => {
                      flash({
                        type: 'success',
                        content: `${removing.map((store) => store.name).join(', ')} removed.`,
                      });
                      setRemoving([]);
                      setSelectedIds([]);
                    },
                    failed,
                  )
                }
              >
                Remove
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <Alert type="warning">
          OneBox forgets the address and keys of {removing.map((store) => store.name).join(', ')}{' '}
          and stops backing up there. The vectors already stored stay.
          {removing.some((store) => store.search) && ' Searches go back to OneBox’s own store.'}
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

const CONFIRM = {
  search: { title: 'Use {names} for search?', button: 'Use for search' },
  pause: { title: 'Pause {names}?', button: 'Pause' },
  resume: { title: 'Resume {names}?', button: 'Resume' },
};

// What the change means, asked before making it.
function ConfirmModal({
  confirming: { action, stores },
  status,
  working,
  onCancel,
  onConfirm,
}: {
  confirming: Confirming;
  status: StoreStatus | undefined;
  working: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const names = stores.map((store) => store.name).join(', ');
  const store = stores[0]!;
  const text = CONFIRM[action];
  return (
    <Modal
      visible
      onDismiss={() => !working && onCancel()}
      header={text.title.replace('{names}', names)}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" disabled={working} onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="primary" loading={working} onClick={onConfirm}>
              {text.button}
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      {action === 'search' && (
        <SpaceBetween size="s">
          <Box>Every search across your mail will run against {store.name}.</Box>
          {store.paused && <Box>Its backup is paused, so it’s resumed first.</Box>}
          {(store.paused || (status && !status.upToDate)) && (
            <Alert type="warning">
              {store.name} doesn’t have all your mail yet, so searches may miss some until its
              backup finishes.
            </Alert>
          )}
        </SpaceBetween>
      )}
      {action === 'pause' && (
        <Box>
          New mail won’t be backed up to {names} while paused. What’s there stays, and resuming
          backs up only the mail missed.
        </Box>
      )}
      {action === 'resume' && (
        <Box>{names} will back up the mail missed while paused, then keep up with new mail.</Box>
      )}
    </Modal>
  );
}
