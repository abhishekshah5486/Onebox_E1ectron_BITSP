import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ButtonDropdown from '@cloudscape-design/components/button-dropdown';
import Container from '@cloudscape-design/components/container';
import FormField from '@cloudscape-design/components/form-field';
import Header from '@cloudscape-design/components/header';
import Input from '@cloudscape-design/components/input';
import Modal from '@cloudscape-design/components/modal';
import Select from '@cloudscape-design/components/select';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Textarea from '@cloudscape-design/components/textarea';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Table from '@cloudscape-design/components/table';
import Toggle from '@cloudscape-design/components/toggle';
import { useState } from 'react';
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
  MAIL_CATEGORIES,
  MAIL_CATEGORY_LABEL,
  type FolderRole,
} from '../mail/folders';
import { useFlash } from './flash';
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
const TABS = ['promotions', 'social', 'updates', 'forums'];

type Editing =
  | { mode: 'create' }
  | { mode: 'describe'; account: Account; path: string; name: string }
  | { mode: 'rename'; account: Account; path: string; name: string }
  | { mode: 'delete'; account: Account; path: string; name: string };

// Folders, categories and labels: what shows in the sidebar and message list, and the labels
// themselves, which are created, renamed and deleted on the mail server.
export function LabelsSection() {
  const accounts = useAccounts().data ?? [];
  const folderQueries = useAccountFolders(accounts.map((account) => account.id));
  const preferences = usePreferences();
  const update = useUpdatePreferences();
  const flash = useFlash();
  const [editing, setEditing] = useState<Editing | null>(null);
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
      .map((folder) => ({ account, ...folder })),
  );

  return (
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
          <Header variant="h2" description="Inbox is always shown.">
            Folders
          </Header>
        }
      >
        <Table
          variant="embedded"
          ariaLabels={{ tableLabel: 'Folders' }}
          loading={preferences.isPending}
          loadingText="Loading"
          items={FOLDERS.map((role) => ({ role }))}
          columnDefinitions={[
            {
              id: 'name',
              header: 'Folder',
              cell: ({ role }) =>
                role === 'archive' ? folderName(role, archiveName) : FOLDER_LABEL[role],
            },
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
          items={MAIL_CATEGORIES.map((category) => ({ category }))}
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

      <Container
        header={
          <Header
            variant="h2"
            counter={`(${labels.length})`}
            description="Your own labels, kept on the mail server. On providers other than Gmail they are folders."
            actions={
              <Button
                iconName="add-plus"
                disabled={accounts.length === 0}
                onClick={() => setEditing({ mode: 'create' })}
              >
                Create label
              </Button>
            }
          >
            Labels
          </Header>
        }
      >
        <Table
          variant="embedded"
          ariaLabels={{ tableLabel: 'Labels' }}
          items={labels}
          trackBy={(item) => `${item.account.id}:${item.path}`}
          empty={
            <Box textAlign="center" color="inherit">
              <b>No labels yet</b>
              <Box variant="p" color="inherit">
                Create one to file conversations your way.
              </Box>
            </Box>
          }
          columnDefinitions={[
            { id: 'name', header: 'Label', cell: (item) => item.name },
            {
              id: 'ai',
              header: 'AI sorting',
              cell: (item) => {
                const rule = ruleOf(item.account.id, item.path);
                return rule && rule.mode !== 'off' ? (
                  <SpaceBetween size="xxxs">
                    <StatusIndicator type={rule.mode === 'auto' ? 'success' : 'info'}>
                      {MODE_LABEL[rule.mode]}
                    </StatusIndicator>
                    <Box variant="small" color="text-body-secondary">
                      {rule.description.length > 80
                        ? `${rule.description.slice(0, 80)}…`
                        : rule.description}
                    </Box>
                  </SpaceBetween>
                ) : (
                  <Button
                    variant="inline-link"
                    onClick={() =>
                      setEditing({
                        mode: 'describe',
                        account: item.account,
                        path: item.path,
                        name: item.name,
                      })
                    }
                  >
                    Describe for AI
                  </Button>
                );
              },
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
              cell: (item) =>
                `${item.total.toLocaleString()}${item.unread ? ` (${item.unread.toLocaleString()} unread)` : ''}`,
            },
            {
              id: 'sidebar',
              header: 'Show in sidebar',
              cell: (item) => sidebarToggle(labelKey(item.account.id, item.path), item.name),
            },
            {
              id: 'chips',
              header: 'Show on mail',
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
            {
              id: 'actions',
              header: '',
              width: 80,
              cell: (item) => (
                <ButtonDropdown
                  variant="icon"
                  ariaLabel={`Actions for ${item.name}`}
                  items={[
                    { id: 'describe', text: 'AI sorting…' },
                    { id: 'rename', text: 'Rename' },
                    { id: 'delete', text: 'Delete' },
                  ]}
                  onItemClick={({ detail }) =>
                    setEditing({
                      mode: detail.id as 'describe' | 'rename' | 'delete',
                      account: item.account,
                      path: item.path,
                      name: item.name,
                    })
                  }
                />
              ),
            },
          ]}
        />
      </Container>

      {editing && (
        <LabelModal
          editing={editing}
          accounts={accounts}
          rule={editing.mode === 'create' ? undefined : ruleOf(editing.account.id, editing.path)}
          onClose={() => setEditing(null)}
        />
      )}
    </SpaceBetween>
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
  const [aiMode, setAiMode] = useState<AiMode>(rule?.mode ?? 'suggest');
  const describing = editing.mode === 'create' || editing.mode === 'describe';
  const describedEnough = aiMode === 'off' || description.trim().length >= 10;
  const [accountId, setAccountId] = useState(
    editing.mode === 'create' ? (accounts[0]?.id ?? '') : editing.account.id,
  );
  const [name, setName] = useState(editing.mode === 'rename' ? editing.name : '');
  const change = useLabelChange(accountId);
  const account = accounts.find((item) => item.id === accountId);

  const done = (content: string) => {
    flash({ type: 'success', content });
    onClose();
  };
  const saveDescription = (path: string, labelName: string, then: () => void) =>
    saveRule.mutate(
      { accountId, path, name: labelName, description: description.trim(), mode: aiMode },
      { onSuccess: then },
    );

  const submit = () => {
    if (editing.mode === 'describe') {
      saveDescription(editing.path, editing.name, () =>
        done(`AI sorting saved for "${editing.name}".`),
      );
      return;
    }
    change.mutate(
      editing.mode === 'create'
        ? { type: 'create', name }
        : editing.mode === 'rename'
          ? { type: 'rename', path: editing.path, name }
          : { type: 'delete', path: editing.path },
      {
        onSuccess: () => {
          if (editing.mode === 'create') {
            saveDescription(name.trim(), name.trim(), () =>
              done(`Label "${name.trim()}" created.`),
            );
            return;
          }
          // The label's AI settings follow it on the server.
          const follow =
            editing.mode === 'rename'
              ? aiApi.moveRule(api, {
                  accountId,
                  from: editing.path,
                  to: name.trim(),
                  name: name.trim(),
                })
              : aiApi.removeRule(api, accountId, editing.path);
          void follow
            .catch(() => {})
            .then(() =>
              done(
                editing.mode === 'rename'
                  ? `Label renamed to "${name.trim()}".`
                  : `Label "${editing.name}" deleted.`,
              ),
            );
        },
      },
    );
  };

  const title =
    editing.mode === 'create'
      ? 'Create label'
      : editing.mode === 'describe'
        ? `AI sorting for "${editing.name}"`
        : editing.mode === 'rename'
          ? 'Rename label'
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
              loading={change.isPending || saveRule.isPending}
              disabled={
                (editing.mode === 'create' || editing.mode === 'rename' ? !name.trim() : false) ||
                (describing && !describedEnough)
              }
              onClick={submit}
            >
              {editing.mode === 'create'
                ? 'Create'
                : editing.mode === 'describe'
                  ? 'Save'
                  : editing.mode === 'rename'
                    ? 'Rename'
                    : 'Delete'}
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
            {editing.mode !== 'describe' && (
              <FormField
                label="Label name"
                description='Use "/" to nest, for example Work/Clients.'
              >
                <Input
                  value={name}
                  autoFocus
                  ariaLabel="Label name"
                  onChange={({ detail }) => setName(detail.value)}
                  onKeyDown={({ detail }) => detail.key === 'Enter' && name.trim() && submit()}
                />
              </FormField>
            )}
            {describing && (
              <>
                <FormField
                  label="Description"
                  description="Tell AI what belongs here, like you would tell a colleague. It reads this to decide which emails get the label."
                  constraintText={
                    aiMode === 'off' ? 'Optional while AI is off.' : 'At least 10 characters.'
                  }
                >
                  <Textarea
                    value={description}
                    rows={3}
                    ariaLabel="Description"
                    placeholder="e.g. Prospects asking about pricing, a demo or buying"
                    onChange={({ detail }) => setDescription(detail.value)}
                  />
                </FormField>
                <FormField label="AI sorting">
                  <Select
                    selectedOption={MODE_OPTIONS.find((option) => option.value === aiMode) ?? null}
                    options={MODE_OPTIONS}
                    ariaLabel="AI sorting"
                    onChange={({ detail }) =>
                      setAiMode((detail.selectedOption.value ?? 'off') as AiMode)
                    }
                  />
                </FormField>
              </>
            )}
          </>
        )}
        {(change.isError || saveRule.isError) && (
          <Box color="text-status-error">{describeError(change.error ?? saveRule.error)}</Box>
        )}
      </SpaceBetween>
    </Modal>
  );
}
