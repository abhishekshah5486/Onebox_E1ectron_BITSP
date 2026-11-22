import Alert from '@cloudscape-design/components/alert';
import Button from '@cloudscape-design/components/button';
import Tabs from '@cloudscape-design/components/tabs';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useAccounts } from '../api/queries';
import {
  isSearchMode,
  SEARCH_MODE_LABEL,
  searchPath,
  searchProblem,
  useSearch,
  type SearchMode,
} from '../api/search';
import { PAGE_SIZE } from '../mail/paging';
import { EmptyMessage, MailTable } from './ConsoleMailbox';
import styles from './ConsoleMailbox.module.css';

const MODES: SearchMode[] = ['keyword', 'semantic'];

export function ConsoleSearch() {
  const params = useParams();
  const q = params.q ?? '';
  const mode: SearchMode = isSearchMode(params.mode) ? params.mode : 'keyword';
  const navigate = useNavigate();
  const accounts = useAccounts();
  const byId = useMemo(() => new Map((accounts.data ?? []).map((a) => [a.id, a])), [accounts.data]);
  const [paging, setPaging] = useState({ key: '', page: 1 });
  const key = `${mode}:${q}`;
  const page = paging.key === key ? paging.page : 1;
  const query = useSearch(q, mode, page);
  const total = query.data?.total ?? 0;
  const problem = query.isError ? searchProblem(query.error) : null;
  const fellBack = mode === 'semantic' && query.data?.mode === 'keyword';

  return (
    <MailTable
      query={{
        data: query.data && { items: query.data.threads },
        isPending: query.isPending,
        // Credits and setup problems show as an alert above instead.
        isError: query.isError && !problem,
        error: query.error,
        refetch: () => query.refetch(),
      }}
      view={null}
      folders={null}
      tabs={
        <div className={styles.categoryTabs}>
          <Tabs
            ariaLabel="Search type"
            activeTabId={mode}
            tabs={MODES.map((id) => ({ id, label: SEARCH_MODE_LABEL[id] }))}
            onChange={({ detail }) =>
              void navigate(searchPath(detail.activeTabId as SearchMode, q))
            }
          />
        </div>
      }
      title="Search results"
      description={`“${q}”`}
      counter={query.data ? `(${total.toLocaleString()})` : undefined}
      basePath={searchPath(mode, q)}
      accounts={byId}
      page={page}
      pagesCount={Math.max(page, Math.ceil(total / PAGE_SIZE))}
      openEnd={query.data?.nextPage != null && mode === 'semantic'}
      onPageChange={(next) => setPaging({ key, page: next })}
      loading={false}
      loadingText=""
      onRefresh={() => void query.refetch()}
      alerts={
        <>
          {problem && (
            <Alert
              type="warning"
              action={
                problem.plans && <Button onClick={() => void navigate('/plans')}>See plans</Button>
              }
            >
              {problem.text}
            </Alert>
          )}
          {mode === 'semantic' && !problem && (
            <Alert type="info">
              {fellBack
                ? 'Only search operators were given, so this is a keyword search. Add words to search by meaning.'
                : 'Semantic search finds mail by meaning, best matches first.'}
            </Alert>
          )}
        </>
      }
      empty={
        <EmptyMessage
          title="No messages matched your search"
          body={
            mode === 'keyword'
              ? 'Try other words, or semantic search to find mail by meaning.'
              : 'Try describing it another way, or keyword search for exact words.'
          }
        />
      }
    />
  );
}
