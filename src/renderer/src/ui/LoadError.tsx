import Alert from '@cloudscape-design/components/alert';
import Button from '@cloudscape-design/components/button';
import { describeError } from '../auth/errors';

// Something failed to load: AWS's outlined alert, with a retry when one makes sense.
export function LoadError({
  error,
  header = 'Could not load this',
  onRetry,
}: {
  error: unknown;
  header?: string;
  onRetry?: () => void;
}) {
  return (
    <Alert
      type="error"
      header={header}
      action={onRetry && <Button onClick={onRetry}>Try again</Button>}
    >
      {describeError(error)}
    </Alert>
  );
}
