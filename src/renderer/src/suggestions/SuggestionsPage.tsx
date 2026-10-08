import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ButtonDropdown from '@cloudscape-design/components/button-dropdown';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import Icon from '@cloudscape-design/components/icon';
import Link from '@cloudscape-design/components/link';
import Modal from '@cloudscape-design/components/modal';
import Pagination from '@cloudscape-design/components/pagination';
import Popover from '@cloudscape-design/components/popover';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator, {
  type StatusIndicatorProps,
} from '@cloudscape-design/components/status-indicator';
import Table, { type TableProps } from '@cloudscape-design/components/table';
import Tabs from '@cloudscape-design/components/tabs';
import TextFilter from '@cloudscape-design/components/text-filter';
import * as tokens from '@cloudscape-design/design-tokens';
import { useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router';
import { ProviderLogo } from '../accounts/ProviderLogo';
import {
  useResolveSuggestion,
  useSuggestions,
  type LabelResult,
  type Suggestion,
  type SuggestionView,
} from '../api/ai';
import { useAccountFolders, useThreadsById } from '../api/mail-queries';
import { useAccounts } from '../api/queries';
import { describeError } from '../auth/errors';
import mailStyles from '../mail/MailboxPage.module.css';
import { formatFullDate, formatUtc } from '../mail/format';
import { FlashProvider, useFlash } from '../settings/flash';
import { useUiVersion } from '../theme/UiVersionProvider';
import tableStyles from '../ui/DataTable.module.css';
import { LoadError } from '../ui/LoadError';
import styles from './SuggestionsPage.module.css';

// Cloudscape tokens resolve to CSS variables, so the pills follow light and dark mode.
const PILL_VARS = {
  '--pill-color': tokens.colorTextButtonNormalDefault,
  '--pill-hover': tokens.colorBackgroundButtonNormalHover,
  '--pill-primary-bg': tokens.colorBackgroundButtonPrimaryDefault,
  '--pill-primary-text': tokens.colorTextButtonPrimaryDefault,
  '--muted': tokens.colorTextBodySecondary,
} as CSSProperties;

const TAB_LABEL: Record<SuggestionView, string> = { waiting: 'Active', past: 'History' };

const OUTCOME: Record<
  Exclude<LabelResult['status'], 'pending'>,
  { type: StatusIndicatorProps.Type; text: string }
> = {
  applied: { type: 'success', text: 'Applied by AI' },
  accepted: { type: 'success', text: 'Accepted' },
  rejected: { type: 'stopped', text: 'Declined' },
  assigned: { type: 'info', text: 'Filed by you' },
  discarded: { type: 'stopped', text: 'Discarded' },
};

// "Priya <priya@acme.example>" reads as Priya.
const senderName = (from: string) =>
  from.replace(/\s*<[^>]*>\s*$/, '').replace(/^"|"$/g, '') || from;

// One row per label AI picked; an email with two picks has two rows.
interface Row {
  key: string;
  suggestion: Suggestion;
  result: LabelResult;
}

// Every change asks first, so a stray click never labels mail.
type Confirming =
  | { kind: 'accept' | 'decline' | 'discard'; rows: Row[] }
  | { kind: 'move'; rows: Row[]; path: string; name: string };

const subjectOf = (row: Row) => row.suggestion.subject || '(no subject)';
const emailsIn = (rows: Row[]) => [...new Set(rows.map((row) => row.suggestion.messageId))];
const describe = (rows: Row[]) => {
  const emails = emailsIn(rows).length;
  return rows.length === 1
    ? `“${rows[0]!.result.name}” for “${subjectOf(rows[0]!)}”`
    : `${rows.length} suggestions on ${emails} ${emails === 1 ? 'email' : 'emails'}`;
};
const TITLE = {
  accept: ['Accept suggestion?', 'Accept'],
  decline: ['Decline suggestion?', 'Decline'],
  discard: ['Discard suggestions?', 'Discard'],
  move: ['Move to another label?', 'Move'],
} as const;

function confirmText(action: Confirming) {
  const what = describe(action.rows);
  const emails = emailsIn(action.rows);
  switch (action.kind) {
    case 'accept':
      return `Label ${what}? The label is added to the email.`;
    case 'decline':
      return `Decline ${what}? The email stays as it is, and AI learns from your choice.`;
    case 'discard':
      return `Discard ${what}? Nothing is labelled and AI learns nothing from it.`;
    case 'move':
      return `File ${emails.length === 1 ? `“${subjectOf(action.rows[0]!)}”` : `${emails.length} emails`} under “${action.name}” instead? Its other suggestions are declined.`;
  }
}

function SuggestionsTable() {
  const navigate = useNavigate();
  const flash = useFlash();
  const { version } = useUiVersion();
  const [view, setView] = useState<SuggestionView>('waiting');
  const [page, setPage] = useState(1);
  const query = useSuggestions(page, view);
  const resolve = useResolveSuggestion();
  const [selected, setSelected] = useState<Row[]>([]);
  const [confirming, setConfirming] = useState<Confirming | null>(null);
  const [search, setSearch] = useState('');
  const accounts = useAccounts().data ?? [];
  const folderQueries = useAccountFolders(accounts.map((account) => account.id));
  const accountOf = (id: string) => accounts.find((account) => account.id === id);
  const labelsOf = (accountId: string) =>
    (folderQueries[accounts.findIndex((a) => a.id === accountId)]?.data?.items ?? []).filter(
      (folder) => folder.role === 'label',
    );
  const waiting = view === 'waiting';
  const full = version === 'v2';
  const switchTo = (next: SuggestionView) => {
    setView(next);
    setPage(1);
    setSelected([]);
  };

  const rows = useMemo<Row[]>(
    () =>
      (query.data?.items ?? []).flatMap((suggestion) =>
        suggestion.results
          .filter((result) => (result.status === 'pending') === (view === 'waiting'))
          .map((result) => ({ key: `${suggestion.messageId}:${result.path}`, suggestion, result })),
      ),
    [query.data, view],
  );
  const needle = search.trim().toLowerCase();
  const shown = needle
    ? rows.filter((row) =>
        [
          row.suggestion.subject,
          row.suggestion.from,
          row.result.name,
          accountOf(row.suggestion.accountId)?.emailAddress ?? '',
        ]
          .join(' ')
          .toLowerCase()
          .includes(needle),
      )
    : rows;
  // The mail itself, for the snippet after each subject; AI keeps none of it.
  const threads = useThreadsById(rows.map((row) => row.suggestion.threadId));
  const snippetOf = (threadId: string) =>
    threads.data?.items?.find((thread) => thread.id === threadId)?.snippet ?? '';

  const run = (action: Confirming) => {
    const fail = (error: unknown) => flash({ type: 'error', content: describeError(error) });
    if (action.kind === 'accept' || action.kind === 'decline') {
      for (const row of action.rows) {
        resolve.mutate(
          {
            type: 'decide',
            messageId: row.suggestion.messageId,
            path: row.result.path,
            accept: action.kind === 'accept',
          },
          { onError: fail },
        );
      }
    } else {
      for (const messageId of emailsIn(action.rows)) {
        resolve.mutate(
          action.kind === 'move'
            ? { type: 'assign', messageId, path: action.path, name: action.name }
            : { type: 'discard', messageId },
          { onError: fail },
        );
      }
    }
    const what = describe(action.rows);
    flash({
      type: 'success',
      content:
        action.kind === 'move'
          ? `Moved ${what} to “${action.name}”.`
          : `${TITLE[action.kind][1].replace(/e?$/, 'ed')} ${what}.`,
    });
    setSelected([]);
    setConfirming(null);
  };

  // Another label only makes sense within one account.
  const moveOptions = (() => {
    const accountIds = new Set(selected.map((row) => row.suggestion.accountId));
    if (accountIds.size !== 1) return [];
    const suggested = new Set(selected.map((row) => row.result.path));
    return labelsOf([...accountIds][0]!).filter((label) => !suggested.has(label.path));
  })();
  const open = (row: Row) =>
    `/accounts/${row.suggestion.accountId}/inbox/${row.suggestion.threadId}`;

  // Sized like the inbox's columns; a narrow window scrolls the table sideways.
  const columns: TableProps.ColumnDefinition<Row>[] = [
    {
      id: 'account',
      header: 'Account',
      width: 220,
      cell: ({ suggestion }) => {
        const account = accountOf(suggestion.accountId);
        return account ? (
          <span className={styles.account} title={account.emailAddress}>
            <ProviderLogo provider={account.provider} size={16} />
            <span className={styles.clip}>{account.emailAddress}</span>
          </span>
        ) : (
          '—'
        );
      },
    },
    {
      id: 'from',
      header: 'From',
      width: 200,
      cell: ({ suggestion }) => (
        <span className={styles.clip} title={suggestion.from}>
          {senderName(suggestion.from)}
        </span>
      ),
    },
    {
      id: 'subject',
      header: 'Subject',
      width: 440,
      cell: (row) => {
        const snippet = snippetOf(row.suggestion.threadId);
        return (
          <span className={styles.clip} title={row.suggestion.subject}>
            <Link
              href={open(row)}
              onFollow={(event) => {
                event.preventDefault();
                void navigate(open(row));
              }}
            >
              {subjectOf(row)}
            </Link>
            {snippet && <span className={styles.snippet}> – {snippet}</span>}
          </span>
        );
      },
    },
    {
      id: 'label',
      header: waiting ? 'Suggested label' : 'Label',
      width: 200,
      cell: ({ result }) => (
        <span className={styles.label}>
          <span className={styles.clip}>{result.name}</span>
          <Popover
            size="medium"
            renderWithPortal
            header={`Why “${result.name}”?`}
            content={result.reason}
          >
            <span className={styles.info} aria-label={`Why ${result.name}`}>
              <Icon name="status-info" size="small" />
            </span>
          </Popover>
        </span>
      ),
    },
    {
      id: 'confidence',
      header: 'Confidence',
      width: 120,
      cell: ({ result }) => result.confidence.toFixed(2),
    },
  ];
  if (!waiting) {
    columns.push({
      id: 'outcome',
      header: 'Outcome',
      width: 150,
      cell: ({ result }) => {
        const outcome = OUTCOME[result.status as keyof typeof OUTCOME];
        return outcome ? (
          <StatusIndicator type={outcome.type}>{outcome.text}</StatusIndicator>
        ) : null;
      },
    });
  }
  columns.push({
    id: 'received',
    header: 'Received (UTC)',
    width: 190,
    // Like the inbox, the row's actions take the date's place while it is hovered.
    cell: (row) => (
      <span className={styles.received}>
        <span className={styles.time} title={formatFullDate(row.suggestion.receivedAt)}>
          {formatUtc(row.suggestion.receivedAt).replace(' UTC', '')}
        </span>
        {waiting && (
          <span className={styles.quick}>
            <button
              type="button"
              className={styles.pill}
              aria-label={`Decline ${row.result.name} for ${subjectOf(row)}`}
              onClick={() => setConfirming({ kind: 'decline', rows: [row] })}
            >
              Decline
            </button>
            <button
              type="button"
              className={`${styles.pill} ${styles.primary}`}
              aria-label={`Accept ${row.result.name} for ${subjectOf(row)}`}
              onClick={() => setConfirming({ kind: 'accept', rows: [row] })}
            >
              Accept
            </button>
          </span>
        )}
      </span>
    ),
  });

  const tabs = (
    <div className={styles.filters}>
      <TextFilter
        filteringText={search}
        filteringPlaceholder="Search by subject, sender, label or account"
        filteringAriaLabel="Search suggestions"
        onChange={({ detail }) => setSearch(detail.filteringText)}
      />
      {full ? (
        <Tabs
          activeTabId={view}
          onChange={({ detail }) => switchTo(detail.activeTabId as SuggestionView)}
          tabs={(['waiting', 'past'] as const).map((id) => ({ id, label: TAB_LABEL[id] }))}
        />
      ) : (
        <div className={mailStyles.tabs} role="tablist" aria-label="Suggestions">
          {(['waiting', 'past'] as const).map((id) => (
            <button
              key={id}
              role="tab"
              aria-selected={view === id}
              className={mailStyles.tab}
              onClick={() => switchTo(id)}
            >
              {TAB_LABEL[id]}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const none = selected.length === 0;
  return (
    <div className={`${tableStyles.table} ${tableStyles.fixed}`} style={PILL_VARS}>
      <Table
        variant={full ? 'full-page' : 'container'}
        stickyHeader={full}
        trackBy="key"
        items={shown}
        wrapLines={false}
        filter={tabs}
        loading={query.isPending}
        loadingText="Loading suggestions"
        selectionType={waiting ? 'multi' : undefined}
        selectedItems={selected}
        onSelectionChange={({ detail }) => setSelected(detail.selectedItems)}
        ariaLabels={{
          selectionGroupLabel: 'Suggestion selection',
          allItemsSelectionLabel: () => 'Select all suggestions',
          itemSelectionLabel: (_, row) => `Select ${row.result.name} for ${subjectOf(row)}`,
          tableLabel: 'Suggestions',
        }}
        header={
          <Header
            variant={full ? 'awsui-h1-sticky' : 'h1'}
            counter={query.data ? `(${waiting ? rows.length : query.data.total})` : undefined}
            description={
              waiting
                ? 'Labels AI thinks fit, for labels set to “AI suggests it”. Hover a label to see why.'
                : 'What happened to earlier suggestions, and what AI labelled on its own.'
            }
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  iconName="refresh"
                  ariaLabel="Refresh"
                  onClick={() => void query.refetch()}
                />
                {waiting && (
                  <Button
                    disabled={none}
                    onClick={() => setConfirming({ kind: 'discard', rows: selected })}
                  >
                    Discard
                  </Button>
                )}
                {waiting && (
                  <ButtonDropdown
                    expandToViewport
                    disabled={moveOptions.length === 0}
                    items={moveOptions.map((label) => ({ id: label.path, text: label.name }))}
                    onItemClick={({ detail }) => {
                      const label = moveOptions.find((item) => item.path === detail.id);
                      if (label) {
                        setConfirming({
                          kind: 'move',
                          rows: selected,
                          path: label.path,
                          name: label.name,
                        });
                      }
                    }}
                  >
                    Move to label
                  </ButtonDropdown>
                )}
                {waiting && (
                  <Button
                    disabled={none}
                    onClick={() => setConfirming({ kind: 'decline', rows: selected })}
                  >
                    Decline
                  </Button>
                )}
                {waiting && (
                  <Button
                    variant="primary"
                    disabled={none}
                    onClick={() => setConfirming({ kind: 'accept', rows: selected })}
                  >
                    Accept
                  </Button>
                )}
              </SpaceBetween>
            }
          >
            Suggestions
          </Header>
        }
        empty={
          query.isError ? (
            <LoadError
              error={query.error}
              header="Suggestions could not be loaded"
              onRetry={() => void query.refetch()}
            />
          ) : (
            <Box textAlign="center" color="inherit">
              <SpaceBetween size="xxs">
                <b>{waiting ? 'Nothing waiting' : 'No past suggestions yet'}</b>
                <Box variant="p" color="inherit">
                  {waiting
                    ? 'New suggestions appear here as mail arrives. Set a label to “AI suggests it” in Settings → Labels.'
                    : 'Suggestions you accept, decline or move show up here.'}
                </Box>
              </SpaceBetween>
            </Box>
          )
        }
        pagination={
          <Pagination
            currentPageIndex={page}
            pagesCount={Math.max(
              1,
              Math.ceil((query.data?.total ?? 0) / (query.data?.pageSize ?? 50)),
            )}
            onChange={({ detail }) => setPage(detail.currentPageIndex)}
          />
        }
        columnDefinitions={columns}
      />
      {confirming && (
        <Modal
          visible
          onDismiss={() => setConfirming(null)}
          header={TITLE[confirming.kind][0]}
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => setConfirming(null)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={() => run(confirming)}>
                  {TITLE[confirming.kind][1]}
                </Button>
              </SpaceBetween>
            </Box>
          }
        >
          {confirmText(confirming)}
        </Modal>
      )}
    </div>
  );
}

export function SuggestionsPage() {
  const { version } = useUiVersion();
  const page = (
    <FlashProvider>
      <SuggestionsTable />
    </FlashProvider>
  );
  // The console (v2) lays the page out itself; the classic look puts it on a panel.
  return version === 'v2' ? (
    <ContentLayout>{page}</ContentLayout>
  ) : (
    <div className={styles.panel}>{page}</div>
  );
}

export default SuggestionsPage;
