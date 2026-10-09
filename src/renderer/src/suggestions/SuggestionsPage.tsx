import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ButtonDropdown from '@cloudscape-design/components/button-dropdown';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
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
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { ProviderLogo } from '../accounts/ProviderLogo';
import type { Account } from '../api/accounts';
import type { FolderCounts } from '../api/mail';
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
import { INBOX_FIXED_COLUMNS, useWidth } from '../console/ConsoleMailbox';
import { formatFullDate, formatListDate, formatUtc } from '../mail/format';
import rowStyles from '../mail/ThreadRow.module.css';
import { Dialog } from '../ui/Dialog';
import { Icon as GmailIcon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { Menu } from '../ui/Menu';
import { FlashProvider, useFlash } from '../settings/flash';
import { useUiVersion } from '../theme/UiVersionProvider';
import tableStyles from '../ui/DataTable.module.css';
import { LoadError } from '../ui/LoadError';
import styles from './SuggestionsPage.module.css';

// Cloudscape tokens resolve to CSS variables, so the pills follow light and dark mode.
const PILL_VARS = {
  '--pill-color': tokens.colorTextButtonNormalDefault,
  '--pill-hover': tokens.colorBackgroundButtonNormalHover,
  '--link': tokens.colorTextLinkDefault,
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
  discarded: { type: 'stopped', text: 'Deleted' },
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
  discard: ['Delete suggestions?', 'Delete'],
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
      return `Delete ${what}? Nothing is labelled and AI learns nothing from it.`;
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
  const [tableRef, tableWidth] = useWidth<HTMLDivElement>();
  // The same width the inbox gives Subject in this window; the extra columns scroll sideways.
  const subjectWidth = Number.isFinite(tableWidth)
    ? Math.max(320, Math.round(tableWidth - INBOX_FIXED_COLUMNS))
    : 440;
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
      width: subjectWidth,
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
      width: 180,
      cell: ({ result }) => (
        <span className={styles.clip}>
          <Popover
            size="medium"
            renderWithPortal
            dismissButton={false}
            header={`Why “${result.name}”?`}
            content={result.reason}
          >
            {result.name}
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
    width: 170,
    cell: (row) => (
      <span title={formatFullDate(row.suggestion.receivedAt)}>
        {formatUtc(row.suggestion.receivedAt).replace(' UTC', '')}
      </span>
    ),
  });
  if (waiting) {
    columns.push({
      id: 'actions',
      header: 'Actions',
      width: 180,
      cell: (row) => {
        const others = labelsOf(row.suggestion.accountId).filter(
          (label) => label.path !== row.result.path,
        );
        return (
          <span className={styles.actions}>
            <WhyPopover result={row.result}>
              <button type="button" className={styles.mark} aria-label={`Why ${row.result.name}`}>
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <circle cx="8" cy="8" r="6.5" />
                  <path d="M8 7.5v4M8 4.75v.01" />
                </svg>
              </button>
            </WhyPopover>
            <button
              type="button"
              className={styles.mark}
              title="Accept"
              aria-label={`Accept ${row.result.name} for ${subjectOf(row)}`}
              onClick={() => setConfirming({ kind: 'accept', rows: [row] })}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M2.5 8.5l3.5 3.5 7.5-8" />
              </svg>
            </button>
            <button
              type="button"
              className={styles.mark}
              title="Decline"
              aria-label={`Decline ${row.result.name} for ${subjectOf(row)}`}
              onClick={() => setConfirming({ kind: 'decline', rows: [row] })}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
              </svg>
            </button>
            <ButtonDropdown
              variant="icon"
              expandToViewport
              ariaLabel={`More actions for ${subjectOf(row)}`}
              items={[
                {
                  id: 'move',
                  text: 'Move to label',
                  disabled: others.length === 0,
                  items: others.map((label) => ({ id: `move:${label.path}`, text: label.name })),
                },
                { id: 'delete', text: 'Delete' },
              ]}
              onItemClick={({ detail }) => {
                if (detail.id === 'delete') {
                  setConfirming({ kind: 'discard', rows: [row] });
                  return;
                }
                const label = others.find((item) => `move:${item.path}` === detail.id);
                if (label) {
                  setConfirming({ kind: 'move', rows: [row], path: label.path, name: label.name });
                }
              }}
            />
          </span>
        );
      },
    });
  }

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
  if (!full) {
    return (
      <>
        <GmailSuggestions
          rows={shown}
          waiting={waiting}
          view={view}
          onView={switchTo}
          search={search}
          onSearch={setSearch}
          selected={selected}
          onSelect={setSelected}
          loading={query.isPending}
          error={query.isError ? query.error : null}
          onRefresh={() => void query.refetch()}
          snippetOf={snippetOf}
          accountOf={accountOf}
          moveOptions={moveOptions}
          onOpen={(row) => void navigate(open(row))}
          onConfirm={setConfirming}
        />
        {confirming && (
          <Dialog
            title={TITLE[confirming.kind][0]}
            confirmLabel={TITLE[confirming.kind][1]}
            onConfirm={() => run(confirming)}
            onCancel={() => setConfirming(null)}
          >
            {confirmText(confirming)}
          </Dialog>
        )}
      </>
    );
  }
  return (
    <div ref={tableRef} className={`${tableStyles.table} ${tableStyles.fixed}`} style={PILL_VARS}>
      <Table
        variant={full ? 'full-page' : 'container'}
        stickyHeader={full}
        trackBy="key"
        items={shown}
        wrapLines={false}
        filter={tabs}
        stickyColumns={{ first: 0, last: 1 }}
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
                    Delete
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
  // The console (v2) lays the page out itself; the classic look is Gmail's list panel.
  return version === 'v2' ? <ContentLayout>{page}</ContentLayout> : page;
}

export default SuggestionsPage;

// v1: Gmail's list, the same rows as the inbox. Actions show while a row is hovered.
function GmailSuggestions({
  rows,
  waiting,
  view,
  onView,
  search,
  onSearch,
  selected,
  onSelect,
  loading,
  error,
  onRefresh,
  snippetOf,
  accountOf,
  moveOptions,
  onOpen,
  onConfirm,
}: {
  rows: Row[];
  waiting: boolean;
  view: SuggestionView;
  onView: (view: SuggestionView) => void;
  search: string;
  onSearch: (text: string) => void;
  selected: Row[];
  onSelect: (rows: Row[]) => void;
  loading: boolean;
  error: unknown;
  onRefresh: () => void;
  snippetOf: (threadId: string) => string;
  accountOf: (id: string) => Account | undefined;
  moveOptions: FolderCounts[];
  onOpen: (row: Row) => void;
  onConfirm: (action: Confirming) => void;
}) {
  const keys = new Set(selected.map((row) => row.key));
  const all = rows.length > 0 && rows.every((row) => keys.has(row.key));
  const toggle = (row: Row) =>
    onSelect(
      keys.has(row.key) ? selected.filter((item) => item.key !== row.key) : [...selected, row],
    );
  const stop = (handler: () => void) => (event: React.MouseEvent) => {
    event.stopPropagation();
    handler();
  };

  return (
    <section className={mailStyles.panel} aria-label="Suggestions">
      <div className={mailStyles.toolbar} role="toolbar" aria-label="Suggestion actions">
        {waiting && (
          <div className={mailStyles.selectAll}>
            <button
              type="button"
              role="checkbox"
              aria-checked={all ? true : selected.length > 0 ? 'mixed' : false}
              aria-label="Select all"
              data-tooltip="Select"
              className={mailStyles.selectBox}
              onClick={() => onSelect(selected.length > 0 ? [] : rows)}
            >
              <GmailIcon
                name={all ? 'checkboxChecked' : selected.length > 0 ? 'checkboxSome' : 'checkbox'}
                size={20}
              />
            </button>
          </div>
        )}
        {selected.length > 0 ? (
          <>
            <IconButton
              icon="check"
              label="Accept"
              onClick={() => onConfirm({ kind: 'accept', rows: selected })}
            />
            <IconButton
              icon="close"
              label="Decline"
              onClick={() => onConfirm({ kind: 'decline', rows: selected })}
            />
            {moveOptions.length > 0 && (
              <Menu
                label="Move to label"
                icon="move"
                heading="Move to:"
                items={moveOptions.map((label) => ({
                  key: label.path,
                  label: label.name,
                  icon: 'labelFilled' as const,
                }))}
                onSelect={(key) => {
                  const label = moveOptions.find((item) => item.path === key)!;
                  onConfirm({ kind: 'move', rows: selected, path: label.path, name: label.name });
                }}
              />
            )}
            <IconButton
              icon="delete"
              label="Delete"
              onClick={() => onConfirm({ kind: 'discard', rows: selected })}
            />
          </>
        ) : (
          <IconButton icon="refresh" label="Refresh" onClick={onRefresh} />
        )}
        <label className={styles.gmailSearch}>
          <GmailIcon name="search" size={20} />
          <input
            type="search"
            value={search}
            placeholder="Search by sender, subject or label"
            aria-label="Search suggestions"
            onChange={(event) => onSearch(event.target.value)}
          />
          {search && (
            <IconButton
              size="small"
              icon="close"
              label="Clear search"
              onClick={() => onSearch('')}
            />
          )}
        </label>
      </div>
      <div className={mailStyles.tabs} role="tablist" aria-label="Suggestions">
        {(['waiting', 'past'] as const).map((id) => (
          <button
            key={id}
            role="tab"
            aria-selected={view === id}
            className={mailStyles.tab}
            onClick={() => onView(id)}
          >
            {TAB_LABEL[id]}
          </button>
        ))}
      </div>
      <div
        className={`${mailStyles.list} ${styles.grid}`}
        data-view={view}
        role="grid"
        aria-label="Suggestions"
      >
        {/* Column headers like a cloud console table, over Gmail's rows. */}
        <div className={styles.gridHead} role="row">
          <span role="columnheader" />
          <span role="columnheader">From</span>
          <span role="columnheader">Subject</span>
          <span role="columnheader">{waiting ? 'Suggested label' : 'Label'}</span>
          <span role="columnheader">Confidence</span>
          {!waiting && <span role="columnheader">Outcome</span>}
          <span role="columnheader" className={styles.alignEnd}>
            Received
          </span>
        </div>
        {loading && <p className={mailStyles.status}>Loading…</p>}
        {error !== null && <p className={mailStyles.status}>{describeError(error)}</p>}
        {!loading && error === null && rows.length === 0 && (
          <p className={mailStyles.status}>
            {waiting
              ? 'Nothing waiting. New suggestions appear here as mail arrives.'
              : 'No past suggestions yet.'}
          </p>
        )}
        {rows.map((row) => {
          const account = accountOf(row.suggestion.accountId);
          const isSelected = keys.has(row.key);
          const snippet = snippetOf(row.suggestion.threadId);
          const outcome = OUTCOME[row.result.status as keyof typeof OUTCOME];
          return (
            <div
              key={row.key}
              role="row"
              tabIndex={0}
              aria-selected={isSelected}
              aria-label={`${senderName(row.suggestion.from)}, ${subjectOf(row)}, ${row.result.name}`}
              className={`${rowStyles.row} ${rowStyles.read} ${styles.gridRow} ${isSelected ? rowStyles.selected : ''}`}
              onClick={() => onOpen(row)}
              onKeyDown={(event) =>
                event.key === 'Enter' && event.target === event.currentTarget && onOpen(row)
              }
            >
              {waiting ? (
                <button
                  type="button"
                  className={rowStyles.check}
                  role="checkbox"
                  aria-checked={isSelected}
                  aria-label="Select suggestion"
                  data-tooltip="Select"
                  onClick={stop(() => toggle(row))}
                >
                  <GmailIcon name={isSelected ? 'checkboxChecked' : 'checkbox'} size={20} />
                </button>
              ) : (
                <span className={rowStyles.star}>
                  <GmailIcon name="sparkle" size={18} />
                </span>
              )}
              <span className={rowStyles.sender}>
                {account && (
                  <span className={rowStyles.chip} data-tooltip={account.emailAddress}>
                    <ProviderLogo provider={account.provider} size={14} />
                  </span>
                )}
                <span className={rowStyles.senderName}>{senderName(row.suggestion.from)}</span>
              </span>
              <span className={rowStyles.summary}>
                <span className={rowStyles.subject}>{subjectOf(row)}</span>
                {snippet && <span className={rowStyles.snippet}> - {snippet}</span>}
              </span>
              <span className={styles.cell}>
                <span className={rowStyles.label}>{row.result.name}</span>
              </span>
              <span className={styles.cell}>{row.result.confidence.toFixed(2)}</span>
              {!waiting && <span className={styles.cell}>{outcome?.text ?? ''}</span>}
              <span className={rowStyles.end}>
                <span
                  className={rowStyles.date}
                  data-tooltip={formatFullDate(row.suggestion.receivedAt)}
                >
                  {formatListDate(row.suggestion.receivedAt)}
                </span>
                {waiting && (
                  <span className={`${rowStyles.hoverActions} ${styles.overlay}`}>
                    <span onClick={stop(() => {})}>
                      <WhyPopover result={row.result}>
                        <IconButton size="small" icon="info" label={`Why ${row.result.name}`} />
                      </WhyPopover>
                    </span>
                    <IconButton
                      size="small"
                      icon="check"
                      label={`Accept ${row.result.name}`}
                      tooltip="Accept"
                      onClick={stop(() => onConfirm({ kind: 'accept', rows: [row] }))}
                    />
                    <IconButton
                      size="small"
                      icon="close"
                      label={`Decline ${row.result.name}`}
                      tooltip="Decline"
                      onClick={stop(() => onConfirm({ kind: 'decline', rows: [row] }))}
                    />
                    <IconButton
                      size="small"
                      icon="delete"
                      label={`Delete suggestion for ${subjectOf(row)}`}
                      tooltip="Delete"
                      onClick={stop(() => onConfirm({ kind: 'discard', rows: [row] }))}
                    />
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// The model's reasoning in an overlay, the same in both interfaces.
function WhyPopover({ result, children }: { result: LabelResult; children: ReactNode }) {
  return (
    <Popover
      size="medium"
      position="left"
      renderWithPortal
      dismissButton={false}
      triggerType="custom"
      header={`Why “${result.name}”? · ${result.confidence.toFixed(2)}`}
      content={result.reason}
    >
      {children}
    </Popover>
  );
}
