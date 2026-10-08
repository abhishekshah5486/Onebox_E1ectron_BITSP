import Badge from '@cloudscape-design/components/badge';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ButtonDropdown from '@cloudscape-design/components/button-dropdown';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import Link from '@cloudscape-design/components/link';
import Pagination from '@cloudscape-design/components/pagination';
import Popover from '@cloudscape-design/components/popover';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Table from '@cloudscape-design/components/table';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useResolveSuggestion, useSuggestions, type LabelResult, type Suggestion } from '../api/ai';
import { useAccountFolders } from '../api/mail-queries';
import { useAccounts } from '../api/queries';
import { describeError } from '../auth/errors';
import { formatFullDate, formatListDate } from '../mail/format';
import { FlashProvider, useFlash } from '../settings/flash';
import { useUiVersion } from '../theme/UiVersionProvider';
import styles from './SuggestionsPage.module.css';

interface Row {
  key: string;
  suggestion: Suggestion;
  result: LabelResult;
}

function SuggestionsTable() {
  const navigate = useNavigate();
  const flash = useFlash();
  const [page, setPage] = useState(1);
  const query = useSuggestions(page);
  const resolve = useResolveSuggestion();
  const [selected, setSelected] = useState<Row[]>([]);
  const accounts = useAccounts().data ?? [];
  const folderQueries = useAccountFolders(accounts.map((account) => account.id));
  const labelsOf = (accountId: string) =>
    (folderQueries[accounts.findIndex((a) => a.id === accountId)]?.data?.items ?? []).filter(
      (folder) => folder.role === 'label',
    );

  // One row per waiting suggestion; an email can have several.
  const rows = useMemo<Row[]>(
    () =>
      (query.data?.items ?? []).flatMap((suggestion) =>
        suggestion.results
          .filter((result) => result.status === 'pending')
          .map((result) => ({ key: `${suggestion.messageId}:${result.path}`, suggestion, result })),
      ),
    [query.data],
  );
  const fail = (error: unknown) => flash({ type: 'error', content: describeError(error) });
  const decide = (targets: Row[], accept: boolean) => {
    for (const row of targets) {
      resolve.mutate(
        { type: 'decide', messageId: row.suggestion.messageId, path: row.result.path, accept },
        { onError: fail },
      );
    }
    setSelected([]);
    flash({
      type: 'success',
      content: `${targets.length === 1 ? 'Suggestion' : `${targets.length} suggestions`} ${accept ? 'accepted' : 'declined'}.`,
    });
  };

  return (
    <Table
      variant="full-page"
      trackBy="key"
      items={rows}
      loading={query.isPending}
      loadingText="Loading suggestions"
      selectionType="multi"
      selectedItems={selected}
      onSelectionChange={({ detail }) => setSelected(detail.selectedItems)}
      ariaLabels={{
        selectionGroupLabel: 'Suggestion selection',
        allItemsSelectionLabel: () => 'Select all suggestions',
        itemSelectionLabel: (_, row) => `Select ${row.suggestion.subject || '(no subject)'}`,
        tableLabel: 'Suggestions',
      }}
      header={
        <Header
          variant="awsui-h1-sticky"
          counter={query.data ? `(${query.data.total})` : undefined}
          description="Labels AI thinks fit, for labels set to “AI suggests it”. Accept, decline, or choose another label."
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button iconName="refresh" ariaLabel="Refresh" onClick={() => void query.refetch()} />
              <Button disabled={selected.length === 0} onClick={() => decide(selected, false)}>
                Decline
              </Button>
              <Button
                variant="primary"
                disabled={selected.length === 0}
                onClick={() => decide(selected, true)}
              >
                Accept
              </Button>
            </SpaceBetween>
          }
        >
          Suggestions
        </Header>
      }
      empty={
        query.isError ? (
          <Box color="text-status-error">{describeError(query.error)}</Box>
        ) : (
          <Box textAlign="center" color="inherit">
            <SpaceBetween size="xxs">
              <b>Nothing waiting</b>
              <Box variant="p" color="inherit">
                New suggestions appear here as mail arrives. Set a label to “AI suggests it” in
                Settings → Labels.
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
      columnDefinitions={[
        {
          id: 'email',
          header: 'Email',
          cell: ({ suggestion }) => (
            <div className={styles.email}>
              <Link onFollow={() => void navigate(`/inbox/${suggestion.threadId}`)}>
                {suggestion.subject || '(no subject)'}
              </Link>
              <Box variant="small" color="text-body-secondary">
                {suggestion.from} · {suggestion.snippet}
              </Box>
            </div>
          ),
        },
        {
          id: 'label',
          header: 'Suggested label',
          width: 260,
          cell: ({ result }) => (
            <SpaceBetween direction="horizontal" size="xs" alignItems="center">
              <Badge color="blue">{result.name}</Badge>
              <Popover
                size="medium"
                header={`Why “${result.name}”?`}
                content={
                  <SpaceBetween size="xs">
                    <Box>{result.reason}</Box>
                    <Box variant="small" color="text-body-secondary">
                      Confidence {Math.round(result.confidence * 100)}%
                    </Box>
                  </SpaceBetween>
                }
              >
                <Box variant="small" color="text-body-secondary">
                  {Math.round(result.confidence * 100)}% · why?
                </Box>
              </Popover>
            </SpaceBetween>
          ),
        },
        {
          id: 'received',
          header: 'Received',
          width: 120,
          cell: ({ suggestion }) => (
            <span title={formatFullDate(suggestion.receivedAt)}>
              {formatListDate(suggestion.receivedAt)}
            </span>
          ),
        },
        {
          id: 'actions',
          header: 'Actions',
          width: 300,
          cell: (row) => {
            const others = labelsOf(row.suggestion.accountId).filter(
              (label) => label.path !== row.result.path,
            );
            return (
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="primary" onClick={() => decide([row], true)}>
                  Accept
                </Button>
                <Button onClick={() => decide([row], false)}>Decline</Button>
                <ButtonDropdown
                  disabled={others.length === 0}
                  items={others.map((label) => ({ id: label.path, text: label.name }))}
                  onItemClick={({ detail }) => {
                    const label = others.find((item) => item.path === detail.id)!;
                    resolve.mutate(
                      {
                        type: 'assign',
                        messageId: row.suggestion.messageId,
                        path: label.path,
                        name: label.name,
                      },
                      {
                        onSuccess: () =>
                          flash({ type: 'success', content: `Filed under “${label.name}”.` }),
                        onError: fail,
                      },
                    );
                  }}
                >
                  Other label
                </ButtonDropdown>
              </SpaceBetween>
            );
          },
        },
      ]}
    />
  );
}

export function SuggestionsPage() {
  const { version } = useUiVersion();
  const page = (
    <ContentLayout>
      <FlashProvider>
        <SuggestionsTable />
      </FlashProvider>
    </ContentLayout>
  );
  // The console (v2) lays the page out itself; the classic look puts it on a panel.
  return version === 'v2' ? page : <div className={styles.panel}>{page}</div>;
}

export default SuggestionsPage;
