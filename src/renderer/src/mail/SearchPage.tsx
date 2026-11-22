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
import { describeError } from '../auth/errors';
import { ButtonLink } from '../ui/Button';
import styles from './MailboxPage.module.css';
import { PageControls, SkeletonRows } from './PageControls';
import { PAGE_SIZE, rangeLabel } from './paging';
import { ThreadList } from './ThreadList';

const MODES: SearchMode[] = ['keyword', 'semantic'];

export function SearchPage() {
  const params = useParams();
  const q = params.q ?? '';
  const mode: SearchMode = isSearchMode(params.mode) ? params.mode : 'keyword';
  const navigate = useNavigate();
  const accounts = useAccounts();
  const byId = useMemo(() => new Map((accounts.data ?? []).map((a) => [a.id, a])), [accounts.data]);
  // A new search starts on its first page.
  const [paging, setPaging] = useState({ key: '', page: 1 });
  const key = `${mode}:${q}`;
  const page = paging.key === key ? paging.page : 1;
  const setPage = (next: number) => setPaging({ key, page: next });
  const query = useSearch(q, mode, page);
  const items = query.data?.threads ?? [];
  const total = query.data?.total ?? 0;
  const problem = query.isError ? searchProblem(query.error) : null;
  const fellBack = mode === 'semantic' && query.data?.mode === 'keyword';

  return (
    <section className={styles.panel} aria-label="Search results">
      <ThreadList
        label="Search results"
        items={items}
        basePath={searchPath(mode, q)}
        accounts={byId}
        view={null}
        folders={null}
        position={{ offset: (page - 1) * PAGE_SIZE, total: total || null }}
        tabs={
          <div className={styles.tabs} role="tablist" aria-label="Search type">
            {MODES.map((option) => (
              <button
                key={option}
                role="tab"
                aria-selected={mode === option}
                className={styles.tab}
                onClick={() => void navigate(searchPath(option, q))}
              >
                {SEARCH_MODE_LABEL[option]}
              </button>
            ))}
          </div>
        }
        onRefresh={() => void query.refetch()}
        controls={
          <PageControls
            label={rangeLabel(page, items.length, total || null)}
            canPrev={page > 1}
            canNext={query.data?.nextPage != null}
            onPrev={() => setPage(page - 1)}
            onNext={() => setPage(page + 1)}
            busy={query.isFetching && query.isPlaceholderData}
          />
        }
      >
        {mode === 'semantic' && (
          <p className={styles.status}>
            {fellBack
              ? 'Only search operators were given, so this is a keyword search. Add words to search by meaning.'
              : 'Semantic search finds mail by meaning, best matches first.'}
          </p>
        )}
        {query.isPending && <SkeletonRows label="Searching" />}
        {query.isError && (
          <div role="alert" className={styles.status}>
            {problem?.text ?? describeError(query.error)}{' '}
            {problem?.plans && <ButtonLink to="/plans">See plans</ButtonLink>}
          </div>
        )}
        {query.isSuccess && items.length === 0 && (
          <div className={styles.empty}>
            <h2>No messages matched your search</h2>
            <p>
              {mode === 'keyword'
                ? 'Try other words, or semantic search to find mail by meaning.'
                : 'Try describing it another way, or keyword search for exact words.'}
            </p>
          </div>
        )}
      </ThreadList>
    </section>
  );
}
