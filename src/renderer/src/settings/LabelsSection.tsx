import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import FormField from '@cloudscape-design/components/form-field';
import Header from '@cloudscape-design/components/header';
import Input from '@cloudscape-design/components/input';
import KeyValuePairs from '@cloudscape-design/components/key-value-pairs';
import Modal from '@cloudscape-design/components/modal';
import Pagination from '@cloudscape-design/components/pagination';
import Select from '@cloudscape-design/components/select';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Textarea from '@cloudscape-design/components/textarea';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Table from '@cloudscape-design/components/table';
import TextFilter from '@cloudscape-design/components/text-filter';
import Toggle from '@cloudscape-design/components/toggle';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { mailApi } from '../api/mail';
import { ProviderLogo } from '../accounts/ProviderLogo';
import type { Account } from '../api/accounts';
import { aiApi, useLabelRules, useSaveLabelRule, type AiMode, type LabelRule } from '../api/ai';
import { useAccountFolders, useLabelChange } from '../api/mail-queries';
import { useAuth } from '../auth/AuthProvider';
import { useAccounts, usePreferences, useUpdatePreferences } from '../api/queries';
import { describeError } from '../auth/errors';
import {
  categoryKey,
  FOLDER_LABEL,
  folderName,
  labelKey,
  labelPath,
  MAIL_CATEGORIES,
  MAIL_CATEGORY_LABEL,
  type FolderRole,
} from '../mail/folders';
import { useFlash } from './flash';
import tableStyles from '../ui/DataTable.module.css';
import styles from './LabelsSection.module.css';

const FOLDERS: FolderRole[] = ['sent', 'drafts', 'archive', 'spam', 'trash'];

const MODE_LABEL: Record<AiMode, string> = {
  auto: 'AI applies it',
  suggest: 'AI suggests it',
  off: 'Manual only',
};
const MODE_OPTIONS = (['auto', 'suggest', 'off'] as const).map((value) => ({
  value,
  label: MODE_LABEL[value],
  description:
    value === 'auto'
      ? 'Put on matching mail automatically'
      : value === 'suggest'
        ? 'Wait in Suggestions for you to confirm'
        : 'AI leaves this label alone',
}));
const LABEL_PAGE = 10;
const TABS = ['promotions', 'social', 'updates', 'forums'];

type Editing =
  | { mode: 'create' }
  | { mode: 'edit' | 'delete' | 'details'; account: Account; path: string; name: string };

