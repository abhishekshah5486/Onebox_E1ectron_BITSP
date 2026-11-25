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
import TextFilter from '@cloudscape-design/components/text-filter';
import Pagination from '@cloudscape-design/components/pagination';
import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import {
  hubApi,
  useAttachments,
  useHubMutation,
  useRecordDetails,
  useUploadLimits,
  type HubNode,
  type RecordDetails,
} from '../../api/hub';
import { knowledgeApi } from '../../api/knowledge';
import { useAuth } from '../../auth/AuthProvider';
import { saveBlob } from '../../mail/attachments/useAttachment';
import { useFlash } from '../../settings/flash';
import tableStyles from '../../ui/DataTable.module.css';
import { Banner } from './Banner';
import { ConfirmModal } from './dialogs';
import styles from './Knowledge.module.css';
import { NodeIcon, NodeStatus, formatMs, nodeSize, problem } from './parts';
import { Preview, RecordFacts, RecordIndexing, RecordSummary } from './RecordPanel';
import { recordBanners, sampleBanners, type BannerSlot, type Banners } from './recordBanners';
import { FlowLoader } from './Sparkle';

type Widget = 'details' | 'indexing' | 'content' | 'attachments';
type Layout = { id: Widget; rowSpan: number; columnSpan: number }[];

// The layout a page starts with, and returns to on reset (the board has four columns).
const DEFAULT: Layout = [
  { id: 'details', columnSpan: 2, rowSpan: 4 },
  { id: 'content', columnSpan: 2, rowSpan: 4 },
  { id: 'attachments', columnSpan: 4, rowSpan: 4 },
  { id: 'indexing', columnSpan: 1, rowSpan: 4 },
];

const TITLES: Record<Widget, string> = {
  details: 'Details',
  indexing: 'Indexing',
  content: 'Content',
  attachments: 'Attachments',
};

// Kept per viewer in this browser: emails and files each have their own.
const layoutKey = (mail: boolean) => `onebox.knowledge.record-layout.v5.${mail ? 'mail' : 'file'}`;

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

// A file has no attachments card, and its details and content are a row taller.
const defaultFor = (mail: boolean): Layout =>
  mail
    ? DEFAULT
    : DEFAULT.filter((w) => w.id !== 'attachments').map((w) =>
        w.id === 'indexing' ? w : { ...w, rowSpan: w.rowSpan + 1 },
      );

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

// As the records tables page.
const PAGE = 20;

const SHORT = new Set(['EMPTY', 'FILE_TYPE_NOT_SUPPORTED', 'PASSWORD_PROTECTED', 'FAILED']);

// A card's banners, above what it shows.
function BannerStack({ list, open = false }: { list: Banners[BannerSlot]; open?: boolean }) {
  const [all, setAll] = useState(open);
  if (list.length === 0) return null;
  // The most pressing one; the rest on request, so a narrow card stays short.
  const shown = all ? list : list.slice(0, 1);
  return (
    <SpaceBetween size="xs">
      {shown.map(({ key, ...b }) => (
        <Banner key={key} {...b} />
      ))}
      {list.length > 1 && !open && (
        <Button variant="inline-link" onClick={() => setAll((on) => !on)}>
          {all ? 'Show less' : `+${list.length - 1} more`}
        </Button>
      )}
    </SpaceBetween>
  );
}

// Narrow cards show one at a time; the page and wide cards show all.
const stack = (list: Banners[BannerSlot], open = false) => <BannerStack list={list} open={open} />;

type Confirm = { title: string; label: string; body: ReactNode; run: () => Promise<unknown> };

