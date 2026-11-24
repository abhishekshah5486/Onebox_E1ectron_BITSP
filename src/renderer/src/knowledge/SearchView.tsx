import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { ApiError } from '../api/client';
import {
  useKnowledgeSources,
  useRetrieval,
  type Chunk,
  type RetrieveInput,
} from '../api/knowledge';
import { Icon } from '../ui/Icon';
import { byRecord, sourceLabel, terms } from './format';
import { Sparkles } from './parts';
import { CitationCard, RecordCard, type Focus } from './results';
import styles from './Knowledge.module.css';

const MAX_CHARS = 4000;

const SUGGESTIONS = [
  {
    chip: 'Policy',
    title: 'What does it say about refunds?',
    text: 'Finds the passages on refunds across your files and mail.',
  },
  {
    chip: 'Summary',
    title: 'What are these documents about?',
    text: 'Each file is summarized once it is read; those summaries are searchable too.',
  },
  {
    chip: 'Tables',
    title: 'Which invoices are over budget?',
    text: 'Rows of spreadsheets and tables are matched as sentences.',
  },
  {
    chip: 'Mail',
    title: 'What did the supplier send last month?',
    text: 'Emails and their attachments are searched like files.',
  },
];

export interface Scope {
  sourceIds: string[];
  mail: boolean;
  createdAfter: string;
  createdBefore: string;
  limit: string;
}

const NO_SCOPE: Scope = {
  sourceIds: [],
  mail: true,
  createdAfter: '',
  createdBefore: '',
  limit: '',
};

// Filters combine with AND, so "these collections and mail" names the mail accounts too.
function inputFor(
  query: string,
  scope: Scope,
  recordIds: string[],
  mailIds: string[],
): RetrieveInput {
  const sourceIds =
    scope.sourceIds.length > 0 ? [...scope.sourceIds, ...(scope.mail ? mailIds : [])] : [];
  const uploadsOnly = scope.sourceIds.length === 0 && !scope.mail;
  return {
    query,
    ...(recordIds.length > 0 && { recordIds }),
    ...(sourceIds.length > 0 && { sourceIds }),
    ...(uploadsOnly && { sourceTypes: ['upload'] }),
    ...(scope.createdAfter && { createdAfter: scope.createdAfter }),
    ...(scope.createdBefore && { createdBefore: scope.createdBefore }),
    ...(scope.limit && { limit: Number(scope.limit) }),
  };
}

const STEPS = ['Reading your question', 'Searching your files and mail', 'Ranking the passages'];

function Progress({ done, found }: { done: boolean; found?: string }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (done) return;
    const timers = [setTimeout(() => setStep(1), 450), setTimeout(() => setStep(2), 1400)];
    return () => timers.forEach(clearTimeout);
  }, [done]);
  const reached = done ? STEPS.length : step;
  return (
    <div>
      <ol className={styles.steps} aria-live="polite">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={`${styles.step} ${i <= reached - 1 || done ? styles.stepDone : ''}`}
          >
            <span className={styles.stepIcon}>
              {i < reached ? (
                <span className={styles.check}>
                  <Icon name="check" size={18} />
                </span>
              ) : i === reached ? (
                <span className={styles.spinner} />
              ) : (
                <span className={styles.dot} />
              )}
            </span>
            {label}
          </li>
        ))}
        {done && found && (
          <li className={`${styles.step} ${styles.stepDone}`}>
            <span className={`${styles.stepIcon} ${styles.sparkleIcon}`}>
              <Sparkles size={16} />
            </span>
            {found}
          </li>
        )}
      </ol>
      {!done && <div className={styles.shimmer} />}
    </div>
  );
}

function errorText(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 402)
      return 'You are out of AI credits, which searching needs for your question.';
    if (error.status === 503) return `Search is unavailable right now. ${error.message}`;
    return error.message;
  }
  return 'The search failed. Check your connection and try again.';
}

