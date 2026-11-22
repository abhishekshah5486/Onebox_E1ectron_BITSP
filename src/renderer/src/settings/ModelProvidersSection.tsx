import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Cards from '@cloudscape-design/components/cards';
import Header from '@cloudscape-design/components/header';
import Modal from '@cloudscape-design/components/modal';
import Pagination from '@cloudscape-design/components/pagination';
import SegmentedControl from '@cloudscape-design/components/segmented-control';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Table from '@cloudscape-design/components/table';
import TextFilter from '@cloudscape-design/components/text-filter';
import { useState } from 'react';
import {
  useProviders,
  useRemoveUserModel,
  useUserModels,
  type ModelKind,
  type ProviderCard,
  type UserModel,
} from '../api/providers';
import { describeError } from '../auth/errors';
import { LoadError } from '../ui/LoadError';
import { ConfigureModelModal } from './ConfigureModelModal';
import { useFlash } from './flash';
import styles from './ModelProvidersSection.module.css';
import { ProviderMark } from './ProviderMark';

const PAGE_SIZE = 12;

const COPY: Record<ModelKind, { title: string; description: string; noun: string }> = {
  llm: {
    title: 'AI models',
    description:
      'Bring your own API key for any provider. Your models can then be picked for each task above.',
    noun: 'model',
  },
  embedding: {
    title: 'Embedding models',
    description: 'Use your own embedding model for semantic search, with your own key.',
    noun: 'embedding model',
  },
};

const matches = (provider: ProviderCard, text: string) =>
  `${provider.name} ${provider.id}`.toLowerCase().includes(text.trim().toLowerCase());

type View = 'providers' | 'configured';

