import Box from '@cloudscape-design/components/box';
import CloudscapeButton from '@cloudscape-design/components/button';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Modal from '@cloudscape-design/components/modal';
import Select from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { useState } from 'react';
import type { StorageAccount } from '../../api/settings';
import { ProviderLogo } from '../../storage/ProviderLogo';
import { STORAGE_PROVIDERS, storagePathLabel } from '../../storage/providers';
import { useUiVersion } from '../../theme/UiVersionProvider';
import { Dialog } from '../../ui/Dialog';
import { TextField } from '../../ui/TextField';
import styles from './Attachments.module.css';

export interface StorageTarget {
  account: StorageAccount;
  path: string;
}

// Picks the storage account and folder to save to; the folder starts as the account's default
// from Settings and can be changed for this save.
export function SaveToStorageDialog({
  title,
  count,
  accounts,
  initialAccountId,
  onConfirm,
  onCancel,
}: {
  title: string;
  count: number;
  accounts: StorageAccount[];
  initialAccountId: string | undefined;
  onConfirm: (target: StorageTarget) => void;
  onCancel: () => void;
}) {
  const { version } = useUiVersion();
  const first = accounts.find((a) => a.id === initialAccountId) ?? accounts[0]!;
  const [account, setAccount] = useState(first);
  const [path, setPath] = useState(first.defaultPath);
  const provider = STORAGE_PROVIDERS[account.provider];
  const choose = (id: string) => {
    const next = accounts.find((a) => a.id === id);
    if (!next) return;
    setAccount(next);
    setPath(next.defaultPath);
  };
  const confirm = () => onConfirm({ account, path });
  const what = count === 1 ? '1 file' : `${count} files`;
  const option = (a: StorageAccount) => ({
    value: a.id,
    label: a.email,
    labelTag: STORAGE_PROVIDERS[a.provider].name,
    iconUrl: STORAGE_PROVIDERS[a.provider].logo,
    iconAlt: '',
  });

  if (version === 'v2') {
    return (
      <Modal
        visible
        onDismiss={onCancel}
        header={title}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <CloudscapeButton variant="link" onClick={onCancel}>
                Cancel
              </CloudscapeButton>
              <CloudscapeButton variant="primary" onClick={confirm}>
                Save
              </CloudscapeButton>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <Box>Save {what} to your cloud storage.</Box>
          <FormField label="Storage account">
            <Select
              selectedOption={option(account)}
              options={accounts.map(option)}
              onChange={({ detail }) => choose(detail.selectedOption.value ?? '')}
            />
          </FormField>
          <FormField
            label="Folder"
            constraintText={`Leave empty for the top of ${provider.rootName}. Saves to: ${storagePathLabel(path, account.provider)}`}
          >
            <Input
              value={path}
              placeholder="OneBox/Receipts"
              onChange={({ detail }) => setPath(detail.value)}
            />
          </FormField>
        </SpaceBetween>
      </Modal>
    );
  }

  return (
    <Dialog title={title} confirmLabel="Save" onConfirm={confirm} onCancel={onCancel}>
      <div className={styles.storageForm}>
        <span>Save {what} to your cloud storage.</span>
        <div role="radiogroup" aria-label="Storage account" className={styles.storageAccounts}>
          {accounts.map((a) => (
            <label
              key={a.id}
              className={`${styles.storageAccount} ${a.id === account.id ? styles.storageChosen : ''}`}
            >
              <input
                type="radio"
                name="storage-account"
                checked={a.id === account.id}
                onChange={() => choose(a.id)}
              />
              <ProviderLogo provider={a.provider} size={22} />
              <span className={styles.storageWho}>
                <span>{a.email}</span>
                <small>{STORAGE_PROVIDERS[a.provider].name}</small>
              </span>
            </label>
          ))}
        </div>
        <TextField
          label="Folder"
          value={path}
          onChange={(event) => setPath(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && confirm()}
          hint={`Saves to: ${storagePathLabel(path, account.provider)}`}
        />
      </div>
    </Dialog>
  );
}
