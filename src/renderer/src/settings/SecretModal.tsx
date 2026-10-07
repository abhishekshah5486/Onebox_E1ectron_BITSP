import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import CopyToClipboard from '@cloudscape-design/components/copy-to-clipboard';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';

export function SecretModal({
  secret,
  onDismiss,
}: {
  secret: string | null;
  onDismiss: () => void;
}) {
  return (
    <Modal
      visible={secret !== null}
      onDismiss={onDismiss}
      header="Webhook signing secret"
      footer={
        <Box float="right">
          <Button variant="primary" onClick={onDismiss}>
            I have saved it
          </Button>
        </Box>
      }
    >
      <SpaceBetween size="m">
        <Alert type="warning">
          Copy this secret now. For your security it will not be shown again.
        </Alert>
        <Box variant="code">
          <CopyToClipboard
            variant="inline"
            textToCopy={secret ?? ''}
            copySuccessText="Secret copied"
            copyErrorText="Could not copy"
          />
        </Box>
        <Box color="text-body-secondary">
          Verify each delivery by recomputing HMAC-SHA256 of <code>timestamp.body</code> with this
          secret and comparing it to the <code>v1</code> value in the{' '}
          <code>x-onebox-signature</code> header.
        </Box>
      </SpaceBetween>
    </Modal>
  );
}
