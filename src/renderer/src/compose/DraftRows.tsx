import { useQueryClient } from '@tanstack/react-query';
import { composeApi, composeKeys, useDrafts, type Draft } from '../api/compose';
import { useAuth } from '../auth/AuthProvider';
import { formatListDate } from '../mail/format';
import { IconButton } from '../ui/IconButton';
import { useNotify } from '../ui/useNotify';
import { useCompose } from './ComposeProvider';
import styles from './DraftRows.module.css';
import { recipientLabel } from './model';

export const draftRecipients = (draft: Draft) =>
  [...draft.to, ...draft.cc, ...draft.bcc].map(recipientLabel).join(', ');

// Drafts saved in OneBox, at the top of the Drafts list as Gmail-style rows; one opens in
// compose. `accountId` keeps an account's Drafts folder to its own drafts.
export function DraftRows({ accountId }: { accountId?: string }) {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const compose = useCompose();
  const notify = useNotify();
  const drafts = (useDrafts().data ?? []).filter(
    (draft) => !accountId || draft.accountId === accountId,
  );
  if (drafts.length === 0) return null;

  const discard = async (draft: Draft) => {
    await composeApi.deleteDraft(api, draft.id);
    await queryClient.invalidateQueries({ queryKey: composeKeys.drafts });
    notify({ type: 'info', tone: 'burgundy', content: 'Draft discarded.' });
  };

  return (
    <div role="list" aria-label="Drafts in OneBox">
      {drafts.map((draft) => (
        <div
          key={draft.id}
          role="listitem"
          tabIndex={0}
          className={styles.row}
          onClick={() => compose.open({ composition: draft, draftId: draft.id })}
          onKeyDown={(event) =>
            event.key === 'Enter' && compose.open({ composition: draft, draftId: draft.id })
          }
        >
          <span className={styles.who}>
            <span className={styles.tag}>Draft</span>
            <span className={styles.to}>{draftRecipients(draft) || '(no recipients)'}</span>
          </span>
          <span className={styles.text}>
            <b>{draft.subject || '(no subject)'}</b>
            {draft.text.trim() && <span> - {draft.text.trim().replace(/\s+/g, ' ')}</span>}
            {draft.note && <span className={styles.note}> · {draft.note}</span>}
          </span>
          <span className={styles.end} onClick={(event) => event.stopPropagation()}>
            <span className={styles.date}>{formatListDate(draft.updatedAt)}</span>
            <IconButton
              className={styles.discard}
              icon="delete"
              size="small"
              label="Discard draft"
              onClick={() => void discard(draft)}
            />
          </span>
        </div>
      ))}
    </div>
  );
}
