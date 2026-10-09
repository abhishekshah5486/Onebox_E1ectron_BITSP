import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Modal from '@cloudscape-design/components/modal';
import Select from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import CloudscapeButton from '@cloudscape-design/components/button';
import Box from '@cloudscape-design/components/box';
import { useState } from 'react';
import type { DriveAccount } from '../../api/settings';
import { useUiVersion } from '../../theme/UiVersionProvider';
import { Dialog } from '../../ui/Dialog';
import { TextField } from '../../ui/TextField';
import styles from './Attachments.module.css';
import { drivePathLabel } from './drivePath';

export interface DriveTarget {
  accountId: string;
  path: string;
}

// Picks the Google account and folder for "Add to Drive"; the folder starts as the account's
// default from Settings and can be changed for this save.
export function SaveToDriveDialog({
  count,
  accounts,
  initialAccountId,
  onConfirm,
  onCancel,
}: {
  count: number;
  accounts: DriveAccount[];
  initialAccountId: string | undefined;
  onConfirm: (target: DriveTarget) => void;
  onCancel: () => void;
}) {
  const { version } = useUiVersion();
  const first = accounts.find((a) => a.id === initialAccountId) ?? accounts[0]!;
  const [account, setAccount] = useState(first);
  const [path, setPath] = useState(first.defaultPath);
  const choose = (id: string) => {
    const next = accounts.find((a) => a.id === id);
    if (!next) return;
    setAccount(next);
    setPath(next.defaultPath);
  };
  const confirm = () => onConfirm({ accountId: account.id, path });
  const what = count === 1 ? '1 file' : `${count} files`;

  if (version === 'v2') {
    return (
      <Modal
        visible
        onDismiss={onCancel}
        header="Add to Drive"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <CloudscapeButton variant="link" onClick={onCancel}>
                Cancel
              </CloudscapeButton>
              <CloudscapeButton variant="primary" onClick={confirm}>
                Add to Drive
              </CloudscapeButton>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <Box>Save {what} to Google Drive.</Box>
          <FormField label="Google account">
            <Select
              selectedOption={{ value: account.id, label: account.email }}
              options={accounts.map((a) => ({ value: a.id, label: a.email }))}
              onChange={({ detail }) => choose(detail.selectedOption.value ?? '')}
            />
          </FormField>
          <FormField
            label="Folder"
            constraintText={`Leave empty for the top of My Drive. Saves to: ${drivePathLabel(path)}`}
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
    <Dialog
      title="Add to Drive"
      confirmLabel="Add to Drive"
      onConfirm={confirm}
      onCancel={onCancel}
    >
      <div className={styles.driveForm}>
        <span>Save {what} to Google Drive.</span>
        {accounts.length > 1 && (
          <div role="radiogroup" aria-label="Google account" className={styles.driveAccounts}>
            {accounts.map((a) => (
              <label key={a.id} className={styles.driveAccount}>
                <input
                  type="radio"
                  name="drive-account"
                  checked={a.id === account.id}
                  onChange={() => choose(a.id)}
                />
                {a.email}
              </label>
            ))}
          </div>
        )}
        {accounts.length === 1 && <span className={styles.driveOnly}>{account.email}</span>}
        <TextField
          label="Folder"
          value={path}
          onChange={(event) => setPath(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && confirm()}
          hint={`Saves to: ${drivePathLabel(path)}`}
        />
      </div>
    </Dialog>
  );
}
