import { useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router';
import { ApiError } from '../../api/client';
import { mailApi } from '../../api/mail';
import { useStorage } from '../../api/queries';
import type { StorageProviderId } from '../../api/settings';
import { useAuth } from '../../auth/AuthProvider';
import { describeError } from '../../auth/errors';
import { useOptionalFlash } from '../../settings/flash';
import { ProviderLogo } from '../../storage/ProviderLogo';
import { STORAGE_PROVIDERS, storagePathLabel } from '../../storage/providers';
import { Icon } from '../../ui/Icon';
import { useSnackbar } from '../../ui/Snackbar';
import { SaveToStorageDialog, type StorageTarget } from './SaveToStorageDialog';
import type { AttachmentFile } from './useAttachment';

const LAST_ACCOUNT = 'onebox.storage.lastAccount';

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

let nextSave = 0;

const withLogo = (provider: StorageProviderId, text: string) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
    <ProviderLogo provider={provider} size={18} />
    {text}
  </span>
);

// Saving attachments to cloud storage: asks for the account and folder, copies the files, and
// reports progress in the snackbar (v1) or a banner (v2). Render `dialog` next to the buttons.
export function useSaveToStorage() {
  const { api } = useAuth();
  const navigate = useNavigate();
  const snackbar = useSnackbar();
  const flash = useOptionalFlash();
  const storage = useStorage();
  const [pending, setPending] = useState<AttachmentFile[] | null>(null);
  const [saving, setSaving] = useState(false);

  // Name buttons after the one service in use (e.g. "Add to Drive"), or generically.
  const accounts = storage.data?.accounts ?? [];
  const inUse = [...new Set(accounts.map((a) => a.provider))];
  const only =
    (inUse.length ? inUse : (storage.data?.providers ?? [])).length === 1
      ? (inUse[0] ?? storage.data?.providers[0])
      : undefined;
  const button: { label: string; allLabel: string; icon: (size: number) => ReactElement } = only
    ? {
        label: `Add to ${STORAGE_PROVIDERS[only].shortName}`,
        allLabel: `Add all to ${STORAGE_PROVIDERS[only].shortName}`,
        icon: (size) => <ProviderLogo provider={only} size={size} />,
      }
    : {
        label: 'Save to cloud storage',
        allLabel: 'Save all to cloud storage',
        icon: (size) => <Icon name="cloudUpload" size={size} />,
      };

  const report = (
    id: string,
    message: { text: string; provider?: StorageProviderId; error?: boolean; loading?: boolean },
    action?: { label: string; onClick: () => void },
  ) => {
    if (flash) {
      flash({
        id,
        type: message.error ? 'error' : message.loading ? 'info' : 'success',
        loading: message.loading,
        content: message.provider ? withLogo(message.provider, message.text) : message.text,
        ...(action && { action }),
      });
    } else {
      snackbar({
        text: message.text,
        ...(message.provider && { icon: STORAGE_PROVIDERS[message.provider].logo }),
        ...(action && { action }),
      });
    }
  };

  const connect = { label: 'Connect', onClick: () => void navigate('/settings/integrations') };

  const upload = async (files: AttachmentFile[], { account, path }: StorageTarget) => {
    setPending(null);
    setSaving(true);
    rememberAccount(account.id);
    const id = `storage-save-${nextSave++}`;
    const provider = account.provider;
    const where = storagePathLabel(path, provider);
    const what = files.length === 1 ? files[0]!.filename : `${files.length} files`;
    report(id, {
      text: `Saving ${what} to ${STORAGE_PROVIDERS[provider].name}…`,
      provider,
      loading: true,
    });
    try {
      const byMessage = new Map<string, number[]>();
      for (const file of files) {
        byMessage.set(file.messageId, [...(byMessage.get(file.messageId) ?? []), file.index]);
      }
      const saved = [];
      for (const [messageId, indexes] of byMessage) {
        const result = await mailApi.saveToStorage(api, messageId, {
          indexes,
          accountId: account.id,
          path,
        });
        saved.push(...result.files);
      }
      const first = saved[0];
      report(
        id,
        {
          text:
            saved.length === 1 && first
              ? `${first.name} saved to ${where}.`
              : `${saved.length} files saved to ${where}.`,
          provider,
        },
        first && { label: 'Open', onClick: () => window.open(first.link, '_blank', 'noopener') },
      );
    } catch (error) {
      // The account's access was revoked or has expired.
      const expired = error instanceof ApiError && error.status === 404;
      if (expired) void storage.refetch();
      report(id, { text: describeError(error), error: true }, expired ? connect : undefined);
    } finally {
      setSaving(false);
    }
  };

  const save = async (files: AttachmentFile[]) => {
    if (files.length === 0 || saving) return;
    const connected = (storage.data ?? (await storage.refetch()).data)?.accounts ?? [];
    if (connected.length === 0) {
      report(
        `storage-connect-${nextSave++}`,
        { text: 'Connect cloud storage to save files there.', error: true },
        connect,
      );
      return;
    }
    setPending(files);
  };

  const providersInUse = new Set(accounts.map((a) => a.provider));
  const title =
    providersInUse.size === 1
      ? `Save to ${STORAGE_PROVIDERS[accounts[0]!.provider].name}`
      : 'Save to cloud storage';
  const dialog =
    pending && accounts.length > 0 ? (
      <SaveToStorageDialog
        title={title}
        count={pending.length}
        accounts={accounts}
        initialAccountId={lastAccount()}
        onConfirm={(target) => void upload(pending, target)}
        onCancel={() => setPending(null)}
      />
    ) : null;

  return { save, saving, dialog, button };
}
