import BreadcrumbGroup from '@cloudscape-design/components/breadcrumb-group';
import ButtonDropdown from '@cloudscape-design/components/button-dropdown';
import Container from '@cloudscape-design/components/container';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { useCallback, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { type HubListing, type RecordDetails } from '../../api/hub';
import { knowledgeApi } from '../../api/knowledge';
import { useAuth } from '../../auth/AuthProvider';
import { SearchView } from '../../knowledge/SearchView';
import { SettingsView } from '../../knowledge/SettingsView';
import { saveBlob } from '../../mail/attachments/useAttachment';
import { useFlash } from '../../settings/flash';
import { usePageLayout } from '../pageLayout';
import { CollectionOverview } from './CollectionOverview';
import { HubBrowser } from './HubBrowser';
import { RecordPanel } from './RecordPanel';
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
export default function ConsoleKnowledge() {
  const { view = 'collections', id } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { api } = useAuth();
  const flash = useFlash();
  const record = params.get('record');
  const folder = params.get('folder');
  const [listing, setListing] = useState<HubListing | undefined>();

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
  ];

  usePageLayout(
    {
      breadcrumbs: (
        <BreadcrumbGroup
          items={crumbs}
          ariaLabel="Breadcrumbs"
          onFollow={(e) => {
            e.preventDefault();
            void navigate(e.detail.href);
          }}
        />
      ),
      splitPanel: record ? (
        <RecordPanel key={record} id={record} onDownload={(r: RecordDetails) => void download(r)} />
      ) : undefined,
      splitPanelOpen: record !== null,
      onSplitPanelToggle: (open) => {
        if (!open) selectRecord(null);
      },
      contentType: view === 'settings' || view === 'search' ? 'default' : 'table',
    },
    [record, view, id, folder, JSON.stringify(crumbs)],
  );

  if (!VIEWS.has(view)) return <Navigate to="/knowledge/collections" replace />;

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
      <ContentLayout
        header={
          <Header variant="h1" description="Ask across your collections and mail.">
            Search
          </Header>
        }
      >
        <SearchView
          onSearched={() => undefined}
          focus={record ? { recordId: record } : null}
          onPreview={(f) => selectRecord(f.recordId)}
          onOpen={(r) => void download({ id: r.recordId, name: r.name, mail: r.mail })}
        />
      </ContentLayout>
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
          onCurrent={setListing}
        />
      </SpaceBetween>
      {uploader.inputs}
    </div>
  );
}