// Providers users can bring their own keys for (from the models.dev catalogue), and the models
// they have added. The same section serves language and embedding models.
export function ModelProvidersSection({ kind }: { kind: ModelKind }) {
  const providers = useProviders();
  const userModels = useUserModels();
  const remove = useRemoveUserModel();
  const flash = useFlash();
  const [view, setView] = useState<View>('providers');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [configuring, setConfiguring] = useState<{
    providerId: string;
    editing: UserModel | null;
  } | null>(null);
  const [removing, setRemoving] = useState<UserModel | null>(null);
  const copy = COPY[kind];

  const mine = (userModels.data?.items ?? []).filter((model) => model.kind === kind);
  const offered = (providers.data?.items ?? []).filter(
    (provider) => kind === 'llm' || provider.embeddings,
  );
  const shown = offered.filter((provider) => matches(provider, filter));
  const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const visible = shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const configuredCount = (providerId: string) =>
    mine.filter((model) => model.providerId === providerId).length;

  const header = (
    <Header
      variant="h2"
      description={copy.description}
      counter={view === 'providers' ? `(${shown.length})` : `(${mine.length})`}
      actions={
        <SegmentedControl
          label={`${copy.title} view`}
          selectedId={view}
          onChange={({ detail }) => setView(detail.selectedId as View)}
          options={[
            { id: 'providers', text: 'Providers' },
            { id: 'configured', text: `Configured (${mine.length})` },
          ]}
        />
      }
    >
      {copy.title}
    </Header>
  );

  return (
    <>
      {view === 'providers' ? (
        <Cards
          variant="container"
          header={header}
          loading={providers.isPending}
          loadingText="Loading providers"
          items={visible}
          trackBy="id"
          cardsPerRow={[{ cards: 1 }, { minWidth: 500, cards: 2 }, { minWidth: 900, cards: 3 }]}
          filter={
            <TextFilter
              filteringText={filter}
              filteringPlaceholder="Search providers"
              filteringAriaLabel="Search providers"
              countText={`${shown.length} ${shown.length === 1 ? 'match' : 'matches'}`}
              onChange={({ detail }) => {
                setFilter(detail.filteringText);
                setPage(1);
              }}
            />
          }
          pagination={
            <Pagination
              currentPageIndex={page}
              pagesCount={pages}
              onChange={({ detail }) => setPage(detail.currentPageIndex)}
            />
          }
          cardDefinition={{
            header: (provider) => (
              <div className={styles.cardHeader}>
                <ProviderMark logoUrl={provider.logoUrl} name={provider.name} />
                <span className={styles.cardName}>{provider.name}</span>
              </div>
            ),
            sections: [
              {
                id: 'models',
                content: (provider) => {
                  const added = configuredCount(provider.id);
                  return (
                    <Box color="text-body-secondary" fontSize="body-s">
                      {provider.modelCount
                        ? `${provider.modelCount.toLocaleString()} models`
                        : 'Any model it serves'}
                      {added > 0 && ` · ${added} configured`}
                    </Box>
                  );
                },
              },
              {
                id: 'configure',
                content: (provider) => (
                  <Button
                    ariaLabel={`Configure ${provider.name}`}
                    onClick={() => setConfiguring({ providerId: provider.id, editing: null })}
                  >
                    Configure
                  </Button>
                ),
              },
            ],
          }}
          empty={
            providers.isError ? (
              <LoadError
                error={providers.error}
                header="Providers could not be loaded"
                onRetry={() => void providers.refetch()}
              />
            ) : (
              <Box textAlign="center" color="inherit" padding="m">
                <b>No providers match “{filter}”</b>
              </Box>
            )
          }
        />
      ) : (
        <Table
          variant="container"
          header={header}
          loading={userModels.isPending}
          loadingText={`Loading your ${copy.noun}s`}
          items={mine}
          trackBy="id"
          columnDefinitions={[
            {
              id: 'name',
              header: 'Model',
              cell: (model) => (
                <span className={styles.modelCell}>
                  <ProviderMark logoUrl={model.logoUrl} name={model.providerName} size={20} />
                  <span>
                    <Box fontWeight="bold">{model.name}</Box>
                    <Box color="text-body-secondary" fontSize="body-s">
                      {model.providerName} · {model.modelId}
                    </Box>
                  </span>
                </span>
              ),
            },
            { id: 'key', header: 'Key', cell: (model) => model.keyHint ?? 'None' },
            kind === 'embedding'
              ? {
                  id: 'dimensions',
                  header: 'Dimensions',
                  cell: (model) => model.dimensions?.toLocaleString() ?? '–',
                }
              : {
                  id: 'context',
                  header: 'Context',
                  cell: (model) =>
                    model.contextTokens ? `${model.contextTokens.toLocaleString()} tokens` : '–',
                },
            {
              id: 'actions',
              header: 'Actions',
              cell: (model) => (
                <SpaceBetween direction="horizontal" size="xs">
                  <Button
                    variant="inline-link"
                    ariaLabel={`Edit ${model.name}`}
                    onClick={() => setConfiguring({ providerId: model.providerId, editing: model })}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="inline-link"
                    ariaLabel={`Remove ${model.name}`}
                    onClick={() => setRemoving(model)}
                  >
                    Remove
                  </Button>
                </SpaceBetween>
              ),
            },
          ]}
          empty={
            <Box textAlign="center" color="inherit" padding="m">
              <SpaceBetween size="xs">
                <b>No {copy.noun}s of your own yet</b>
                <Button onClick={() => setView('providers')}>Browse providers</Button>
              </SpaceBetween>
            </Box>
          }
        />
      )}

      {configuring && (
        <ConfigureModelModal
          providerId={configuring.providerId}
          kind={kind}
          editing={configuring.editing}
          onDismiss={() => setConfiguring(null)}
          onSaved={(model) => {
            setConfiguring(null);
            setView('configured');
            flash({
              type: 'success',
              content: configuring.editing
                ? `${model.name} saved.`
                : kind === 'llm'
                  ? `${model.name} added. Pick it for any task in Models.`
                  : `${model.name} added. Pick it under Semantic search.`,
            });
          }}
        />
      )}

      <Modal
        visible={removing !== null}
        onDismiss={() => setRemoving(null)}
        header={`Remove ${copy.noun}`}
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
                    onError: (error) => flash({ type: 'error', content: describeError(error) }),
                  })
                }
              >
                Remove
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        Remove <b>{removing?.name}</b> and forget its key?{' '}
        {kind === 'llm'
          ? 'Tasks that use it go back to Auto.'
          : 'If semantic search uses it, your mail is embedded again with the default model.'}
      </Modal>
    </>
  );
}
