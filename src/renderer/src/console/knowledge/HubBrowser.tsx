import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ButtonDropdown, {
  type ButtonDropdownProps,
} from '@cloudscape-design/components/button-dropdown';
import Cards from '@cloudscape-design/components/cards';
import Header from '@cloudscape-design/components/header';
import Icon from '@cloudscape-design/components/icon';
import Link from '@cloudscape-design/components/link';
import Multiselect, { type MultiselectProps } from '@cloudscape-design/components/multiselect';
import Pagination from '@cloudscape-design/components/pagination';
import SegmentedControl from '@cloudscape-design/components/segmented-control';
import Select, { type SelectProps } from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Table, { type TableProps } from '@cloudscape-design/components/table';
import TextFilter from '@cloudscape-design/components/text-filter';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import {
  hubApi,
  isAttachment,
  useAttachments,
  useHubMutation,
  useHubNodes,
  useUploadLimits,
  type HubNode,
  type HubQuery,
  type HubSort,
  type NodeType,
} from '../../api/hub';
import { knowledgeApi } from '../../api/knowledge';
import { useAuth } from '../../auth/AuthProvider';
import { saveBlob } from '../../mail/attachments/useAttachment';
import { useFlash } from '../../settings/flash';
import { ConfirmModal, MoveModal, NameModal } from './dialogs';
import tableStyles from '../../ui/DataTable.module.css';
import styles from './Knowledge.module.css';
import {
  NodeIcon,
  NodeStatus,
  Paperclip,
  SIZE_RANGES,
  STATUS,
  STATUS_ORDER,
  formatMs,
  nodeSize,
  problem,
} from './parts';

const PAGE = 50;
const DAY = 86_400_000;
const WHEN: SelectProps.Option[] = [
  { value: '', label: 'Updated any time' },
  { value: '1', label: 'Last 24 hours' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '365', label: 'Last year' },
];
const ANY_SIZE: SelectProps.Option = { value: '', label: 'Any size' };
const TYPES = [
  { value: 'FILE', label: 'File', iconName: 'file' },
  { value: 'MAIL', label: 'Mail', iconName: 'envelope' },
] as const satisfies MultiselectProps.Option[];

const cursorAt = (offset: number) =>
  offset === 0
    ? null
    : btoa(`o:${offset}`).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// Where a node opens: containers are browsed, records shown in the side panel.
export function nodeHref(node: HubNode) {
  if (node.nodeType === 'collection') return `/knowledge/collections/${node.id}`;
  if (node.nodeType === 'mailbox') return `/knowledge/mail/${node.id}`;
  if (node.nodeType === 'folder')
    return `/knowledge/collections/${node.collectionId}?folder=${node.id}`;
  return null;
}

type Dialog =
  | { kind: 'rename'; node: HubNode }
  | { kind: 'delete'; node: HubNode }
  | { kind: 'move'; node: HubNode }
  | { kind: 'purge'; nodes: HubNode[] }
  // Asked before an action that removes things or starts heavy work.
  | { kind: 'confirm'; title: string; label: string; body: ReactNode; run: () => Promise<unknown> }
  | { kind: 'folder' }
  | { kind: 'collection' };

