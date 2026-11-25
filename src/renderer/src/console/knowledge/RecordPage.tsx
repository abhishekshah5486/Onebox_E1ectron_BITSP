import Board, { type BoardProps } from '@cloudscape-design/board-components/board';
import BoardItem from '@cloudscape-design/board-components/board-item';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ButtonDropdown from '@cloudscape-design/components/button-dropdown';
import Header from '@cloudscape-design/components/header';
import Link from '@cloudscape-design/components/link';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Table from '@cloudscape-design/components/table';
import Tabs from '@cloudscape-design/components/tabs';
import { useState, type ReactNode } from 'react';
import {
  hubApi,
  useAttachments,
  useHubMutation,
  useRecordDetails,
  type HubNode,
  type RecordDetails,
} from '../../api/hub';
import { knowledgeApi } from '../../api/knowledge';
import { useAuth } from '../../auth/AuthProvider';
import { saveBlob } from '../../mail/attachments/useAttachment';
import { useFlash } from '../../settings/flash';
import tableStyles from '../../ui/DataTable.module.css';
import { ConfirmModal } from './dialogs';
import styles from './Knowledge.module.css';
import { NodeIcon, NodeStatus, formatMs, nodeSize, problem } from './parts';
import { Preview, RecordFacts, RecordIndexing, RecordSummary } from './RecordPanel';
import { FlowLoader } from './Sparkle';

type Widget = 'details' | 'indexing' | 'content' | 'attachments';
type Layout = { id: Widget; rowSpan: number; columnSpan: number }[];

// The layout a page starts with, and returns to on reset (the board has four columns).
const DEFAULT: Layout = [
  { id: 'details', columnSpan: 2, rowSpan: 5 },
  { id: 'indexing', columnSpan: 2, rowSpan: 5 },
  { id: 'attachments', columnSpan: 4, rowSpan: 4 },
  { id: 'content', columnSpan: 4, rowSpan: 5 },
];

const TITLES: Record<Widget, string> = {
  details: 'Details',
  indexing: 'Indexing',
  content: 'Content',
  attachments: 'Attachments',
};

// Kept per viewer in this browser: emails and files each have their own.
const layoutKey = (mail: boolean) => `onebox.knowledge.record-layout.v3.${mail ? 'mail' : 'file'}`;

function loadLayout(mail: boolean): Layout | null {
  try {
    const saved = JSON.parse(localStorage.getItem(layoutKey(mail)) ?? 'null') as Layout | null;
    return Array.isArray(saved) && saved.every((w) => w.id in TITLES) ? saved : null;
  } catch {
    return null;
  }
}

function saveLayout(mail: boolean, layout: Layout | null) {
  try {
    if (layout) localStorage.setItem(layoutKey(mail), JSON.stringify(layout));
    else localStorage.removeItem(layoutKey(mail));
  } catch {
    // Not kept, then; the page still works.
  }
}

const defaultFor = (mail: boolean) => DEFAULT.filter((w) => mail || w.id !== 'attachments');

const BOARD_STRINGS: BoardProps.I18nStrings<Widget> = {
  liveAnnouncementDndStarted: (op) => (op === 'resize' ? 'Resizing' : 'Dragging'),
  liveAnnouncementDndItemReordered: (op) =>
    `Moved ${TITLES[op.item.data]} to column ${op.placement.x + 1}, row ${op.placement.y + 1}.`,
  liveAnnouncementDndItemResized: (op) =>
    `Resized ${TITLES[op.item.data]} to ${op.placement.width} columns, ${op.placement.height} rows.`,
  liveAnnouncementDndItemInserted: (op) => `Added ${TITLES[op.item.data]}.`,
  liveAnnouncementDndCommitted: (op) => `${op === 'resize' ? 'Resize' : 'Move'} done.`,
  liveAnnouncementDndDiscarded: (op) => `${op === 'resize' ? 'Resize' : 'Move'} cancelled.`,
  liveAnnouncementItemRemoved: (op) => `Removed ${TITLES[op.item.data]}.`,
  navigationAriaLabel: 'Record widgets',
  navigationItemAriaLabel: (item) => (item ? TITLES[item.data] : 'Empty'),
};

