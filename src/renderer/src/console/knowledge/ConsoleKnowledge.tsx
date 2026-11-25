import BreadcrumbGroup from '@cloudscape-design/components/breadcrumb-group';
import ButtonDropdown from '@cloudscape-design/components/button-dropdown';
import Container from '@cloudscape-design/components/container';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { useCallback, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { useRecordDetails, type HubListing, type RecordDetails } from '../../api/hub';
import { knowledgeApi } from '../../api/knowledge';
import { useAuth } from '../../auth/AuthProvider';
import { SettingsView } from '../../knowledge/SettingsView';
import { saveBlob } from '../../mail/attachments/useAttachment';
import { useRecentSearches } from '../../knowledge/parts';
import { useFlash } from '../../settings/flash';
import { usePageLayout } from '../pageLayout';
import { CollectionOverview } from './CollectionOverview';
import { HubBrowser } from './HubBrowser';
import { RecordPage } from './RecordPage';
import { RecordPanel } from './RecordPanel';
import { SearchPage } from './SearchPage';
import { KnowledgeFrame } from './KnowledgeFrame';
import { TrashView } from './TrashView';
import { useUploader } from './useUploader';

const VIEWS = new Set(['collections', 'mail', 'records', 'trash', 'search', 'settings']);
const TITLES: Record<string, string> = {
  collections: 'Collections',
  mail: 'Mail',
  records: 'All records',
  trash: 'Recently deleted',
  search: 'Search',
  settings: 'Settings',
};

// Knowledge as a console service: its own navigation, breadcrumbs and a side panel for a record.
// One route holds every knowledge path, so the navigation stays put while its pages change.
export default function ConsoleKnowledge() {
  const [view = 'collections', id] = (useParams()['*'] ?? '').split('/').filter(Boolean);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { api } = useAuth();
  const flash = useFlash();
  const record = params.get('record');
  // A record opened on a page of its own, over the table it was opened from.
  const item = params.get('item');
  const opened = useRecordDetails(item).data;
  const folder = params.get('folder');
  const [listing, setListing] = useState<HubListing | undefined>();
  const { recent, remember } = useRecentSearches();

  const selectRecord = useCallback(
    (next: string | null) =>
      setParams(
        (current) => {
          const copy = new URLSearchParams(current);
          if (next) copy.set('record', next);
          else copy.delete('record');
          return copy;
        },
        { replace: true },
      ),
    [setParams],
  );

  const openRecord = useCallback(
    (next: string | null) =>
      setParams((current) => {
        const copy = new URLSearchParams(current);
        copy.delete('record');
        if (next) copy.set('item', next);
        else copy.delete('item');
        return copy;
      }),
    [setParams],
  );

  const download = async (r: {
    id: string;
    name: string;
    mail?: { threadId?: string | null } | null;
  }) => {
    if (r.mail?.threadId) {
      void navigate(`/inbox/${r.mail.threadId}`);
      return;
    }
    try {
      saveBlob(await knowledgeApi.file(api, r.id), r.name);
    } catch {
      flash({ type: 'error', content: `${r.name} couldn't be downloaded.` });
    }
  };

  const collectionId = view === 'collections' ? (id ?? null) : null;
  const uploader = useUploader(collectionId ? { collectionId, folderId: folder } : null);

  const crumbs = [
    { text: 'Knowledge', href: '/knowledge' },
    { text: TITLES[view] ?? 'Collections', href: `/knowledge/${view}` },
    ...(collectionId || view === 'mail'
      ? (listing?.breadcrumbs ?? []).map((c) => ({
          text: c.name,
          href:
            c.nodeType === 'folder'
              ? `/knowledge/collections/${collectionId}?folder=${c.id}`
              : `/knowledge/${view}/${c.id}`,
        }))
      : []),
    ...(item ? [{ text: opened?.name ?? 'Record', href: `?${params.toString()}` }] : []),
  ];

  const breadcrumbs = (
    <BreadcrumbGroup
      items={crumbs}
      ariaLabel="Breadcrumbs"
      onFollow={(e) => {
        e.preventDefault();
        void navigate(e.detail.href);
      }}
    />
  );

  usePageLayout(
    {
      disableContentPaddings: true,
      splitPanel:
        record && !item ? (
          <RecordPanel
            key={record}
            id={record}
            onDownload={(r: RecordDetails) => void download(r)}
            onOpen={selectRecord}
          />
        ) : undefined,
      splitPanelOpen: record !== null && !item,
      onSplitPanelToggle: (open) => {
        if (!open) selectRecord(null);
      },
      contentType: view === 'settings' || view === 'search' ? 'default' : 'table',
    },
    [record, view, item],
  );

  if (!VIEWS.has(view)) return <Navigate to="/knowledge/collections" replace />;

  return (
    <KnowledgeFrame
      recent={recent}
      breadcrumbs={breadcrumbs}
      deep={view === 'search' || Boolean(item)}
    >
      {page()}
    </KnowledgeFrame>
  );

  function page() {
    if (item && view !== 'trash' && view !== 'search' && view !== 'settings')
      return (
        <RecordPage
          key={item}
          id={item}
          backLabel={`Back to ${listing?.currentNode?.name ?? TITLES[view] ?? 'records'}`}
          onBack={() => openRecord(null)}
          onOpen={openRecord}
          onDownload={(r) => void download(r)}
        />
      );
    if (view === 'trash') return <TrashView />;
    if (view === 'settings')
      return (
        <ContentLayout header={<Header variant="h1">Settings</Header>}>
          <Container>
            <SettingsView />
          </Container>
        </ContentLayout>
      );
    if (view === 'search')
      return (
        <SearchPage
          onSearched={remember}
          selected={record}
          onPreview={selectRecord}
          onOpen={(r) => void download({ id: r.recordId, name: r.name, mail: r.mail })}
        />
      );

    const parent = collectionId
      ? folder
        ? { type: 'folder' as const, id: folder }
        : { type: 'collection' as const, id: collectionId }
      : view === 'mail' && id
        ? { type: 'mailbox' as const, id }
        : null;
    const current = listing?.currentNode;

    return (
      <div
        onDragOver={(e) => {
          if (collectionId && e.dataTransfer.types.includes('Files')) e.preventDefault();
        }}
        onDrop={(e) => {
          if (!collectionId) return;
          e.preventDefault();
          void uploader.send([...e.dataTransfer.files].map((file) => ({ file })));
        }}
      >
        <SpaceBetween size="m">
          {collectionId && !folder && <CollectionOverview id={collectionId} />}
          <HubBrowser
            key={`${view}:${id ?? ''}:${folder ?? ''}`}
            parent={parent}
            flattened={view === 'records' ? true : undefined}
            header={parent ? (current?.name ?? ' ') : TITLES[view]}
            description={
              view === 'records'
                ? 'Every file and email in your knowledge base.'
                : parent
                  ? undefined
                  : 'Collections of your files, and the mail read into your knowledge base.'
            }
            actions={
              collectionId && (
                <ButtonDropdown
                  variant="primary"
                  mainAction={{ text: 'Upload', iconName: 'upload', onClick: uploader.pickFiles }}
                  items={[{ id: 'folder', text: 'Upload a folder' }]}
                  onItemClick={() => uploader.pickFolder()}
                  ariaLabel="More upload options"
                />
              )
            }
            selectedRecord={record}
            onSelectRecord={selectRecord}
            onOpenRecord={openRecord}
            onCurrent={setListing}
          />
        </SpaceBetween>
        {uploader.inputs}
      </div>
    );
  }
}
