import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Container from '@cloudscape-design/components/container';
import FormField from '@cloudscape-design/components/form-field';
import Header from '@cloudscape-design/components/header';
import Input from '@cloudscape-design/components/input';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Tiles from '@cloudscape-design/components/tiles';
import { useState } from 'react';
import { useClearIndexingStore, useIndexingStore, useSetIndexingStore } from '../api/providers';
import { describeError } from '../auth/errors';
import { LoadError } from '../ui/LoadError';
import { useFlash } from './flash';

type Choice = 'ONEBOX' | 'QDRANT';

// Where semantic search keeps the user's vectors. Moving them re-embeds all their mail into the
// new place and then removes it from OneBox's.
export function IndexingStorageSection() {
  const store = useIndexingStore();
  const save = useSetIndexingStore();
  const clear = useClearIndexingStore();
  const flash = useFlash();
  const saved = store.data?.provider ?? 'ONEBOX';
  const [choice, setChoice] = useState<Choice | null>(null);
  const [url, setUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [confirmBack, setConfirmBack] = useState(false);
  const shown = choice ?? saved;
  const qdrant = store.data?.provider === 'QDRANT' ? store.data : null;

  const connect = () =>
    save.mutate(
      { url: url.trim(), ...(apiKey.trim() && { apiKey: apiKey.trim() }) },
      {
        onSuccess: () => {
          setChoice(null);
          setUrl('');
          setApiKey('');
          flash({
            type: 'success',
            header: 'Your Qdrant is connected',
            content:
              'Your mail is being embedded into it; searches keep working meanwhile. You’ll get a notification once it’s finished.',
          });
        },
      },
    );

  const backToOneBox = () =>
    clear.mutate(undefined, {
      onSuccess: () => {
        setConfirmBack(false);
        setChoice(null);
        flash({
          type: 'success',
          content: 'Search vectors are moving back to OneBox. What’s in your Qdrant stays there.',
        });
      },
      onError: (error) => flash({ type: 'error', content: describeError(error) }),
    });

  return (
    <Container
      header={
        <Header
          variant="h2"
          description="Where semantic search keeps the vectors made from your mail."
        >
          Indexing storage
        </Header>
      }
    >
      <SpaceBetween size="l">
        {store.isError && (
          <LoadError
            error={store.error}
            header="Indexing storage could not be loaded"
            onRetry={() => void store.refetch()}
          />
        )}
        <Tiles
          ariaLabel="Indexing storage"
          columns={2}
          value={shown}
          onChange={({ detail }) => setChoice(detail.value as Choice)}
          items={[
            {
              value: 'ONEBOX',
              label: 'OneBox hosted',
              description: 'Kept on OneBox’s vector database. Nothing to set up.',
            },
            {
              value: 'QDRANT',
              label: 'Your own Qdrant',
              description: 'Qdrant Cloud or your own server. Your vectors stay with you.',
            },
          ]}
        />

        {qdrant && shown === 'QDRANT' && (
          <ColumnLayout columns={2} variant="text-grid">
            <div>
              <Box variant="awsui-key-label">Connected to</Box>
              <StatusIndicator type="success">{qdrant.url}</StatusIndicator>
            </div>
            <div>
              <Box variant="awsui-key-label">API key</Box>
              {qdrant.keyHint ?? 'None'}
            </div>
          </ColumnLayout>
        )}

        {shown === 'QDRANT' && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (url.trim()) connect();
            }}
          >
            <SpaceBetween size="m">
              <ColumnLayout columns={2}>
                <FormField label="Qdrant URL">
                  <Input
                    value={url}
                    placeholder={qdrant?.url ?? 'https://xyz.cloud.qdrant.io:6333'}
                    onChange={({ detail }) => setUrl(detail.value)}
                  />
                </FormField>
                <FormField label="API key (optional)">
                  <Input
                    value={apiKey}
                    type="password"
                    autoComplete={false}
                    placeholder={qdrant?.keyHint ? `Saved (${qdrant.keyHint})` : undefined}
                    onChange={({ detail }) => setApiKey(detail.value)}
                  />
                </FormField>
              </ColumnLayout>
              {save.isError && (
                <Alert type="error" header="Couldn't connect">
                  {describeError(save.error)}
                </Alert>
              )}
              <Box float="right">
                <SpaceBetween direction="horizontal" size="xs">
                  {qdrant && (
                    <Button onClick={() => setConfirmBack(true)}>Move back to OneBox</Button>
                  )}
                  <Button
                    variant="primary"
                    formAction="submit"
                    disabled={!url.trim()}
                    loading={save.isPending}
                  >
                    {qdrant ? 'Check and update' : 'Check and connect'}
                  </Button>
                </SpaceBetween>
              </Box>
            </SpaceBetween>
          </form>
        )}

        {shown === 'ONEBOX' && saved === 'QDRANT' && (
          <Box float="right">
            <Button variant="primary" onClick={() => setConfirmBack(true)}>
              Move back to OneBox
            </Button>
          </Box>
        )}
      </SpaceBetween>

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
          All your mail is embedded again on OneBox, and OneBox forgets your Qdrant’s address and
          key. The vectors already in your Qdrant stay there.
        </Alert>
      </Modal>
    </Container>
  );
}