// Folders, categories and labels: what shows in the sidebar and message list, and the labels
// themselves, which are created, renamed and deleted on the mail server.
export function LabelsSection() {
  const accounts = useAccounts().data ?? [];
  const folderQueries = useAccountFolders(accounts.map((account) => account.id));
  const preferences = usePreferences();
  const update = useUpdatePreferences();
  const flash = useFlash();
  const navigate = useNavigate();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [search, setSearch] = useState('');
  const [folderSearch, setFolderSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [deletingMany, setDeletingMany] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [labelPage, setLabelPage] = useState(1);
  const rules = useLabelRules();
  const ruleOf = (accountId: string, path: string) =>
    rules.data?.items.find((rule) => rule.accountId === accountId && rule.path === path);

  // Nothing can be toggled until the saved choices are known, so a toggle never works from a guess.
  const ready = preferences.isSuccess;
  const hidden = new Set(preferences.data?.sidebarHidden ?? []);
  const chipsHidden = new Set(preferences.data?.chipsHidden ?? []);
  const tabs = new Set(preferences.data?.inboxTabs ?? TABS);
  const toggleIn = (list: Set<string>, key: string, on: boolean) => {
    const next = new Set(list);
    if (on) next.add(key);
    else next.delete(key);
    return [...next];
  };
  const save = (changes: Parameters<typeof update.mutate>[0]) =>
    update.mutate(changes, {
      onError: (error) => flash({ type: 'error', content: describeError(error) }),
    });
  const sidebarToggle = (key: string, label: string) => (
    <Toggle
      checked={!hidden.has(key)}
      disabled={!ready}
      ariaLabel={`Show ${label} in the sidebar`}
      onChange={({ detail }) => save({ sidebarHidden: toggleIn(hidden, key, !detail.checked) })}
    />
  );

  const archiveName = folderQueries
    .flatMap((q) => q.data?.items ?? [])
    .find((f) => f.role === 'archive')?.name;
  const labels = accounts.flatMap((account, i) =>
    (folderQueries[i]?.data?.items ?? [])
      .filter((folder) => folder.role === 'label')
      .map((folder) => ({ account, rule: ruleOf(account.id, folder.path), ...folder })),
  );
  type LabelRow = (typeof labels)[number];
  const modeOf = (row: LabelRow): AiMode | 'none' =>
    row.rule ? (row.rule.mode === 'off' && !row.rule.description ? 'none' : row.rule.mode) : 'none';
  const needle = search.trim().toLowerCase();
  const visible = labels.filter(
    (row) =>
      !needle ||
      `${row.name} ${row.rule?.description ?? ''} ${row.account.emailAddress}`
        .toLowerCase()
        .includes(needle),
  );
  const keyOf = (row: LabelRow) => `${row.account.id}:${row.path}`;
  const picked = labels.filter((row) => selectedKeys.includes(keyOf(row)));
  // View and Edit work on one label; Delete on any number.
  const selected = picked.length === 1 ? picked[0]! : null;
  const deleteMany = async () => {
    setDeleting(true);
    const results = await Promise.allSettled(
      picked.map(async (row) => {
        await mailApi.deleteLabel(api, row.account.id, row.path);
        await aiApi.removeRule(api, row.account.id, row.path).catch(() => {});
      }),
    );
    const failed = results.filter((result) => result.status === 'rejected').length;
    void queryClient.invalidateQueries({ queryKey: ['mail'] });
    void rules.refetch();
    setDeleting(false);
    setDeletingMany(false);
    setSelectedKeys([]);
    flash(
      failed
        ? { type: 'error', content: `${failed} of ${picked.length} labels could not be deleted.` }
        : { type: 'success', content: `${picked.length} labels deleted.` },
    );
  };
  const edit = (row: LabelRow, mode: 'edit' | 'delete' | 'details') =>
    setEditing({ mode, account: row.account, path: row.path, name: row.name });
  const view = (row: LabelRow) => void navigate(labelPath(row.account.id, row.path));
  const reloadLabels = () => {
    folderQueries.forEach((q) => void q.refetch());
    void rules.refetch();
  };
  const refresh = (label: string, onClick: () => void) => (
    <Button iconName="refresh" ariaLabel={`Reload ${label}`} onClick={onClick} />
  );
  const matches = (text: string, query: string) =>
    text.toLowerCase().includes(query.trim().toLowerCase());
  const folderRows = FOLDERS.map((role) => ({
    role,
    name: role === 'archive' ? folderName(role, archiveName) : FOLDER_LABEL[role],
  })).filter((row) => matches(row.name, folderSearch));
  const categoryRows = MAIL_CATEGORIES.filter((category) =>
    matches(MAIL_CATEGORY_LABEL[category], categorySearch),
  ).map((category) => ({ category }));
  const searchBox = (value: string, onChange: (value: string) => void, placeholder: string) => (
    <TextFilter
      filteringText={value}
      filteringPlaceholder={placeholder}
      filteringAriaLabel={placeholder}
      onChange={({ detail }) => onChange(detail.filteringText)}
    />
  );

  return (
    <div className={tableStyles.table}>
      <SpaceBetween size="l">
        {preferences.isError && (
          <Alert
            type="error"
            action={<Button onClick={() => void preferences.refetch()}>Try again</Button>}
          >
            Your label settings could not be loaded. {describeError(preferences.error)}
          </Alert>
        )}
        <Container
          header={
            <Header
              variant="h2"
              counter={`(${labels.length})`}
              description="Your own labels, kept on the mail server. On providers other than Gmail they are folders."
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  {refresh('labels', reloadLabels)}
                  <Button
                    disabled={!selected}
                    onClick={() => selected && edit(selected, 'details')}
                  >
                    View details
                  </Button>
                  <Button disabled={!selected} onClick={() => selected && view(selected)}>
                    View conversations
                  </Button>
                  <Button disabled={!selected} onClick={() => selected && edit(selected, 'edit')}>
                    Edit
                  </Button>
                  <Button
                    disabled={picked.length === 0}
                    onClick={() => (selected ? edit(selected, 'delete') : setDeletingMany(true))}
                  >
                    Delete
                  </Button>
                  <Button
                    iconName="add-plus"
                    variant="primary"
                    disabled={accounts.length === 0}
                    onClick={() => setEditing({ mode: 'create' })}
                  >
                    Create label
                  </Button>
                </SpaceBetween>
              }
            >
              Labels
            </Header>
          }
        >
          <Table
            variant="embedded"
            ariaLabels={{
              tableLabel: 'Labels',
              selectionGroupLabel: 'Label selection',
              itemSelectionLabel: (_, item) => `Select ${item.name}`,
              allItemsSelectionLabel: () => 'Select all labels',
            }}
            items={visible.slice((labelPage - 1) * LABEL_PAGE, labelPage * LABEL_PAGE)}
            pagination={
              <Pagination
                currentPageIndex={labelPage}
                pagesCount={Math.max(1, Math.ceil(visible.length / LABEL_PAGE))}
                onChange={({ detail }) => setLabelPage(detail.currentPageIndex)}
              />
            }
            trackBy={keyOf}
            wrapLines={false}
            selectionType="multi"
            selectedItems={picked}
            onSelectionChange={({ detail }) => setSelectedKeys(detail.selectedItems.map(keyOf))}
            filter={
              <div className={styles.toolbar}>
                <TextFilter
                  filteringText={search}
                  filteringPlaceholder="Find a label"
                  filteringAriaLabel="Find a label"
                  onChange={({ detail }) => {
                    setSearch(detail.filteringText);
                    setLabelPage(1);
                  }}
                />
              </div>
            }
            empty={
              <Box textAlign="center" color="inherit">
                <b>{labels.length ? 'No matching labels' : 'No labels yet'}</b>
                <Box variant="p" color="inherit">
                  {labels.length
                    ? 'Try another filter.'
                    : 'Create one to file conversations your way.'}
                </Box>
              </Box>
            }
            columnDefinitions={[
              {
                id: 'name',
                header: 'Label',
                cell: (item) => item.name,
              },
              {
                id: 'mode',
                header: 'AI sorting',
                cell: (item) => {
                  const mode = modeOf(item);
                  return mode === 'auto' ? (
                    <StatusIndicator type="success">AI applies it</StatusIndicator>
                  ) : mode === 'suggest' ? (
                    <StatusIndicator type="info">AI suggests it</StatusIndicator>
                  ) : (
                    <StatusIndicator type="stopped">Manual only</StatusIndicator>
                  );
                },
              },
              {
                id: 'description',
                header: 'Description',
                maxWidth: 240,
                cell: (item) =>
                  item.rule?.description ? (
                    <span className={styles.description} title={item.rule.description}>
                      {item.rule.description}
                    </span>
                  ) : (
                    <Button variant="inline-link" onClick={() => edit(item, 'edit')}>
                      Add a description
                    </Button>
                  ),
              },
              {
                id: 'account',
                header: 'Account',
                cell: (item) => (
                  <span className={styles.account} title={item.account.emailAddress}>
                    <ProviderLogo provider={item.account.provider} size={16} />
                    <span>{item.account.emailAddress}</span>
                  </span>
                ),
              },
              {
                id: 'count',
                header: 'Conversations',
                cell: (item) => item.total.toLocaleString(),
              },
              {
                id: 'sidebar',
                header: 'In sidebar',
                cell: (item) => sidebarToggle(labelKey(item.account.id, item.path), item.name),
              },
              {
                id: 'chips',
                header: 'On mail',
                cell: (item) => {
                  const key = labelKey(item.account.id, item.path);
                  return (
                    <Toggle
                      checked={!chipsHidden.has(key)}
                      disabled={!ready}
                      ariaLabel={`Show ${item.name} on conversations in the list`}
                      onChange={({ detail }) =>
                        save({ chipsHidden: toggleIn(chipsHidden, key, !detail.checked) })
                      }
                    />
                  );
                },
              },
            ]}
          />
        </Container>

        <Container
          header={
            <Header
              variant="h2"
              description="Inbox is always shown."
              actions={refresh('folders', () => void preferences.refetch())}
            >
              Folders
            </Header>
          }
        >
          <Table
            variant="embedded"
            ariaLabels={{ tableLabel: 'Folders' }}
            loading={preferences.isPending}
            loadingText="Loading"
            items={folderRows}
            filter={searchBox(folderSearch, setFolderSearch, 'Find a folder')}
            columnDefinitions={[
              { id: 'name', header: 'Folder', cell: ({ name }) => name },
              {
                id: 'sidebar',
                header: 'Show in sidebar',
                width: 180,
                cell: ({ role }) => sidebarToggle(role, FOLDER_LABEL[role]),
              },
            ]}
          />
        </Container>

        <Container
          header={
            <Header
              variant="h2"
              description="Gmail sorts mail into these. Tabs split the inbox; Purchases and Travel gather receipts and bookings from every folder."
              actions={refresh('categories', () => void preferences.refetch())}
            >
              Categories
            </Header>
          }
        >
          <Table
            variant="embedded"
            ariaLabels={{ tableLabel: 'Categories' }}
            loading={preferences.isPending}
            loadingText="Loading"
            items={categoryRows}
            filter={searchBox(categorySearch, setCategorySearch, 'Find a category')}
            columnDefinitions={[
              {
                id: 'name',
                header: 'Category',
                cell: ({ category }) => MAIL_CATEGORY_LABEL[category],
              },
              {
                id: 'sidebar',
                header: 'Show in sidebar',
                width: 180,
                cell: ({ category }) =>
                  sidebarToggle(categoryKey(category), MAIL_CATEGORY_LABEL[category]),
              },
              {
                id: 'tab',
                header: 'Inbox tab',
                width: 180,
                cell: ({ category }) =>
                  TABS.includes(category) ? (
                    <Toggle
                      checked={tabs.has(category)}
                      disabled={!ready}
                      ariaLabel={`Show ${MAIL_CATEGORY_LABEL[category]} as an inbox tab`}
                      onChange={({ detail }) =>
                        save({ inboxTabs: toggleIn(tabs, category, detail.checked) })
                      }
                    />
                  ) : (
                    <Box color="text-status-inactive">—</Box>
                  ),
              },
            ]}
          />
        </Container>

        <Modal
          visible={deletingMany}
          onDismiss={() => setDeletingMany(false)}
          header="Delete labels"
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => setDeletingMany(false)}>
                  Cancel
                </Button>
                <Button variant="primary" loading={deleting} onClick={() => void deleteMany()}>
                  Delete
                </Button>
              </SpaceBetween>
            </Box>
          }
        >
          Delete <b>{picked.length} labels</b> ({picked.map((row) => row.name).join(', ')})? On
          Gmail the conversations in them stay in your mailbox; other providers only delete empty
          folders.
        </Modal>
        {editing?.mode === 'details' && selected && (
          <Modal
            visible
            size="medium"
            onDismiss={() => setEditing(null)}
            header={selected.name}
            footer={
              <Box float="right">
                <SpaceBetween direction="horizontal" size="xs">
                  <Button onClick={() => edit(selected, 'edit')}>Edit</Button>
                  <Button variant="primary" onClick={() => view(selected)}>
                    View conversations
                  </Button>
                </SpaceBetween>
              </Box>
            }
          >
            <KeyValuePairs
              columns={2}
              items={[
                { label: 'Name', value: selected.name },
                { label: 'Path on the server', value: selected.path },
                { label: 'Account', value: selected.account.emailAddress },
                { label: 'AI sorting', value: MODE_LABEL[selected.rule?.mode ?? 'off'] },
                {
                  label: 'Conversations',
                  value: `${selected.total.toLocaleString()} (${selected.unread.toLocaleString()} unread)`,
                },
                {
                  label: 'Shown',
                  value:
                    [
                      !hidden.has(labelKey(selected.account.id, selected.path)) && 'In the sidebar',
                      !chipsHidden.has(labelKey(selected.account.id, selected.path)) && 'On mail',
                    ]
                      .filter(Boolean)
                      .join(', ') || 'Nowhere',
                },
              ]}
            />
            <Box margin={{ top: 'l' }}>
              <KeyValuePairs
                items={[
                  {
                    label: 'Description for AI',
                    value: selected.rule?.description || '—',
                  },
                ]}
              />
            </Box>
          </Modal>
        )}
        {editing && editing.mode !== 'details' && (
          <LabelModal
            editing={editing}
            accounts={accounts}
            rule={editing.mode === 'create' ? undefined : ruleOf(editing.account.id, editing.path)}
            onClose={() => setEditing(null)}
          />
        )}
      </SpaceBetween>
    </div>
  );
}