export function HubBrowser({
  parent,
  flattened,
  header,
  description,
  actions,
  selectedRecord,
  onSelectRecord,
  onCurrent,
}: {
  parent: { type: NodeType; id: string } | null;
  flattened?: boolean;
  header: ReactNode;
  description?: ReactNode;
  // Extra buttons beside the header's own (e.g. Upload).
  actions?: ReactNode;
  selectedRecord: string | null;
  onSelectRecord: (id: string | null) => void;
  onCurrent?: (listing: ReturnType<typeof useHubNodes>['data']) => void;
}) {
  const navigate = useNavigate();
  const { api } = useAuth();
  const flash = useFlash();
  const [q, setQ] = useState('');
  const [types, setTypes] = useState<readonly SelectProps.Option[]>([]);
  const [statuses, setStatuses] = useState<readonly SelectProps.Option[]>([]);
  const [size, setSize] = useState<SelectProps.Option>(ANY_SIZE);
  const [updated, setUpdated] = useState<{ option: SelectProps.Option; from: number | null }>({
    option: WHEN[0]!,
    from: null,
  });
  const [sort, setSort] = useState<{ by: HubSort; desc: boolean }>({ by: 'updatedAt', desc: true });
  const [page, setPage] = useState(1);
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [selected, setSelected] = useState<HubNode[]>([]);
  const [expanded, setExpanded] = useState<HubNode[]>([]);
  const retention = useUploadLimits().data?.trashRetentionDays ?? 14;
  const attachments = useAttachments(expanded.map((n) => n.id));
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const replacing = useRef<HubNode | null>(null);

  const bounds = SIZE_RANGES.find((r) => r.value === size.value)?.bounds;
  const query: HubQuery = {
    parent,
    q,
    recordTypes: types.map((t) => t.value!),
    indexingStatus: statuses.map((s) => s.value!),
    size: bounds ? [bounds[0], bounds[1]] : undefined,
    updatedAt: updated.from !== null ? [updated.from, null] : undefined,
    sortBy: sort.by,
    sortOrder: sort.desc ? 'desc' : 'asc',
    limit: PAGE,
    cursor: cursorAt((page - 1) * PAGE),
    flattened,
  };
  const listing = useHubNodes(query);
  const items = listing.data?.items ?? [];
  const total = listing.data?.pagination.totalItems ?? 0;
  const filtering = Boolean(q || types.length || statuses.length || bounds || updated.from);

  useEffect(() => onCurrent?.(listing.data), [listing.data, onCurrent]);
  // A new filter or order starts at the first page with nothing selected.
  const refilter =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setPage(1);
      setSelected([]);
    };

  const trash = useHubMutation((a, ids: string[]) => hubApi.trash(a, ids));
  const restore = useHubMutation((a, ids: string[]) => hubApi.restore(a, ids));
  const reindex = useHubMutation((a, ids: string[]) => hubApi.reindex(a, ids));
  const purge = useHubMutation(async (a, ids: string[]) => {
    for (const id of ids) await hubApi.deleteForever(a, id);
  });
  const rename = useHubMutation((a, input: { node: HubNode; name: string }): Promise<unknown> => {
    const { node, name } = input;
    if (node.nodeType === 'collection') return hubApi.renameCollection(a, node.id, name);
    if (node.nodeType === 'folder')
      return hubApi.renameFolder(a, node.collectionId!, node.id, name);
    return hubApi.renameRecord(a, node.id, name);
  });
  const remove = useHubMutation((a, node: HubNode): Promise<unknown> => {
    if (node.nodeType === 'collection') return hubApi.deleteCollection(a, node.id);
    return hubApi.deleteFolder(a, node.collectionId!, node.id);
  });
  const move = useHubMutation((a, input: { node: HubNode; folderId: string | null }) =>
    hubApi.moveRecord(a, input.node.id, input.node.collectionId!, input.folderId),
  );
  const replace = useHubMutation((a, input: { node: HubNode; file: File }) =>
    hubApi.replace(a, input.node.id, input.file),
  );

  const trashRecords = async (nodes: HubNode[]) => {
    const ids = nodes.map((n) => n.id);
    try {
      await trash.mutateAsync(ids);
      if (selectedRecord && ids.includes(selectedRecord)) onSelectRecord(null);
      setSelected([]);
      const moved =
        nodes.length === 1
          ? `"${nodes[0]!.name}" moved to Recently deleted.`
          : `${nodes.length} records moved to Recently deleted.`;
      const mail = nodes.some((n) => n.recordType === 'MAIL');
      flash({
        type: 'success',
        content: mail ? `${moved} Your mailbox isn't changed.` : moved,
        action: { label: 'Undo', onClick: () => void restore.mutateAsync(ids) },
      });
    } catch (err) {
      flash({ type: 'error', content: problem(err, 'Nothing was deleted.') });
    }
  };

  const reindexRecords = async (nodes: HubNode[]) => {
    try {
      const { queued, skipped } = await reindex.mutateAsync(nodes.map((n) => n.id));
      flash({
        type: queued.length ? 'success' : 'warning',
        content: `${queued.length} queued to be read again${skipped.length ? `, ${skipped.length} skipped (${skipped[0]!.reason})` : ''}.`,
      });
    } catch (err) {
      flash({ type: 'error', content: problem(err, 'Nothing was queued.') });
    }
  };

  const purgeRecords = async (nodes: HubNode[]) => {
    const ids = nodes.map((n) => n.id);
    await purge.mutateAsync(ids);
    if (selectedRecord && ids.includes(selectedRecord)) onSelectRecord(null);
    setSelected([]);
    flash({
      type: 'success',
      content: `${nodes.length === 1 ? `"${nodes[0]!.name}"` : `${nodes.length} records`} deleted permanently.`,
    });
  };

  // Each file as itself, and an email as its .eml.
  const downloadAll = async (nodes: HubNode[]) => {
    let failed = 0;
    for (const node of nodes) {
      try {
        const name = node.recordType === 'MAIL' ? `${node.name}.eml` : node.name;
        saveBlob(await knowledgeApi.file(api, node.id), name);
      } catch {
        failed += 1;
      }
    }
    if (failed) flash({ type: 'error', content: `${failed} couldn't be downloaded.` });
  };

  const what = (nodes: HubNode[]) =>
    nodes.length === 1 ? <b>{nodes[0]!.name}</b> : `${nodes.length} records`;

  const confirmTrash = (nodes: HubNode[]) =>
    setDialog({
      kind: 'confirm',
      title: nodes.length === 1 ? 'Delete record' : `Delete ${nodes.length} records`,
      label: 'Delete',
      body: (
        <>
          Move {what(nodes)} and their attachments to Recently deleted? They leave search now and
          are deleted for good after {retention} days unless restored.
          {nodes.some((n) => n.recordType === 'MAIL') && ' Your mailbox is not changed.'}
        </>
      ),
      run: () => trashRecords(nodes),
    });

  const confirmReindex = (nodes: HubNode[]) =>
    setDialog({
      kind: 'confirm',
      title: 'Read again',
      label: 'Read again',
      body: (
        <>
          Read {what(nodes)} again from the start? Each is parsed, indexed and summarized again,
          which takes a while for large files.
        </>
      ),
      run: () => reindexRecords(nodes),
    });

  const confirmDownload = (nodes: HubNode[]) =>
    nodes.length === 1
      ? void downloadAll(nodes)
      : setDialog({
          kind: 'confirm',
          title: `Download ${nodes.length} records`,
          label: 'Download',
          body: <>Save {nodes.length} files (emails as .eml) one after another?</>,
          run: () => downloadAll(nodes),
        });

  const download = async (node: HubNode) => {
    if (node.recordType === 'MAIL' && node.threadId) {
      void navigate(`/inbox/${node.threadId}`);
      return;
    }
    try {
      saveBlob(await knowledgeApi.file(api, node.id), node.name);
    } catch {
      flash({ type: 'error', content: `${node.name} couldn't be downloaded.` });
    }
  };

  const open = (node: HubNode) => {
    const href = nodeHref(node);
    if (href) void navigate(href);
    else onSelectRecord(node.id);
  };

  const rowActions = (node: HubNode): ButtonDropdownProps.ItemOrGroup[] => {
    const upload = node.nodeType === 'record' && node.sourceType === 'upload';
    if (node.nodeType === 'mailbox') return [{ id: 'open', text: 'Open' }];
    if (node.nodeType !== 'record')
      return [
        { id: 'open', text: 'Open' },
        { id: 'rename', text: 'Rename' },
        { id: 'delete', text: 'Delete' },
      ];
    return [
      { id: 'open', text: 'Details' },
      {
        id: 'download',
        text: node.recordType === 'MAIL' ? 'Open email' : 'Download',
        iconName: node.recordType === 'MAIL' ? 'envelope' : 'download',
      },
      ...(upload
        ? [
            { id: 'rename', text: 'Rename' },
            { id: 'replace', text: 'Replace file' },
            { id: 'move', text: 'Move' },
          ]
        : []),
      { id: 'reindex', text: 'Read again' },
      // An attachment goes with its email.
      ...(isAttachment(node) ? [] : [{ id: 'delete', text: 'Delete' }]),
    ];
  };

  const onRowAction = (node: HubNode, id: string) => {
    if (id === 'open') open(node);
    else if (id === 'download') void download(node);
    else if (id === 'reindex') confirmReindex([node]);
    else if (id === 'replace') {
      replacing.current = node;
      replaceInput.current?.click();
    } else if (id === 'delete' && node.nodeType === 'record') confirmTrash([node]);
    else if (id === 'rename' || id === 'delete' || id === 'move') setDialog({ kind: id, node });
  };

  const nameCell = (node: HubNode) => (
    // Only the name wraps (the table doesn't), onto lines that start under its icon.
    <span className={styles.wrap}>
      <span className={styles.nameIcon}>
        <NodeIcon node={node} />
      </span>
      <Link
        href={nodeHref(node) ?? `#${node.id}`}
        onFollow={(e) => {
          e.preventDefault();
          open(node);
        }}
      >
        {node.name}
      </Link>
      {!!node.attachmentCount && (
        <span
          className={styles.clip}
          title={`${node.attachmentCount} ${node.attachmentCount === 1 ? 'attachment' : 'attachments'}`}
        >
          <Icon svg={<Paperclip />} size="small" variant="subtle" />
          {node.attachmentCount}
        </span>
      )}
    </span>
  );

  const columns: TableProps.ColumnDefinition<HubNode>[] = [
    { id: 'name', header: 'Name', cell: nameCell, sortingField: 'name' },
    { id: 'status', header: 'Status', cell: (n) => <NodeStatus node={n} /> },
    {
      id: 'type',
      header: 'Type',
      cell: (n) =>
        n.nodeType === 'record'
          ? n.recordType === 'MAIL'
            ? 'Mail'
            : (n.extension?.toUpperCase() ?? 'File')
          : n.nodeType[0]!.toUpperCase() + n.nodeType.slice(1),
    },
    { id: 'size', header: 'Size', cell: nodeSize, sortingField: 'size' },
    {
      id: 'createdAt',
      header: 'Created (UTC)',
      cell: (n) => formatMs(n.createdAt),
      sortingField: 'createdAt',
    },
    {
      id: 'updatedAt',
      header: 'Last updated (UTC)',
      cell: (n) => formatMs(n.updatedAt),
      sortingField: 'updatedAt',
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (n) => (
        <ButtonDropdown
          variant="inline-icon"
          ariaLabel={`Actions for ${n.name}`}
          items={rowActions(n)}
          onItemClick={({ detail }) => onRowAction(n, detail.id)}
          expandToViewport
        />
      ),
    },
  ];

  const records = selected.filter((n) => n.nodeType === 'record' && !isAttachment(n));
  const count = records.length ? ` (${records.length})` : '';
  const inCollection = parent?.type === 'collection' || parent?.type === 'folder';
  const headerActions = (
    <SpaceBetween direction="horizontal" size="xs">
      <Button
        iconName="refresh"
        ariaLabel="Refresh"
        loading={listing.isFetching && !listing.isPending}
        onClick={() => void listing.refetch()}
      />
      <ButtonDropdown
        disabled={records.length === 0}
        items={[
          { id: 'download', text: `Download${count}`, iconName: 'download' },
          { id: 'reindex', text: `Read again${count}`, iconName: 'refresh' },
          { id: 'purge', text: `Delete permanently${count}`, iconName: 'remove' },
        ]}
        onItemClick={({ detail }) => {
          if (detail.id === 'download') confirmDownload(records);
          else if (detail.id === 'reindex') confirmReindex(records);
          else setDialog({ kind: 'purge', nodes: records });
        }}
      >
        Actions
      </ButtonDropdown>
      <Button
        disabled={records.length === 0}
        loading={trash.isPending}
        onClick={() => confirmTrash(records)}
      >
        {`Delete${count}`}
      </Button>
      {inCollection && <Button onClick={() => setDialog({ kind: 'folder' })}>Create folder</Button>}
      {parent === null && !flattened && (
        <Button onClick={() => setDialog({ kind: 'collection' })}>Create collection</Button>
      )}
      {actions}
    </SpaceBetween>
  );

  const filters = (
    <div className={styles.filters}>
      <div className={styles.find}>
        <TextFilter
          filteringText={q}
          filteringPlaceholder="Find by name"
          filteringAriaLabel="Find by name"
          countText={`${total} ${total === 1 ? 'match' : 'matches'}`}
          onChange={({ detail }) => refilter(setQ)(detail.filteringText)}
        />
      </div>
      <Multiselect
        selectedOptions={types}
        options={TYPES}
        placeholder="Any type"
        hideTokens
        onChange={({ detail }) => refilter(setTypes)(detail.selectedOptions)}
      />
      <Multiselect
        selectedOptions={statuses}
        options={STATUS_ORDER.map((s) => ({
          value: s,
          label: STATUS[s].label,
          iconName: STATUS[s].icon,
        }))}
        placeholder="Any status"
        hideTokens
        onChange={({ detail }) => refilter(setStatuses)(detail.selectedOptions)}
      />
      <Select
        selectedOption={size}
        options={[ANY_SIZE, ...SIZE_RANGES.map((r) => ({ value: r.value, label: r.label }))]}
        ariaLabel="Size"
        onChange={({ detail }) => refilter(setSize)(detail.selectedOption)}
      />
      <Select
        selectedOption={updated.option}
        options={WHEN}
        ariaLabel="Last updated"
        onChange={({ detail }) => {
          const days = Number(detail.selectedOption.value || 0);
          refilter(setUpdated)({
            option: detail.selectedOption,
            // Rounded to the hour so the query is the same between renders.
            from: days ? Math.floor((Date.now() - days * DAY) / 3_600_000) * 3_600_000 : null,
          });
        }}
      />
      <SegmentedControl
        selectedId={view}
        label="View"
        options={[
          { id: 'list', iconName: 'view-full', iconAlt: 'List' },
          { id: 'grid', iconName: 'grid-view', iconAlt: 'Grid' },
        ]}
        onChange={({ detail }) => setView(detail.selectedId as 'list' | 'grid')}
      />
    </div>
  );

  const empty = (
    <Box textAlign="center" color="inherit" padding="l">
      <SpaceBetween size="xs">
        <b>{filtering ? 'No matches' : 'Nothing here yet'}</b>
        <Box variant="p" color="inherit">
          {filtering
            ? 'No records match these filters.'
            : inCollection
              ? 'Upload files or a folder, or create a folder.'
              : 'Create a collection and upload files to it.'}
        </Box>
        {filtering && (
          <Button
            onClick={() => {
              setQ('');
              setTypes([]);
              setStatuses([]);
              setSize(ANY_SIZE);
              setUpdated({ option: WHEN[0]!, from: null });
              setPage(1);
            }}
          >
            Clear filters
          </Button>
        )}
      </SpaceBetween>
    </Box>
  );

  const pagination = (
    <Pagination
      currentPageIndex={page}
      pagesCount={Math.max(1, Math.ceil(total / PAGE))}
      onChange={({ detail }) => setPage(detail.currentPageIndex)}
    />
  );
  const tableHeader = (
    <Header
      variant="h2"
      counter={listing.data ? `(${total})` : undefined}
      description={description}
      actions={headerActions}
    >
      {header}
    </Header>
  );
  // Attachments go with their email, so only it can be picked.
  const isItemDisabled = (n: HubNode) => n.nodeType !== 'record' || isAttachment(n);
  const collectionId =
    listing.data?.currentNode?.nodeType === 'collection'
      ? listing.data.currentNode.id
      : (listing.data?.currentNode?.collectionId ?? null);
  const folderId = parent?.type === 'folder' ? parent.id : null;

  return (
    <>
      {view === 'list' ? (
        <div className={tableStyles.table}>
          <Table
            variant="container"
            stickyHeader
            header={tableHeader}
            filter={filters}
            pagination={pagination}
            items={items}
            columnDefinitions={columns}
            expandableRows={{
              isItemExpandable: (n) => n.nodeType === 'record' && n.hasChildren,
              getItemChildren: (n) => attachments.get(n.id)?.items ?? [],
              expandedItems: expanded,
              onExpandableItemToggle: ({ detail }) =>
                setExpanded((now) =>
                  detail.expanded
                    ? [...now, detail.item]
                    : now.filter((n) => n.id !== detail.item.id),
                ),
            }}
            getLoadingStatus={(n) => (n && attachments.get(n.id)?.loading ? 'loading' : 'finished')}
            renderLoaderLoading={() => (
              <StatusIndicator type="loading">Loading attachments</StatusIndicator>
            )}
            renderLoaderEmpty={() => <Box color="text-status-inactive">No attachments</Box>}
            trackBy="id"
            loading={listing.isPending}
            loadingText="Loading"
            empty={empty}
            selectionType="multi"
            selectedItems={selected}
            isItemDisabled={isItemDisabled}
            onSelectionChange={({ detail }) => setSelected(detail.selectedItems)}
            sortingColumn={{ sortingField: sort.by }}
            sortingDescending={sort.desc}
            onSortingChange={({ detail }) =>
              refilter(setSort)({
                by: (detail.sortingColumn.sortingField ?? 'updatedAt') as HubSort,
                desc: detail.isDescending ?? false,
              })
            }
            onRowClick={({ detail }) => {
              if (detail.item.nodeType === 'record') onSelectRecord(detail.item.id);
            }}
            ariaLabels={{
              selectionGroupLabel: 'Records',
              itemSelectionLabel: (_, n) => n.name,
              allItemsSelectionLabel: () => 'All records on this page',
              expandButtonLabel: (n) => `Show the attachments of ${n.name}`,
              collapseButtonLabel: (n) => `Hide the attachments of ${n.name}`,
            }}
          />
        </div>
      ) : (
        <Cards
          variant="container"
          stickyHeader
          header={tableHeader}
          filter={filters}
          pagination={pagination}
          items={items}
          trackBy="id"
          loading={listing.isPending}
          loadingText="Loading"
          empty={empty}
          selectionType="multi"
          selectedItems={selected}
          isItemDisabled={isItemDisabled}
          onSelectionChange={({ detail }) => setSelected(detail.selectedItems)}
          cardsPerRow={[{ cards: 1 }, { minWidth: 500, cards: 2 }, { minWidth: 900, cards: 4 }]}
          cardDefinition={{
            header: nameCell,
            sections: [
              {
                id: 'status',
                content: (n) => (n.nodeType === 'record' ? <NodeStatus node={n} /> : null),
              },
              {
                id: 'meta',
                content: (n) => (
                  <Box color="text-body-secondary" fontSize="body-s">
                    {n.nodeType === 'record' ? `${nodeSize(n)} · ` : ''}
                    Updated {formatMs(n.updatedAt)} UTC
                  </Box>
                ),
              },
            ],
          }}
        />
      )}

      <input
        ref={replaceInput}
        type="file"
        hidden
        aria-label="Replace file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const node = replacing.current;
          e.target.value = '';
          if (!file || !node) return;
          replace.mutate(
            { node, file },
            {
              onSuccess: (r) =>
                flash({
                  type: 'success',
                  content: `"${node.name}" replaced; now version ${r.version ?? ''}.`,
                }),
              onError: (err) =>
                flash({ type: 'error', content: problem(err, 'The file was not replaced.') }),
            },
          );
        }}
      />

      {dialog?.kind === 'rename' && (
        <NameModal
          title={`Rename ${dialog.node.nodeType}`}
          label="Name"
          initial={dialog.node.name}
          confirm="Rename"
          folder={dialog.node.nodeType === 'folder'}
          onSubmit={(name) => rename.mutateAsync({ node: dialog.node, name })}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'folder' && collectionId && (
        <NameModal
          title="Create folder"
          label="Folder name"
          confirm="Create"
          folder
          onSubmit={(name) =>
            hubApi.createFolder(api, collectionId, name, folderId).then(() => listing.refetch())
          }
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'collection' && (
        <NameModal
          title="Create collection"
          label="Collection name"
          confirm="Create"
          onSubmit={async (name) => {
            const created = await hubApi.createCollection(api, name);
            void navigate(`/knowledge/collections/${created.id}`);
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'move' && dialog.node.collectionId && (
        <MoveModal
          name={dialog.node.name}
          collectionId={dialog.node.collectionId}
          onSubmit={(folder) => move.mutateAsync({ node: dialog.node, folderId: folder })}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'confirm' && (
        <ConfirmModal
          title={dialog.title}
          confirm={dialog.label}
          danger={false}
          onConfirm={dialog.run}
          onClose={() => setDialog(null)}
        >
          <Box variant="p">{dialog.body}</Box>
        </ConfirmModal>
      )}
      {dialog?.kind === 'purge' && (
        <ConfirmModal
          title="Delete permanently"
          confirm="Delete permanently"
          onConfirm={() => purgeRecords(dialog.nodes)}
          onClose={() => setDialog(null)}
        >
          <Box variant="p">
            Delete{' '}
            {dialog.nodes.length === 1 ? (
              <b>{dialog.nodes[0]!.name}</b>
            ) : (
              `${dialog.nodes.length} records`
            )}{' '}
            and their attachments for good, search entries included? This cannot be undone.
            {dialog.nodes.some((n) => n.recordType === 'MAIL') && ' Your mailbox is not changed.'}
          </Box>
        </ConfirmModal>
      )}
      {dialog?.kind === 'delete' && (
        <ConfirmModal
          title={`Delete ${dialog.node.nodeType}`}
          confirm="Delete"
          onConfirm={() => remove.mutateAsync(dialog.node)}
          onClose={() => setDialog(null)}
        >
          {dialog.node.nodeType === 'collection' ? (
            <Box variant="p">
              Delete <b>{dialog.node.name}</b> and every file in it? This cannot be undone.
            </Box>
          ) : (
            <Box variant="p">
              Delete the folder <b>{dialog.node.name}</b> and the folders in it? Its files move to
              Recently deleted.
            </Box>
          )}
        </ConfirmModal>
      )}
    </>
  );
}
