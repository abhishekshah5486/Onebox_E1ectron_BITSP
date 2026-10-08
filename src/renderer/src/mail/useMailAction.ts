import { useThreadAction, useUndo } from '../api/mail-queries';
import { describeError } from '../auth/errors';
import { useOptionalFlash } from '../settings/flash';
import { useSnackbar, type SnackbarMessage } from '../ui/Snackbar';
import type { ActionSpec } from './actions';
import { FOLDER_LABEL } from './folders';

// What Gmail says after an action, e.g. "Conversation archived." or "3 conversations moved to Trash."
export function actionMessage(spec: ActionSpec, count: number, targetName?: string): string | null {
  const noun = count === 1 ? 'Conversation' : `${count} conversations`;
  switch (spec.action) {
    case 'archive':
      return `${noun} archived.`;
    case 'trash':
      return `${noun} moved to Trash.`;
    case 'delete':
      return `${noun} deleted forever.`;
    case 'read':
      return `${noun} marked as read.`;
    case 'unread':
      return `${noun} marked as unread.`;
    case 'move': {
      const to = spec.to;
      if (!to) return null;
      if ('label' in to) return `${noun} moved to "${targetName ?? to.label}".`;
      if (to.role === 'spam') return `${noun} marked as spam.`;
      if (to.role === 'inbox' && spec.from && 'role' in spec.from && spec.from.role === 'spam') {
        return `${noun} marked as not spam.`;
      }
      return `${noun} moved to ${targetName ?? FOLDER_LABEL[to.role]}.`;
    }
    default:
      return null;
  }
}

// The console also confirms what Gmail does silently.
const STAR_MESSAGE: Partial<Record<ActionSpec['action'], string>> = {
  star: 'starred',
  unstar: 'unstarred',
};

// Runs an action and reports it, with Undo while the server change can be withdrawn: in the
// snackbar (v1), or as a banner where the shell has a banner area (v2).
export function useMailAction() {
  const act = useThreadAction();
  const undo = useUndo();
  const snackbar = useSnackbar();
  const flash = useOptionalFlash();
  const notify = (message: SnackbarMessage & { error?: boolean }) =>
    flash
      ? flash({
          type: message.error ? 'error' : 'success',
          content: message.text,
          ...(message.action && { action: message.action }),
        })
      : snackbar(message);

  return (threadIds: string[], spec: ActionSpec, targetName?: string) => {
    const starred = STAR_MESSAGE[spec.action];
    const message =
      actionMessage(spec, threadIds.length, targetName) ??
      (flash && starred
        ? `${threadIds.length === 1 ? 'Conversation' : `${threadIds.length} conversations`} ${starred}.`
        : null);
    act.mutate(
      { threadIds, ...spec },
      {
        onSuccess: ({ undoToken }) => {
          if (!message) return;
          notify({
            text: message,
            ...(undoToken && {
              action: {
                label: 'Undo',
                onClick: () =>
                  undo.mutate(undoToken, {
                    onSuccess: () => notify({ text: 'Action undone.' }),
                    onError: (error) => notify({ text: describeError(error), error: true }),
                  }),
              },
            }),
          });
        },
        onError: (error) => notify({ text: describeError(error), error: true }),
      },
    );
  };
}
