import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ApiError } from '../../api/client';
import { mailApi } from '../../api/mail';
import { useGoogleDrive } from '../../api/queries';
import { useAuth } from '../../auth/AuthProvider';
import { describeError } from '../../auth/errors';
import { useOptionalFlash } from '../../settings/flash';
import { useSnackbar, type SnackbarMessage } from '../../ui/Snackbar';
import { drivePathLabel } from './drivePath';
import { SaveToDriveDialog, type DriveTarget } from './SaveToDriveDialog';
import type { AttachmentFile } from './useAttachment';

const LAST_ACCOUNT = 'onebox.drive.lastAccount';

const lastAccount = () => {
  try {
    return localStorage.getItem(LAST_ACCOUNT) ?? undefined;
  } catch {
    return undefined;
  }
};

const rememberAccount = (id: string) => {
  try {
    localStorage.setItem(LAST_ACCOUNT, id);
  } catch {
    // Only a convenience.
  }
};

// "Add to Drive": asks for the account and folder, copies the files, and reports it in the
// snackbar (v1) or a banner (v2). Render `dialog` wherever the buttons are.
export function useSaveToDrive() {
  const { api } = useAuth();
  const navigate = useNavigate();
  const snackbar = useSnackbar();
  const flash = useOptionalFlash();
  const drive = useGoogleDrive();
  const [pending, setPending] = useState<AttachmentFile[] | null>(null);
  const [saving, setSaving] = useState(false);

  const notify = (message: SnackbarMessage & { error?: boolean }) =>
    flash
      ? flash({
          type: message.error ? 'error' : 'success',
          content: message.text,
          ...(message.action && { action: message.action }),
        })
      : snackbar(message);

  const connectFirst = (text: string) =>
    notify({
      text,
      error: true,
      action: { label: 'Connect', onClick: () => void navigate('/settings/integrations') },
    });

  const upload = async (files: AttachmentFile[], { accountId, path }: DriveTarget) => {
    setPending(null);
    setSaving(true);
    rememberAccount(accountId);
    try {
      const byMessage = new Map<string, number[]>();
      for (const file of files) {
        byMessage.set(file.messageId, [...(byMessage.get(file.messageId) ?? []), file.index]);
      }
      const saved = [];
      for (const [messageId, indexes] of byMessage) {
        saved.push(
          ...(await mailApi.saveToDrive(api, messageId, { indexes, accountId, path })).files,
        );
      }
      const first = saved[0];
      const where = drivePathLabel(path);
      notify({
        text:
          saved.length === 1 && first
            ? `${first.name} added to ${where}.`
            : `${saved.length} files added to ${where}.`,
        ...(first && {
          action: {
            label: 'Open',
            onClick: () => window.open(first.link, '_blank', 'noopener'),
          },
        }),
      });
    } catch (error) {
      // The account's access was revoked or has expired.
      if (error instanceof ApiError && error.status === 404 && /drive/i.test(error.message)) {
        void drive.refetch();
        connectFirst(error.message);
      } else {
        notify({ text: describeError(error), error: true });
      }
    } finally {
      setSaving(false);
    }
  };

  const save = async (files: AttachmentFile[]) => {
    if (files.length === 0 || saving) return;
    const accounts = (drive.data ?? (await drive.refetch()).data)?.accounts ?? [];
    if (accounts.length === 0) {
      connectFirst('Connect Google Drive to save files there.');
      return;
    }
    setPending(files);
  };

  const accounts = drive.data?.accounts ?? [];
  const dialog =
    pending && accounts.length > 0 ? (
      <SaveToDriveDialog
        count={pending.length}
        accounts={accounts}
        initialAccountId={lastAccount()}
        onConfirm={(target) => void upload(pending, target)}
        onCancel={() => setPending(null)}
      />
    ) : null;

  return { save, saving, dialog };
}
