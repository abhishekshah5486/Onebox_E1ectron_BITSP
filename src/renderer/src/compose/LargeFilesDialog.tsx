import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import FormField from '@cloudscape-design/components/form-field';
import Modal from '@cloudscape-design/components/modal';
import Select from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useStorage } from '../api/queries';
import { StorageAccountPicker } from '../mail/attachments/StorageAccountPicker';
import { lastAccount, rememberAccount } from '../mail/attachments/useSaveToStorage';
import { formatBytes } from '../mail/format';
import { ProviderLogo } from '../storage/ProviderLogo';
import { STORAGE_PROVIDERS } from '../storage/providers';
import { useUiVersion } from '../theme/UiVersionProvider';
import { Dialog } from '../ui/Dialog';
import styles from './LargeFilesDialog.module.css';
import { MAX_ATTACHMENT_BYTES } from './model';

// Gmail's "Large files must be shared with Google Drive", for whichever cloud storage the
// person has connected: those files go there and a link to each goes in the message.
export function LargeFilesDialog({
  files,
  onConfirm,
  onCancel,
}: {
  files: File[];
  onConfirm: (storageAccountId: string) => void;
  onCancel: () => void;
}) {
  const { version } = useUiVersion();
  const navigate = useNavigate();
  const storage = useStorage();
  const accounts = storage.data?.accounts ?? [];
  const [chosenId, setChosenId] = useState(lastAccount());
  const account = accounts.find((a) => a.id === chosenId) ?? accounts[0];
  const service = account ? STORAGE_PROVIDERS[account.provider].name : 'cloud storage';
  const limit = formatBytes(MAX_ATTACHMENT_BYTES);
  const names = files.map((file) => `${file.name} (${formatBytes(file.size)})`).join(', ');
  const confirm = () => {
    if (!account) return;
    rememberAccount(account.id);
    onConfirm(account.id);
  };

  if (!storage.isPending && !account) {
    const title = 'Large files need cloud storage';
    const text = `Attachments larger than ${limit} are shared by link from Google Drive, OneDrive or Dropbox. Connect one in Settings, then attach ${names} again.`;
    const open = () => {
      onCancel();
      void navigate('/settings/integrations');
    };
    return version === 'v2' ? (
      <Modal
        visible
        onDismiss={onCancel}
        header={title}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={onCancel}>
                Cancel
              </Button>
              <Button variant="primary" onClick={open}>
                Open Settings
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        {text}
      </Modal>
    ) : (
      <Dialog title={title} confirmLabel="Open Settings" onConfirm={open} onCancel={onCancel}>
        {text}
      </Dialog>
    );
  }

  const title = `Large files must be shared with ${service}`;
  const text = `Attachments larger than ${limit} will be uploaded to ${service}. A download link will be included in your email, and anyone with it can open the file.`;

  if (version === 'v2') {
    return (
      <Modal
        visible
        onDismiss={onCancel}
        header={title}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={onCancel}>
                Cancel
              </Button>
              <Button variant="primary" disabled={!account} onClick={confirm}>
                OK, got it
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <Box>{text}</Box>
          <Box color="text-body-secondary">{names}</Box>
          {accounts.length > 1 && account && (
            <FormField label="Storage account">
              <Select
                triggerVariant="option"
                selectedOption={{
                  value: account.id,
                  label: account.email,
                  iconSvg: <ProviderLogo provider={account.provider} size={16} />,
                }}
                options={accounts.map((a) => ({
                  value: a.id,
                  label: a.email,
                  description: STORAGE_PROVIDERS[a.provider].name,
                  iconSvg: <ProviderLogo provider={a.provider} size={16} />,
                }))}
                onChange={({ detail }) => setChosenId(detail.selectedOption.value)}
              />
            </FormField>
          )}
        </SpaceBetween>
      </Modal>
    );
  }

  return (
    <Dialog title={title} confirmLabel="OK, got it" onConfirm={confirm} onCancel={onCancel}>
      <div className={styles.body}>
        <div className={styles.text}>
          <p>{text}</p>
          <small>{names}</small>
        </div>
        {account && <ProviderLogo provider={account.provider} size={64} />}
      </div>
      {accounts.length > 1 && account && (
        <div className={styles.picker}>
          <StorageAccountPicker accounts={accounts} value={account} onChange={setChosenId} />
        </div>
      )}
    </Dialog>
  );
}
