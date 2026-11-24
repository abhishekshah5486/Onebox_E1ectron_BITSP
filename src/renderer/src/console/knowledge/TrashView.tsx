import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Header from '@cloudscape-design/components/header';
import Pagination from '@cloudscape-design/components/pagination';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Table from '@cloudscape-design/components/table';
import TextFilter from '@cloudscape-design/components/text-filter';
import { useState } from 'react';
import { hubApi, useCollections, useHubMutation } from '../../api/hub';
import { useRecordsPage, type KnowledgeRecord } from '../../api/knowledge';
import { formatSize } from '../../knowledge/format';
import { useFlash } from '../../settings/flash';
import { ConfirmModal } from './dialogs';
import { formatWhen, problem } from './parts';

const PAGE = 50;

// Deleted uploads, until they are restored or deleted for good.
export function TrashView() {
  const flash = useFlash();
  const collections = useCollections();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<KnowledgeRecord[]>([]);
  const [purging, setPurging] = useState<KnowledgeRecord[] | null>(null);
  const records = useRecordsPage({
    trashed: true,
    q: q || undefined,
    sourceType: ['upload'],
    sort: 'updatedAt',
    order: 'desc',
    offset: (page - 1) * PAGE,
    limit: PAGE,
  });
  const restore = useHubMutation((a, ids: string[]) => hubApi.restore(a, ids));
  const purge = useHubMutation(async (a, ids: string[]) => {
    for (const id of ids) await hubApi.deleteForever(a, id);
  });
  const names = new Map((collections.data ?? []).map((c) => [c.id, c.name]));
  const total = records.data?.total ?? 0;

  const restoreSelected = async () => {
    try {
      const { restored } = await restore.mutateAsync(selected.map((r) => r.id));
      setSelected([]);
      flash({ type: 'success', content: `${restored.length} restored to where they were.` });
    } catch (err) {
      flash({ type: 'error', content: problem(err, 'Nothing was restored.') });
    }
  };

  return (
    <>
      <Table
        variant="full-page"
        stickyHeader
        header={
          <Header
            variant="awsui-h1-sticky"
            counter={records.data ? `(${total})` : undefined}
            description="Deleted files stay here until you delete them for good. They are not searched."
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  disabled={selected.length === 0}
                  loading={restore.isPending}
                  onClick={() => void restoreSelected()}
                >
                  Restore
                </Button>
                <Button disabled={selected.length === 0} onClick={() => setPurging(selected)}>
                  Delete forever
                </Button>
              </SpaceBetween>
            }
          >
            Recently deleted
          </Header>
        }
        filter={
          <TextFilter
            filteringText={q}
            filteringPlaceholder="Find by name"
            onChange={({ detail }) => {
              setQ(detail.filteringText);
              setPage(1);
            }}
          />
        }
        pagination={
          <Pagination
            currentPageIndex={page}
            pagesCount={Math.max(1, Math.ceil(total / PAGE))}
            onChange={({ detail }) => setPage(detail.currentPageIndex)}
          />
        }
        items={records.data?.records ?? []}
        loading={records.isPending}
        loadingText="Loading"
        trackBy="id"
        selectionType="multi"
        selectedItems={selected}
        onSelectionChange={({ detail }) => setSelected(detail.selectedItems)}
        ariaLabels={{
          selectionGroupLabel: 'Deleted files',
          itemSelectionLabel: (_, r) => r.name,
          allItemsSelectionLabel: () => 'All deleted files on this page',
        }}
        empty={
          <Box textAlign="center" color="inherit" padding="l">
            <b>Nothing deleted</b>
          </Box>
        }
        columnDefinitions={[
          { id: 'name', header: 'Name', cell: (r) => r.name, isRowHeader: true },
          {
            id: 'collection',
            header: 'Collection',
            cell: (r) => names.get(r.sourceId) ?? r.sourceId,
          },
          { id: 'size', header: 'Size', cell: (r) => formatSize(r.sizeBytes) },
          { id: 'deleted', header: 'Deleted', cell: (r) => formatWhen(r.deletedAt) },
        ]}
      />
      {purging && (
        <ConfirmModal
          title="Delete forever"
          confirm="Delete forever"
          onConfirm={async () => {
            await purge.mutateAsync(purging.map((r) => r.id));
            setSelected([]);
          }}
          onClose={() => setPurging(null)}
        >
          <Box variant="p">
            Delete {purging.length === 1 ? <b>{purging[0]!.name}</b> : `${purging.length} files`}{' '}
            for good? This cannot be undone.
          </Box>
        </ConfirmModal>
      )}
    </>
  );
}
