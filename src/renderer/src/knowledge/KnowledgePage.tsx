import { useState } from 'react';
import { NavLink, useNavigate, useParams, useSearchParams } from 'react-router';
import { useIsFetching } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { knowledgeApi, useKnowledgeSources, type MailInfo } from '../api/knowledge';
import { saveBlob } from '../mail/attachments/useAttachment';
import { Icon } from '../ui/Icon';
import { useNotify } from '../ui/useNotify';
import { isBusy, sourceLabel } from './format';
import { Sparkles, useRecentSearches } from './parts';
import { RecordDrawer } from './RecordDrawer';
import { RecordsView } from './RecordsView';
import type { Focus } from './results';
import { SearchView } from './SearchView';
import { SettingsView } from './SettingsView';
import styles from './Knowledge.module.css';

interface Openable {
  name: string;
  mail?: MailInfo | null;
  recordId?: string;
  id?: string;
}

export default function KnowledgePage() {
  const { view = 'search', id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const notify = useNotify();
  const { api } = useAuth();
  const sources = useKnowledgeSources();
  const { recent, remember } = useRecentSearches();
  const [focus, setFocus] = useState<Focus | null>(null);
  const searching = useIsFetching({ queryKey: ['knowledge', 'retrieve'] }) > 0;
  const asked = params.get('q') ?? '';

  // An email opens in the mailbox; a file is saved under its own name.
  const open = async (record: Openable) => {
    if (record.mail?.threadId) {
      void navigate(`/inbox/${record.mail.threadId}`);
      return;
    }
    const recordId = record.recordId ?? record.id;
    if (!recordId) return;
    try {
      saveBlob(await knowledgeApi.file(api, recordId), record.name);
    } catch {
      notify({ type: 'error', content: `${record.name} couldn't be downloaded.` });
    }
  };

  const collections = (sources.data ?? []).filter((s) => s.sourceType === 'upload');
  const mail = (sources.data ?? []).filter((s) => s.sourceType === 'mail');
  const mailCount = mail.reduce((n, s) => n + s.records, 0);
  const total = (sources.data ?? []).reduce((n, s) => n + s.records, 0);
  const reading = (sources.data ?? []).reduce(
    (n, s) =>
      n +
      Object.entries(s.statuses).reduce(
        (m, [status, c]) => m + (isBusy(status as never) ? (c ?? 0) : 0),
        0,
      ),
    0,
  );

  const railLink = (
    to: string,
    label: string,
    icon: Parameters<typeof Icon>[0]['name'],
    count?: number,
    end = true,
  ) => (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `${styles.railItem} ${isActive ? styles.railActive : ''}`}
      onClick={() => setFocus(null)}
    >
      <Icon name={icon} size={18} />
      <span className={styles.railText}>{label}</span>
      {count !== undefined && <span className={styles.railCount}>{count}</span>}
    </NavLink>
  );

  return (
    <div className={`${styles.page} ${searching ? styles.busy : ''}`}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.mark}>
            <Sparkles size={20} />
          </span>
          <div>
            <h1 className={styles.title}>Knowledge</h1>
            <p className={styles.subtitle}>
              {total} {total === 1 ? 'record' : 'records'}
              {reading > 0 && ` · ${reading} being read`}
            </p>
          </div>
        </div>
        <span className={styles.accent} />
      </header>
      <div className={styles.body}>
        <nav className={styles.rail} aria-label="Knowledge">
          <button
            type="button"
            className={styles.newSearch}
            onClick={() => {
              setFocus(null);
              void navigate('/knowledge');
            }}
          >
            <Sparkles size={16} />
            New search
          </button>
          {railLink('/knowledge/records', 'All records', 'inbox', total)}
          {railLink('/knowledge/settings', 'Settings', 'settings')}

          <div className={styles.railSection}>Collections</div>
          {collections.length === 0 && (
            <p className={styles.railEmpty}>Upload files under All records.</p>
          )}
          {collections.map((c) =>
            railLink(
              `/knowledge/collections/${c.sourceId}`,
              sourceLabel('upload', c.sourceId),
              'label',
              c.records,
            ),
          )}
          {mail.length > 0 && railLink('/knowledge/mail', 'Mail', 'mail', mailCount)}

          {recent.length > 0 && (
            <>
              <div className={styles.railSection}>Your searches</div>
              {recent.map((q) => (
                <button
                  key={q}
                  type="button"
                  className={`${styles.railItem} ${view === 'search' && asked === q ? styles.railActive : ''}`}
                  title={q}
                  onClick={() => {
                    setFocus(null);
                    void navigate(`/knowledge?${new URLSearchParams({ q })}`);
                  }}
                >
                  <Icon name="search" size={16} />
                  <span className={styles.railText}>{q}</span>
                </button>
              ))}
            </>
          )}
        </nav>
        <main className={styles.scroll}>
          {view === 'search' && (
            <SearchView
              onSearched={remember}
              focus={focus}
              onPreview={setFocus}
              onOpen={(record) => void open(record)}
            />
          )}
          {(view === 'records' || view === 'collections' || view === 'mail') && (
            <RecordsView
              key={`${view}:${id ?? ''}`}
              {...(view === 'collections' && id && { sourceType: 'upload' as const, sourceId: id })}
              {...(view === 'mail' && { sourceType: 'mail' as const })}
              onPreview={(recordId) => setFocus({ recordId })}
              onOpen={(record) => void open(record)}
            />
          )}
          {view === 'settings' && <SettingsView />}
        </main>
        {focus && (
          <RecordDrawer
            key={focus.recordId}
            focus={focus}
            query={view === 'search' ? asked : ''}
            onClose={() => setFocus(null)}
            onOpen={(record) => void open(record)}
          />
        )}
      </div>
    </div>
  );
}