const itemStrings = (title: string) => ({
  dragHandleAriaLabel: `Move ${title}`,
  dragHandleTooltipText: 'Drag to move',
  resizeHandleAriaLabel: `Resize ${title}`,
  resizeHandleTooltipText: 'Drag to resize',
});

// What was read: its summary (as in the side panel) and its text, a tab each.
function ContentTabs({ record }: { record: RecordDetails }) {
  const [tab, setTab] = useState('summary');
  return (
    <Tabs
      activeTabId={tab}
      onChange={({ detail }) => setTab(detail.activeTabId)}
      tabs={[
        {
          id: 'summary',
          label: 'Summary',
          content: record.classification ? (
            <RecordSummary record={record} />
          ) : (
            <Box color="text-body-secondary">Not summarized yet.</Box>
          ),
        },
        // Its text is read only once this tab is opened.
        {
          id: 'preview',
          label: 'Preview',
          content: tab === 'preview' && <Preview id={record.id} />,
        },
      ]}
    />
  );
}

type Confirm = { title: string; label: string; body: ReactNode; run: () => Promise<unknown> };

// An email's files in the records table, with their own actions.
function AttachmentsTable({
  id,
  onOpen,
  frame,
}: {
  id: string;
  onOpen: (id: string) => void;
  // Places the header (in the widget's own) and the table.
  frame: (header: ReactNode, table: ReactNode) => ReactNode;
}) {
  const { api } = useAuth();
  const flash = useFlash();
  const files = useAttachments([id]).get(id);
  const items = files?.items ?? [];
  const [selected, setSelected] = useState<HubNode[]>([]);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const reindex = useHubMutation((a, ids: string[]) => hubApi.reindex(a, ids));

  const save = async (nodes: HubNode[]) => {
    let failed = 0;
    for (const n of nodes) {
      try {
        saveBlob(await knowledgeApi.file(api, n.id), n.name);
      } catch {
        failed += 1;
      }
    }
    if (failed) flash({ type: 'error', content: `${failed} couldn't be downloaded.` });
  };
  const what = (nodes: HubNode[]) =>
    nodes.length === 1 ? <b>{nodes[0]!.name}</b> : `${nodes.length} attachments`;
  const download = (nodes: HubNode[]) =>
    nodes.length === 1
      ? void save(nodes)
      : setConfirm({
          title: `Download ${nodes.length} attachments`,
          label: 'Download',
          body: <>Save {nodes.length} files one after another?</>,
          run: () => save(nodes),
        });
  const indexAgain = (nodes: HubNode[]) =>
    setConfirm({
      title: 'Index again',
      label: 'Index again',
      body: (
        <>
          Index {what(nodes)} again from the start? Each is read, indexed and summarized again,
          which takes a while for large files.
        </>
      ),
      run: async () => {
        try {
          const { queued } = await reindex.mutateAsync(nodes.map((n) => n.id));
          flash({ type: 'success', content: `${queued.length} queued to be indexed again.` });
        } catch (err) {
          flash({ type: 'error', content: problem(err, 'Nothing was queued.') });
        }
      },
    });

  const header = (
    <Header
      variant="h2"
      counter={
        files?.loading
          ? undefined
          : `(${selected.length ? `${selected.length}/` : ''}${items.length})`
      }
      actions={
        <SpaceBetween direction="horizontal" size="xs">
          <Button
            iconName="download"
            disabled={selected.length === 0}
            onClick={() => download(selected)}
          >
            Download
          </Button>
          <Button
            iconName="refresh"
            disabled={selected.length === 0}
            onClick={() => indexAgain(selected)}
          >
            Index again
          </Button>
        </SpaceBetween>
      }
    >
      Attachments
    </Header>
  );
  const table = (
    <div className={tableStyles.table}>
      <Table
        variant="borderless"
        loading={files?.loading}
        loadingText="Loading attachments"
        selectionType="multi"
        selectedItems={selected}
        onSelectionChange={({ detail }) => setSelected(detail.selectedItems)}
        ariaLabels={{
          selectionGroupLabel: 'Attachments',
          itemSelectionLabel: (_, n) => n.name,
          allItemsSelectionLabel: () => 'All attachments',
        }}
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
          {
            id: 'updatedAt',
            header: 'Last updated (UTC)',
            cell: (n) => formatMs(n.updatedAt),
          },
          {
            id: 'actions',
            header: 'Actions',
            cell: (n) => (
              <ButtonDropdown
                variant="inline-icon"
                ariaLabel={`Actions for ${n.name}`}
                expandToViewport
                items={[
                  { id: 'open', text: 'Open', iconName: 'folder-open' as const },
                  { id: 'download', text: 'Download', iconName: 'download' as const },
                  { id: 'reindex', text: 'Index again', iconName: 'refresh' as const },
                ]}
                onItemClick={({ detail }) => {
                  if (detail.id === 'open') onOpen(n.id);
                  else if (detail.id === 'download') download([n]);
                  else indexAgain([n]);
                }}
              />
            ),
          },
        ]}
      />
    </div>
  );
  return (
    <>
      {frame(header, table)}
      {confirm && (
        <ConfirmModal
          title={confirm.title}
          confirm={confirm.label}
          danger={false}
          onConfirm={confirm.run}
          onClose={() => setConfirm(null)}
        >
          <Box variant="p">{confirm.body}</Box>
        </ConfirmModal>
      )}
    </>
  );
}

