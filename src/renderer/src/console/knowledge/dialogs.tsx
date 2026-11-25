import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import BreadcrumbGroup from '@cloudscape-design/components/breadcrumb-group';
import Button from '@cloudscape-design/components/button';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Modal from '@cloudscape-design/components/modal';
import RadioGroup from '@cloudscape-design/components/radio-group';
import Select from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { useState, type ReactNode } from 'react';
import { useCollections, useHubNodes } from '../../api/hub';
import { problem } from './parts';

function Footer({
  onCancel,
  onConfirm,
  label,
  busy,
  disabled,
  danger,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  label: string;
  busy: boolean;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Box float="right">
      <SpaceBetween direction="horizontal" size="xs">
        <Button variant="link" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          loading={busy}
          disabled={disabled}
          onClick={onConfirm}
          ariaLabel={danger ? `${label} (cannot be undone)` : undefined}
        >
          {label}
        </Button>
      </SpaceBetween>
    </Box>
  );
}

// Asks for a name (a new collection or folder, or a rename); the server's answer shows in it.
export function NameModal({
  title,
  label,
  initial = '',
  confirm,
  folder = false,
  onSubmit,
  onClose,
}: {
  title: string;
  label: string;
  initial?: string;
  confirm: string;
  folder?: boolean;
  onSubmit: (name: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const local = folder && /[\\/]/.test(name) ? 'Folder names cannot contain "/" or "\\".' : null;
  const submit = async () => {
    if (!name.trim() || local) return;
    setBusy(true);
    try {
      await onSubmit(name.trim());
      onClose();
    } catch (err) {
      setError(problem(err, 'That did not work. Try again.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      visible
      header={title}
      onDismiss={onClose}
      footer={
        <Footer
          onCancel={onClose}
          onConfirm={() => void submit()}
          label={confirm}
          busy={busy}
          disabled={!name.trim() || !!local || name.trim() === initial}
        />
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <FormField label={label} errorText={local ?? error ?? undefined}>
          <Input
            value={name}
            autoFocus
            onChange={({ detail }) => {
              setName(detail.value);
              setError(null);
            }}
          />
        </FormField>
      </form>
    </Modal>
  );
}

export function ConfirmModal({
  title,
  children,
  confirm,
  onConfirm,
  onClose,
  danger = true,
}: {
  title: string;
  children: ReactNode;
  confirm: string;
  onConfirm: () => Promise<unknown>;
  onClose: () => void;
  // Can't be undone (said to screen readers too).
  danger?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(problem(err, 'That did not work. Try again.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      visible
      header={title}
      onDismiss={onClose}
      footer={
        <Footer
          onCancel={onClose}
          onConfirm={() => void run()}
          label={confirm}
          busy={busy}
          danger={danger}
        />
      }
    >
      <SpaceBetween size="m">
        {children}
        {error && <Alert type="error">{error}</Alert>}
      </SpaceBetween>
    </Modal>
  );
}

// Picks where a file goes: a collection, then a folder in it (browsed a level at a time).
export function MoveModal({
  name,
  collectionId,
  onSubmit,
  onClose,
}: {
  name: string;
  collectionId: string;
  onSubmit: (folderId: string | null) => Promise<unknown>;
  onClose: () => void;
}) {
  const collections = useCollections();
  const [trail, setTrail] = useState<{ id: string; name: string }[]>([]);
  const [picked, setPicked] = useState<string>('here');
  const here = trail.at(-1) ?? null;
  const listing = useHubNodes({
    parent: here ? { type: 'folder', id: here.id } : { type: 'collection', id: collectionId },
    sortBy: 'name',
    sortOrder: 'asc',
    limit: 200,
    flattened: false,
  });
  const folders = (listing.data?.items ?? []).filter((n) => n.nodeType === 'folder');
  const collection = collections.data?.find((c) => c.id === collectionId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const target = picked === 'here' ? (here?.id ?? null) : picked;
  const submit = async () => {
    setBusy(true);
    try {
      await onSubmit(target);
      onClose();
    } catch (err) {
      setError(problem(err, 'The file was not moved.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      visible
      header={`Move "${name}"`}
      onDismiss={onClose}
      footer={
        <Footer onCancel={onClose} onConfirm={() => void submit()} label="Move" busy={busy} />
      }
    >
      <SpaceBetween size="m">
        <FormField label="Collection">
          <Select
            selectedOption={collection ? { value: collection.id, label: collection.name } : null}
            options={collection ? [{ value: collection.id, label: collection.name }] : []}
            disabled
            onChange={() => undefined}
          />
        </FormField>
        <BreadcrumbGroup
          ariaLabel="Folder"
          items={[
            { text: collection?.name ?? 'Collection', href: '#' },
            ...trail.map((f) => ({ text: f.name, href: `#${f.id}` })),
          ]}
          onFollow={(e) => {
            e.preventDefault();
            const id = e.detail.href.slice(1);
            setTrail(id ? trail.slice(0, trail.findIndex((f) => f.id === id) + 1) : []);
            setPicked('here');
          }}
        />
        <RadioGroup
          value={picked}
          onChange={({ detail }) => setPicked(detail.value)}
          items={[
            { value: 'here', label: here ? `Into "${here.name}"` : 'Top of the collection' },
            ...folders.map((f) => ({ value: f.id, label: f.name })),
          ]}
        />
        {folders.length > 0 && (
          <SpaceBetween direction="horizontal" size="xs">
            {folders.map((f) => (
              <Button
                key={f.id}
                iconName="folder-open"
                variant="inline-link"
                onClick={() => {
                  setTrail([...trail, { id: f.id, name: f.name }]);
                  setPicked('here');
                }}
              >
                Open {f.name}
              </Button>
            ))}
          </SpaceBetween>
        )}
        {error && <Alert type="error">{error}</Alert>}
      </SpaceBetween>
    </Modal>
  );
}
