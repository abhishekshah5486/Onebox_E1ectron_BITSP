import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ApiError } from '../../api/client';
import { mailApi } from '../../api/mail';
import { useAuth } from '../../auth/AuthProvider';
import { describeError } from '../../auth/errors';
import { useOptionalFlash } from '../../settings/flash';
import { useSnackbar, type SnackbarMessage } from '../../ui/Snackbar';
import type { AttachmentFile } from './useAttachment';

// Copies files into the user's Drive and reports it in the snackbar (v1) or a banner (v2).
export function useSaveToDrive() {
  const { api } = useAuth();
  const navigate = useNavigate();
  const snackbar = useSnackbar();
  const flash = useOptionalFlash();
  const [saving, setSaving] = useState(false);

  const notify = (message: SnackbarMessage & { error?: boolean }) =>
    flash
      ? flash({
          type: message.error ? 'error' : 'success',
          content: message.text,
          ...(message.action && { action: message.action }),
        })
      : snackbar(message);

  const save = async (files: AttachmentFile[]) => {
    if (files.length === 0 || saving) return;
    setSaving(true);
    try {
      const byMessage = new Map<string, number[]>();
      for (const file of files) {
        byMessage.set(file.messageId, [...(byMessage.get(file.messageId) ?? []), file.index]);
      }
      const saved = [];
      for (const [messageId, indexes] of byMessage) {
        saved.push(...(await mailApi.saveToDrive(api, messageId, indexes)).files);
      }
      const first = saved[0];
      notify({
        text:
          saved.length === 1 && first
            ? `${first.name} saved to Drive.`
            : `${saved.length} files saved to Drive.`,
        ...(first && {
          action: {
            label: saved.length === 1 ? 'Open' : 'Open first',
            onClick: () => window.open(first.link, '_blank', 'noopener'),
          },
        }),
      });
    } catch (error) {
      // Not connected yet, or access expired: offer the way to connect.
      const notConnected =
        error instanceof ApiError && error.status === 404 && /drive/i.test(error.message);
      notify({
        text: notConnected ? 'Connect Google Drive to save files there.' : describeError(error),
        error: true,
        ...(notConnected && {
          action: { label: 'Connect', onClick: () => void navigate('/settings/integrations') },
        }),
      });
    } finally {
      setSaving(false);
    }
  };

  return { save, saving };
}
