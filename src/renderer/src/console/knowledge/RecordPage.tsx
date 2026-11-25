import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import ContentLayout from '@cloudscape-design/components/content-layout';
import ExpandableSection from '@cloudscape-design/components/expandable-section';
import Grid from '@cloudscape-design/components/grid';
import Header from '@cloudscape-design/components/header';
import Link from '@cloudscape-design/components/link';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Table from '@cloudscape-design/components/table';
import { useState } from 'react';
import { useAttachments, useRecordDetails, type HubNode, type RecordDetails } from '../../api/hub';
import tableStyles from '../../ui/DataTable.module.css';
import styles from './Knowledge.module.css';
import { NodeIcon, NodeStatus, formatMs, nodeSize } from './parts';
import { Preview, RecordFacts, RecordIndexing, RecordSummary } from './RecordPanel';
import { FlowLoader } from './Sparkle';

// An email's files, in the same table as the records page.
function AttachmentsTable({ id, onOpen }: { id: string; onOpen: (id: string) => void }) {
  const files = useAttachments([id]).get(id);
  const items = files?.items ?? [];
  return (
    <div className={tableStyles.table}>
      <Table
        variant="container"
        loading={files?.loading}
        loadingText="Loading attachments"
        header={
          <Header variant="h2" counter={files?.loading ? undefined : `(${items.length})`}>
            Attachments
          </Header>
        }
        items={items}
        trackBy="id"
        empty={<Box color="text-body-secondary">This email has no attachments.</Box>}
        columnDefinitions={[
          {
            id: 'name',
            header: 'Name',
            width: 420,
            minWidth: 280,
            cell: (n: HubNode) => (
              <span className={styles.twoLines} title={n.name}>
                <span className={styles.nameIcon}>
                  <NodeIcon node={n} />
                </span>
                <Link
                  href={`#${n.id}`}
                  onFollow={(e) => {
                    e.preventDefault();
                    onOpen(n.id);
                  }}
                >
                  {n.name}
                </Link>
              </span>
            ),
          },
          { id: 'status', header: 'Status', cell: (n) => <NodeStatus node={n} /> },
          { id: 'type', header: 'Type', cell: (n) => n.extension?.toUpperCase() ?? 'File' },
          { id: 'size', header: 'Size', cell: nodeSize },
          { id: 'createdAt', header: 'Created (UTC)', cell: (n) => formatMs(n.createdAt) },
          { id: 'updatedAt', header: 'Last updated (UTC)', cell: (n) => formatMs(n.updatedAt) },
        ]}
      />
    </div>
  );
}

// A record on a page of its own: what it is, how indexing went, its files, summary and text.
export function RecordPage({
  id,
  backLabel,
  onBack,
  onOpen,
  onDownload,
}: {
  id: string;
  backLabel: string;
  onBack: () => void;
  onOpen: (id: string) => void;
  onDownload: (record: RecordDetails) => void;
}) {
  const details = useRecordDetails(id);
  const record = details.data;
  const [preview, setPreview] = useState(false);

  if (details.isPending) return <FlowLoader label="Loading record" />;
  if (!record)
    return (
      <SpaceBetween size="m">
        <Box>This record is no longer here.</Box>
        <Button iconName="arrow-left" onClick={onBack}>
          {backLabel}
        </Button>
      </SpaceBetween>
    );

  const mail = record.recordType === 'MAIL';
  return (
    <ContentLayout
      header={
        <Header
          variant="h1"
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button iconName="arrow-left" onClick={onBack}>
                {backLabel}
              </Button>
              <Button
                variant="primary"
                iconName={mail ? 'envelope' : 'download'}
                onClick={() => onDownload(record)}
              >
                {mail ? 'Open email' : 'Download'}
              </Button>
            </SpaceBetween>
          }
        >
          <span className={styles.twoLines} title={record.name}>
            {record.name}
          </span>
        </Header>
      }
    >
      <SpaceBetween size="l">
        <Grid
          gridDefinition={[{ colspan: { default: 12, m: 8 } }, { colspan: { default: 12, m: 4 } }]}
        >
          <Container header={<Header variant="h2">Details</Header>} fitHeight>
            <RecordFacts record={record} onOpen={onOpen} columns={2} withStatus={false} />
          </Container>
          <Container header={<Header variant="h2">Indexing</Header>} fitHeight>
            <RecordIndexing record={record} withStatus columns={1} />
          </Container>
        </Grid>
        {mail && <AttachmentsTable id={record.id} onOpen={onOpen} />}
        {record.classification && (
          <Container header={<Header variant="h2">Summary</Header>}>
            <RecordSummary record={record} />
          </Container>
        )}
        {/* Its text is read only once asked for. */}
        <ExpandableSection
          variant="container"
          headerText="Preview"
          expanded={preview}
          onChange={({ detail }) => setPreview(detail.expanded)}
        >
          {preview && <Preview id={record.id} />}
        </ExpandableSection>
      </SpaceBetween>
    </ContentLayout>
  );
}
