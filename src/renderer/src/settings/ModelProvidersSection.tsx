import { useCollection } from '@cloudscape-design/collection-hooks';
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
import { PAGE_LABELS } from './page-labels';
import { ProviderMark } from './ProviderMark';

const COPY: Record<ModelKind, { title: string; description: string; noun: string }> = {
  llm: {
    title: 'AI models',
    description:
      'Add models from OpenAI, Claude, Gemini and more with your own API key, then pick them for any task in Settings > AI.',
    noun: 'model',
  },
  embedding: {
    title: 'Embedding models',
    description: 'Use your own embedding model for semantic search. Pick it in Settings > AI.',
    noun: 'embedding model',
  },
};

const matches = (provider: ProviderCard, text: string) =>
  `${provider.name} ${provider.id}`.toLowerCase().includes(text.trim().toLowerCase());

type View = 'providers' | 'configured';
const PAGE_SIZE = 8;

// Providers users can bring their own keys for (from the models.dev catalogue), and the models
// they have added. The same section serves language and embedding models.
export function ModelProvidersSection({ kind }: { kind: ModelKind }) {
  const providers = useProviders();
  const userModels = useUserModels();
  const remove = useRemoveUserModel();
  const flash = useFlash();
  const [view, setView] = useState<View>('providers');
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
  // Filtering goes back to the first page.
  const {
    items: shown,
    actions,
    filterProps,
    paginationProps,
  } = useCollection(offered, {
    filtering: { filteringFunction: matches },
    pagination: { pageSize: PAGE_SIZE },
  });
  const filter = filterProps.filteringText;
  const configuredCount = (providerId: string) =>
    mine.filter((model) => model.providerId === providerId).length;

  const toolbar = (
    <div className={styles.toolbar}>
      <SegmentedControl
        label={`${copy.title} view`}
        selectedId={view}
        onChange={({ detail }) => setView(detail.selectedId as View)}
        options={[
          { id: 'providers', text: 'Model providers' },
          { id: 'configured', text: `Configured models (${mine.length})` },
        ]}
      />
      <div className={styles.search}>
        <Button
          iconName="refresh"
          ariaLabel={`Reload ${copy.title.toLowerCase()}`}
          onClick={() => void Promise.all([providers.refetch(), userModels.refetch()])}
        />
        <TextFilter
          filteringText={filter}
          filteringPlaceholder="Search…"
          filteringAriaLabel="Search providers"
          onChange={({ detail }) => actions.setFiltering(detail.filteringText)}
        />
      </div>
    </div>
  );
  const header = (
    <Header variant="h2" description={copy.description}>
      {copy.title}
    </Header>
  );
  const shownModels = mine.filter((model) =>
    `${model.name} ${model.modelId} ${model.providerName}`
      .toLowerCase()
      .includes(filter.trim().toLowerCase()),
  );

  return (
    <>
      {view === 'providers' ? (
        <Cards
          variant="container"
          header={header}
          filter={toolbar}
          pagination={<Pagination {...paginationProps} ariaLabels={PAGE_LABELS} />}
          loading={providers.isPending}
          loadingText="Loading providers"
          items={shown}
          trackBy="id"
          cardsPerRow={[{ cards: 1 }, { minWidth: 640, cards: 2 }]}
          cardDefinition={{
            header: (provider) => (
              <div className={styles.card}>
                <ProviderMark
                  providerId={provider.id}
                  logoUrl={provider.logoUrl}
                  name={provider.name}
                />
                <div className={styles.cardText}>
                  <span className={styles.cardName}>{provider.name}</span>
                  <Box color="text-body-secondary" fontSize="body-s">
                    {configuredCount(provider.id)
                      ? `${configuredCount(provider.id)} configured`
                      : 'Model provider'}
                  </Box>
                </div>
                <Button
                  iconName="add-plus"
                  ariaLabel={`Configure ${provider.name}`}
                  onClick={() => setConfiguring({ providerId: provider.id, editing: null })}
                >
                  Configure
                </Button>
              </div>
            ),
            sections: [],
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
          filter={toolbar}
          loading={userModels.isPending}
          loadingText={`Loading your ${copy.noun}s`}
          items={shownModels}
          trackBy="id"
          columnDefinitions={[
            {
              id: 'name',
              header: 'Model',
              cell: (model) => (
                <span className={styles.modelCell}>
                  <ProviderMark
                    providerId={model.providerId}
                    logoUrl={model.logoUrl}
                    name={model.providerName}
                    size={28}
                  />
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
                  ? `${model.name} added. Pick it for any task in Settings > AI.`
                  : `${model.name} added. Pick it under Semantic search in Settings > AI.`,
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