export function SearchView({
  onSearched,
  focus,
  onPreview,
  onOpen,
}: {
  onSearched: (query: string) => void;
  focus: Focus | null;
  onPreview: (focus: Focus) => void;
  onOpen: (record: Chunk['record']) => void;
}) {
  const user = useAuth().state.user;
  const [params, setParams] = useSearchParams();
  const asked = params.get('q') ?? '';
  const recordIds = useMemo(
    () => params.get('records')?.split(',').filter(Boolean) ?? [],
    [params],
  );
  const [draft, setDraft] = useState(asked);
  const [scope, setScope] = useState<Scope>(NO_SCOPE);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [tab, setTab] = useState<'results' | 'citations'>('results');
  const [applied, setApplied] = useState<Scope>(NO_SCOPE);
  const prompt = useRef<HTMLTextAreaElement>(null);
  const sources = useKnowledgeSources();
  const collections = (sources.data ?? []).filter((s) => s.sourceType === 'upload');

  // A question asked elsewhere (a recent search) becomes the draft.
  const [seen, setSeen] = useState(asked);
  if (seen !== asked) {
    setSeen(asked);
    setDraft(asked);
  }

  const mailIds = (sources.data ?? [])
    .filter((s) => s.sourceType === 'mail')
    .map((s) => s.sourceId);
  const input = asked ? inputFor(asked, applied, recordIds, mailIds) : null;
  const retrieval = useRetrieval(input);
  const words = useMemo(() => terms(asked), [asked]);
  const data = retrieval.data;
  const hits = useMemo(() => byRecord(data?.chunks ?? []), [data]);
  const top = Math.max(0, ...(data?.chunks ?? []).map((c) => c.score));
  const outsideTop = Math.max(0, ...(data?.outsideDates?.chunks ?? []).map((c) => c.score));

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const query = draft.trim();
    if (!query) return;
    setApplied(scope);
    setTab('results');
    onSearched(query);
    const next = new URLSearchParams(params);
    next.set('q', query);
    setParams(next);
  };

  const onKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) submit(event);
  };

  const scoped =
    scope.sourceIds.length > 0 ||
    !scope.mail ||
    scope.createdAfter ||
    scope.createdBefore ||
    scope.limit;

  const composer = (
    <form className={styles.composer} onSubmit={submit}>
      <div className={styles.composerInner}>
        {recordIds.length > 0 && (
          <div className={styles.within}>
            Searching within {recordIds.length} selected{' '}
            {recordIds.length === 1 ? 'record' : 'records'}
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => {
                const next = new URLSearchParams(params);
                next.delete('records');
                setParams(next);
              }}
            >
              Search everything
            </button>
          </div>
        )}
        <textarea
          ref={prompt}
          className={styles.prompt}
          value={draft}
          maxLength={MAX_CHARS}
          rows={2}
          placeholder="Ask about your files and mail…"
          aria-label="Question"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
        />
        <div className={styles.composerBar}>
          <button
            type="button"
            className={`${styles.filter} ${scoped ? styles.filterOn : ''}`}
            aria-expanded={scopeOpen}
            onClick={() => setScopeOpen(!scopeOpen)}
          >
            <Icon name="tune" size={16} />
            {scoped ? 'Scoped' : 'All sources'}
          </button>
          <span className={styles.counter}>
            {draft.length > MAX_CHARS * 0.8 && `${draft.length} / `}Max {MAX_CHARS.toLocaleString()}{' '}
            characters
          </span>
          <button
            type="submit"
            className={styles.send}
            disabled={!draft.trim()}
            aria-label="Search"
          >
            <Icon name="send" size={18} />
          </button>
        </div>
        {scopeOpen && (
          <div className={styles.scope}>
            <div className={styles.scopeGroup}>
              <span className={styles.scopeLabel}>Collections</span>
              <div className={styles.scopeChips}>
                {collections.length === 0 && <span className={styles.muted}>No uploads yet</span>}
                {collections.map((source) => {
                  const on = scope.sourceIds.includes(source.sourceId);
                  return (
                    <button
                      key={source.sourceId}
                      type="button"
                      className={`${styles.filter} ${on ? styles.filterOn : ''}`}
                      onClick={() =>
                        setScope({
                          ...scope,
                          sourceIds: on
                            ? scope.sourceIds.filter((id) => id !== source.sourceId)
                            : [...scope.sourceIds, source.sourceId],
                        })
                      }
                    >
                      {sourceLabel('upload', source.sourceId)}
                    </button>
                  );
                })}
                <button
                  type="button"
                  className={`${styles.filter} ${scope.mail ? styles.filterOn : ''}`}
                  onClick={() => setScope({ ...scope, mail: !scope.mail })}
                >
                  <Icon name="mail" size={14} />
                  Mail
                </button>
              </div>
            </div>
            <div className={styles.scopeGroup}>
              <span className={styles.scopeLabel}>Written</span>
              <label className={styles.filter}>
                From
                <input
                  type="date"
                  className={styles.filterField}
                  value={scope.createdAfter}
                  onChange={(e) => setScope({ ...scope, createdAfter: e.target.value })}
                />
              </label>
              <label className={styles.filter}>
                To
                <input
                  type="date"
                  className={styles.filterField}
                  value={scope.createdBefore}
                  onChange={(e) => setScope({ ...scope, createdBefore: e.target.value })}
                />
              </label>
            </div>
            <div className={styles.scopeGroup}>
              <span className={styles.scopeLabel}>Passages</span>
              <input
                type="number"
                min={1}
                max={50}
                placeholder="Your setting"
                className={styles.number}
                value={scope.limit}
                onChange={(e) => setScope({ ...scope, limit: e.target.value })}
              />
              {scoped && (
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => setScope(NO_SCOPE)}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </form>
  );

  if (!asked) {
    return (
      <div className={styles.column}>
        <div className={styles.hero}>
          <div className={styles.orb}>
            <Sparkles size={30} />
          </div>
          <h2 className={styles.heroTitle}>
            Hi{user?.name ? `, ${user.name.split(' ')[0]}` : ''}. What are you looking for?
          </h2>
          <p className={styles.heroText}>
            Ask in your own words. You get the passages from your files and mail that answer it,
            each with where it came from.
          </p>
        </div>
        {composer}
        <div className={styles.suggestions}>
          {SUGGESTIONS.map((s) => (
            <button
              key={s.title}
              type="button"
              className={styles.suggestion}
              onClick={() => {
                setDraft(s.title);
                prompt.current?.focus();
              }}
            >
              <span className={`${styles.chip} ${styles.chipViolet}`}>{s.chip}</span>
              <span className={styles.suggestionTitle}>{s.title}</span>
              <span className={styles.suggestionText}>{s.text}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const shared = { words, focus, onPreview, onOpen };
  const notices = [
    ...(data?.notices ?? []).map((n) => ({ key: n.code, text: n.message, info: true })),
    ...(data?.incomplete ? [{ key: 'incomplete', text: data.incomplete, info: false }] : []),
  ];
  const found = data
    ? data.chunks.length === 0
      ? 'Nothing matched'
      : `${data.chunks.length} ${data.chunks.length === 1 ? 'passage' : 'passages'} from ${hits.length} ${hits.length === 1 ? 'record' : 'records'}`
    : undefined;

  return (
    <div className={styles.column}>
      <h2 className={styles.asked}>{asked}</h2>
      {(retrieval.isFetching || data) && (
        <Progress key={JSON.stringify(input)} done={!retrieval.isFetching} found={found} />
      )}
      {retrieval.isError && <div className={styles.error}>{errorText(retrieval.error)}</div>}
      {data && !retrieval.isFetching && (
        <>
          {notices.map((n) => (
            <div key={n.key} className={`${styles.notice} ${n.info ? styles.noticeInfo : ''}`}>
              <Icon name="info" size={18} />
              {n.text}
            </div>
          ))}
          {data.chunks.length > 0 && (
            <div className={styles.resultTabs} role="tablist">
              {(
                [
                  ['results', 'Results', hits.length],
                  ['citations', 'Citations', data.chunks.length],
                ] as const
              ).map(([key, label, count]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  className={`${styles.resultTab} ${tab === key ? styles.resultTabOn : ''}`}
                  onClick={() => setTab(key)}
                >
                  {label}
                  <span className={styles.count}>{count}</span>
                </button>
              ))}
            </div>
          )}
          {data.chunks.length === 0 && (
            <div className={styles.empty}>
              No passage matched. Try other words, a wider scope, or check that your files are
              searchable under All records.
            </div>
          )}
          <div className={styles.cards}>
            {tab === 'results'
              ? hits.map((hit, i) => (
                  <RecordCard key={hit.recordId} {...shared} top={top} hit={hit} index={i} />
                ))
              : data.chunks.map((chunk, i) => (
                  <CitationCard
                    key={chunk.id}
                    {...shared}
                    top={top}
                    chunk={chunk}
                    refNumber={i + 1}
                    index={i}
                  />
                ))}
          </div>
          {data.outsideDates && data.outsideDates.chunks.length > 0 && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>
                <Icon name="schedule" size={18} />
                Outside your dates
              </h3>
              <p className={styles.sectionNote}>{data.outsideDates.note}</p>
              <div className={styles.cards}>
                {data.outsideDates.chunks.map((chunk, i) => (
                  <CitationCard
                    key={chunk.id}
                    {...shared}
                    top={outsideTop}
                    chunk={chunk}
                    refNumber={data.chunks.length + i + 1}
                    index={i}
                  />
                ))}
              </div>
            </section>
          )}
          {data.unindexed.length > 0 && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Named like your question, not searchable yet</h3>
              <ul className={styles.unindexed}>
                {data.unindexed.map((item) => (
                  <li key={item.recordId}>
                    <button
                      type="button"
                      className={styles.linkButton}
                      onClick={() => onPreview({ recordId: item.recordId })}
                    >
                      {item.name}
                    </button>
                    <span className={styles.muted}>{item.reason ?? item.status}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      <div className={styles.dock}>{composer}</div>
    </div>
  );
}
