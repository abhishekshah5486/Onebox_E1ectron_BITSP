import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Header from '@cloudscape-design/components/header';
import Pagination from '@cloudscape-design/components/pagination';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Table from '@cloudscape-design/components/table';
import TextFilter from '@cloudscape-design/components/text-filter';
import { useState } from 'react';
import { hubApi, useCollections, useHubMutation, useUploadLimits } from '../../api/hub';
import { useRecordsPage, type KnowledgeRecord } from '../../api/knowledge';
import { formatSize } from '../../knowledge/format';
import { useFlash } from '../../settings/flash';
import tableStyles from '../../ui/DataTable.module.css';
import { ConfirmModal } from './dialogs';
import styles from './Knowledge.module.css';
import { formatWhen, problem } from './parts';

const PAGE = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

// Whole days left before an item deleted at `deletedAt` is deleted for good.
export function daysLeft(deletedAt: string | null | undefined, retentionDays: number, now: number) {
  if (!deletedAt) return retentionDays;
  const due = Date.parse(deletedAt) + retentionDays * DAY_MS;
  return Math.max(0, Math.ceil((due - now) / DAY_MS));
}

// Deleted files and emails, until they are restored or deleted for good (by hand, or after
// the retention period).
export function TrashView() {
  const flash = useFlash();
  const collections = useCollections();
  const retention = useUploadLimits().data?.trashRetentionDays ?? 14;
  const [now] = useState(() => Date.now());
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<KnowledgeRecord[]>([]);
  const [purging, setPurging] = useState<KnowledgeRecord[] | null>(null);
  const records = useRecordsPage({
    trashed: true,
    topLevel: true,
    q: q || undefined,
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
      flash({
        type: 'success',
        content: `${restored.length} restored to where they were. They are searchable again once re-indexed.`,
      });
    } catch (err) {
      flash({ type: 'error', content: problem(err, 'Nothing was restored.') });
    }
  };

  return (
    <>
      <div className={tableStyles.table}>
        <Table
          variant="container"
          stickyHeader
          header={
            <Header
              variant="h2"
              counter={records.data ? `(${total})` : undefined}
              description={`Deleted files and emails are not searched, and are deleted for good after ${retention} days.`}
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
            selectionGroupLabel: 'Deleted items',
            itemSelectionLabel: (_, r) => r.name,
            allItemsSelectionLabel: () => 'All deleted items on this page',
          }}
          empty={
            <Box textAlign="center" color="inherit" padding="l">
              <b>Nothing deleted</b>
            </Box>
          }
          columnDefinitions={[
            {
              id: 'name',
              header: 'Name',
              cell: (r) => (
                <span className={styles.clamp} title={r.name}>
                  {r.name}
                </span>
              ),
              width: 560,
              minWidth: 420,
            },
            {
              id: 'collection',
              header: 'Collection',
              cell: (r) =>
                r.sourceType === 'mail' ? 'Mail' : (names.get(r.sourceId) ?? r.sourceId),
            },
            { id: 'size', header: 'Size', cell: (r) => formatSize(r.sizeBytes) },
            {
              id: 'deletedBy',
              header: 'Deleted by',
              cell: (r) => (r.deleteSource === 'source' ? 'Mailbox' : 'You'),
            },
            { id: 'deleted', header: 'Deleted (UTC)', cell: (r) => formatWhen(r.deletedAt) },
            {
              id: 'left',
              header: 'Deleted for good in',
              cell: (r) => {
                const days = daysLeft(r.deletedAt, retention, now);
                return days === 0 ? 'Today' : `${days} ${days === 1 ? 'day' : 'days'}`;
              },
            },
          ]}
        />
      </div>
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
            Delete {purging.length === 1 ? <b>{purging[0]!.name}</b> : `${purging.length} items`}{' '}
            for good? This cannot be undone.
          </Box>
        </ConfirmModal>
      )}
    </>
  );
}