function LabelModal({
  editing,
  accounts,
  rule,
  onClose,
}: {
  editing: Editing;
  accounts: Account[];
  rule: LabelRule | undefined;
  onClose: () => void;
}) {
  const flash = useFlash();
  const { api } = useAuth();
  const saveRule = useSaveLabelRule();
  const [description, setDescription] = useState(rule?.description ?? '');
  const [aiMode, setAiMode] = useState<AiMode>(
    rule?.mode ?? (editing.mode === 'create' ? 'suggest' : 'off'),
  );
  const [accountId, setAccountId] = useState(
    editing.mode === 'create' ? (accounts[0]?.id ?? '') : editing.account.id,
  );
  const [name, setName] = useState(editing.mode === 'edit' ? editing.name : '');
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState<unknown>(null);
  const change = useLabelChange(accountId);
  const account = accounts.find((item) => item.id === accountId);
  const trimmed = name.trim();
  const describedEnough = aiMode === 'off' || description.trim().length >= 10;

  const run = async () => {
    setWorking(true);
    setProblem(null);
    try {
      if (editing.mode === 'delete') {
        await change.mutateAsync({ type: 'delete', path: editing.path });
        await aiApi.removeRule(api, accountId, editing.path).catch(() => {});
        flash({ type: 'success', content: `Label "${editing.name}" deleted.` });
        onClose();
        return;
      }
      let path = editing.mode === 'edit' ? editing.path : trimmed;
      if (editing.mode === 'create') {
        await change.mutateAsync({ type: 'create', name: trimmed });
      } else if (trimmed !== editing.name) {
        await change.mutateAsync({ type: 'rename', path: editing.path, name: trimmed });
        // The label's AI settings follow it on the server.
        await aiApi
          .moveRule(api, { accountId, from: editing.path, to: trimmed, name: trimmed })
          .catch(() => {});
        path = trimmed;
      }
      // A manual label without a description needs no AI settings at all.
      if (rule || aiMode !== 'off' || description.trim()) {
        await saveRule.mutateAsync({
          accountId,
          path,
          name: trimmed,
          description: description.trim(),
          mode: aiMode,
        });
      }
      flash({
        type: 'success',
        content:
          editing.mode === 'create' ? `Label "${trimmed}" created.` : `Label "${trimmed}" saved.`,
      });
      onClose();
    } catch (error) {
      setProblem(error);
    } finally {
      setWorking(false);
    }
  };

  const title =
    editing.mode === 'create'
      ? 'Create label'
      : editing.mode === 'edit'
        ? `Edit "${editing.name}"`
        : 'Delete label';
  return (
    <Modal
      visible
      onDismiss={onClose}
      header={title}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={working}
              disabled={editing.mode !== 'delete' && (!trimmed || !describedEnough)}
              onClick={() => void run()}
            >
              {editing.mode === 'create' ? 'Create' : editing.mode === 'edit' ? 'Save' : 'Delete'}
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="m">
        {editing.mode === 'delete' ? (
          <Box variant="p">
            Delete the label <b>{editing.name}</b>?{' '}
            {account?.provider === 'GMAIL'
              ? 'The conversations in it stay in your mailbox.'
              : 'This provider deletes a folder’s mail with it, so only empty folders can be deleted.'}
          </Box>
        ) : (
          <>
            {editing.mode === 'create' && accounts.length > 1 && (
              <FormField label="Account">
                <Select
                  selectedOption={
                    account ? { value: account.id, label: account.emailAddress } : null
                  }
                  options={accounts.map((item) => ({ value: item.id, label: item.emailAddress }))}
                  onChange={({ detail }) => setAccountId(detail.selectedOption.value ?? '')}
                />
              </FormField>
            )}
            <FormField label="Name" description='Use "/" to nest, for example Work/Clients.'>
              <Input
                value={name}
                autoFocus
                ariaLabel="Label name"
                onChange={({ detail }) => setName(detail.value)}
              />
            </FormField>
            <FormField
              label="AI sorting"
              description="What AI does with mail that fits this label."
            >
              <Select
                selectedOption={MODE_OPTIONS.find((option) => option.value === aiMode) ?? null}
                options={MODE_OPTIONS}
                ariaLabel="AI sorting"
                onChange={({ detail }) =>
                  setAiMode((detail.selectedOption.value ?? 'off') as AiMode)
                }
              />
            </FormField>
            <FormField
              label="Description"
              description="Tell AI what belongs here, like you would tell a colleague. It reads this to decide which emails get the label."
              constraintText={
                aiMode === 'off' ? 'Optional while AI is off.' : 'At least 10 characters.'
              }
            >
              <Textarea
                value={description}
                rows={4}
                ariaLabel="Description"
                placeholder="e.g. Prospects asking about pricing, a demo or buying"
                onChange={({ detail }) => setDescription(detail.value)}
              />
            </FormField>
          </>
        )}
        {problem !== null && (
          <Alert type="error" header="That did not work">
            {describeError(problem)}
          </Alert>
        )}
      </SpaceBetween>
    </Modal>
  );
}