// A record on a page of its own, as widgets the viewer can move, resize, remove and reset.
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
  const mail = record?.recordType === 'MAIL';
  const [custom, setCustom] = useState<{ mail: boolean; layout: Layout | null }>(() => ({
    mail,
    layout: loadLayout(mail),
  }));
  // Read again once it's known whether this is an email or a file.
  const layout = custom.mail === mail ? custom.layout : loadLayout(mail);
  const setLayout = (next: Layout | null) => {
    saveLayout(mail, next);
    setCustom({ mail, layout: next });
  };

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

  const items: BoardProps.Item<Widget>[] = (layout ?? defaultFor(mail))
    .filter((w) => mail || w.id !== 'attachments')
    .map((w) => ({
      id: w.id,
      data: w.id,
      rowSpan: w.rowSpan,
      columnSpan: w.columnSpan,
      definition: { minRowSpan: 3, minColumnSpan: 1 },
    }));

  const settings = (remove: () => void, title: string) => (
    <ButtonDropdown
      variant="icon"
      ariaLabel={`${title} settings`}
      items={[{ id: 'remove', text: 'Remove', iconName: 'remove' as const }]}
      onItemClick={() => remove()}
    />
  );

  const body = (widget: Widget) => {
    if (widget === 'details')
      return <RecordFacts record={record} onOpen={onOpen} columns={2} withStatus={false} />;
    if (widget === 'indexing') return <RecordIndexing record={record} withStatus columns={2} />;
    return <ContentTabs record={record} />;
  };

  return (
    <SpaceBetween size="l">
      <Header
        variant="h1"
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button iconName="arrow-left" onClick={onBack}>
              {backLabel}
            </Button>
            <Button disabled={layout === null} onClick={() => setLayout(null)}>
              Reset to default layout
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
      <Board<Widget>
        items={items}
        i18nStrings={BOARD_STRINGS}
        onItemsChange={({ detail }) =>
          setLayout(
            detail.items.map((i) => ({
              id: i.data,
              rowSpan: i.rowSpan ?? 5,
              columnSpan: i.columnSpan ?? 1,
            })),
          )
        }
        empty={
          <Box textAlign="center" color="text-body-secondary" padding="xxl">
            Every widget is removed. Reset to default layout to bring them back.
          </Box>
        }
        renderItem={(item, actions) =>
          item.data === 'attachments' ? (
            <AttachmentsTable
              id={record.id}
              onOpen={onOpen}
              frame={(header, table) => (
                <BoardItem
                  header={header}
                  settings={settings(() => actions.removeItem(), 'Attachments')}
                  i18nStrings={itemStrings('Attachments')}
                  disableContentPaddings
                >
                  {table}
                </BoardItem>
              )}
            />
          ) : (
            <BoardItem
              header={<Header variant="h2">{TITLES[item.data]}</Header>}
              settings={settings(() => actions.removeItem(), TITLES[item.data])}
              i18nStrings={itemStrings(TITLES[item.data])}
            >
              {body(item.data)}
            </BoardItem>
          )
        }
      />
    </SpaceBetween>
  );
}