// An email's files in the records table, with their own actions.
function AttachmentsTable({
  id,
  onOpen,
  banners,
  problemsOnly,
  frame,
}: {
  id: string;
  onOpen: (id: string) => void;
  banners: ReactNode;
  // Only the attachments that weren't indexed.
  problemsOnly: boolean;
  // Places the header (in the widget's own) and the table.
  frame: (header: ReactNode, table: ReactNode) => ReactNode;
}) {
  const { api } = useAuth();
  const flash = useFlash();
  const files = useAttachments([id]).get(id);
  const all = files?.items ?? [];
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const shown = problemsOnly ? all.filter((n) => SHORT.has(n.indexingStatus ?? '')) : all;
  // An email's files all come at once, so they are found and paged here.
  const found = q.trim()
    ? shown.filter((n) => n.name.toLowerCase().includes(q.trim().toLowerCase()))
    : shown;
  const pages = Math.max(1, Math.ceil(found.length / PAGE));
  const items = found.slice((Math.min(page, pages) - 1) * PAGE, Math.min(page, pages) * PAGE);
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
          : `(${selected.length ? `${selected.length}/` : ''}${found.length})`
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
      {banners && <div className={styles.tableBanners}>{banners}</div>}
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
        filter={
          <TextFilter
            filteringText={q}
            filteringPlaceholder="Find attachments"
            filteringAriaLabel="Find attachments by name"
            countText={
              q ? `${found.length} ${found.length === 1 ? 'match' : 'matches'}` : undefined
            }
            onChange={({ detail }) => {
              setQ(detail.filteringText);
              setPage(1);
            }}
          />
        }
        pagination={
          <Pagination
            currentPageIndex={Math.min(page, pages)}
            pagesCount={pages}
            onChange={({ detail }) => setPage(detail.currentPageIndex)}
          />
        }
        empty={
          <Box color="text-body-secondary">
            {q ? 'No attachments match.' : 'This email has no attachments.'}
          </Box>
        }
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
  const flash = useFlash();
  const [params] = useSearchParams();
  const files = useAttachments([id]).get(id)?.items ?? [];
  const retention = useUploadLimits().data?.trashRetentionDays ?? 14;
  const [problemsOnly, setProblemsOnly] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const reindex = useHubMutation((a, ids: string[]) => hubApi.reindex(a, ids));
  const restore = useHubMutation((a, ids: string[]) => hubApi.restore(a, ids));
  const summarize = useHubMutation((a, ids: string[]) => hubApi.summarize(a, ids));
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

  const noun = mail ? 'email' : 'file';
  const bannerActions = {
    open: onOpen,
    problemsOnly,
    toggleProblems: () => setProblemsOnly((on) => !on),
    indexAgain: () =>
      setConfirm({
        title: 'Index again',
        label: 'Index again',
        body: (
          <>
            Index <b>{record.name}</b> again from the start? It is read, indexed and summarized
            again, which takes a while for large files.
          </>
        ),
        run: async () => {
          const { queued } = await reindex.mutateAsync([record.id]);
          flash({
            type: queued.length ? 'success' : 'warning',
            content: queued.length ? 'Queued to be indexed again.' : 'It couldn’t be queued.',
          });
        },
      }),
    summarizeAgain: () =>
      setConfirm({
        title: 'Summarize again',
        label: 'Summarize again',
        body: (
          <>
            Write the summary of <b>{record.name}</b> again? Only the summary is made again, from
            the text already indexed. Search keeps working meanwhile.
          </>
        ),
        run: async () => {
          const { queued, skipped } = await summarize.mutateAsync([record.id]);
          flash(
            queued.length
              ? { type: 'success', content: 'Queued to be summarized again.' }
              : { type: 'warning', content: skipped[0]?.reason ?? 'It couldn’t be queued.' },
          );
        },
      }),
    restore: () =>
      setConfirm({
        title: `Restore ${noun}`,
        label: 'Restore',
        body: (
          <>
            Restore <b>{record.name}</b>? It goes back to where it was and is indexed again, so it
            appears in search results after a short while.
          </>
        ),
        run: async () => {
          await restore.mutateAsync([record.id]);
          flash({ type: 'success', content: `${record.name} was restored.` });
        },
      }),
  };
  // `?banners=sample` shows every banner, to see how each looks.
  const banners =
    params.get('banners') === 'sample'
      ? sampleBanners(bannerActions)
      : recordBanners(record, files, retention, bannerActions);

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

  const body = (widget: Widget) => (
    <SpaceBetween size="l">
      {stack(banners[widget].map(({ action: _, ...b }) => b))}
      {widget === 'details' ? (
        <RecordFacts record={record} onOpen={onOpen} columns={2} withStatus={false} />
      ) : widget === 'indexing' ? (
        <RecordIndexing record={record} withStatus columns={2} />
      ) : (
        <ContentTabs record={record} />
      )}
    </SpaceBetween>
  );

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
      {stack(banners.page, true)}
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
              banners={stack(banners.attachments, true)}
              problemsOnly={problemsOnly}
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
              header={
                // A narrow card's banner buttons sit in its header, so the banner stays short.
                <Header
                  variant="h2"
                  actions={
                    banners[item.data].some((b) => Boolean(b.action)) && (
                      <SpaceBetween direction="horizontal" size="xs">
                        {banners[item.data]
                          .filter((b) => Boolean(b.action))
                          .map((b) => (
                            <span key={b.key}>{b.action}</span>
                          ))}
                      </SpaceBetween>
                    )
                  }
                >
                  {TITLES[item.data]}
                </Header>
              }
              settings={settings(() => actions.removeItem(), TITLES[item.data])}
              i18nStrings={itemStrings(TITLES[item.data])}
            >
              {body(item.data)}
            </BoardItem>
          )
        }
      />
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
    </SpaceBetween>
  );
}
