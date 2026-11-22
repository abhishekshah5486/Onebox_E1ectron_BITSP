import Box from '@cloudscape-design/components/box';
import Modal from '@cloudscape-design/components/modal';
import Wizard from '@cloudscape-design/components/wizard';
import { useState } from 'react';
import { usePreferences, useUpdatePreferences } from '../api/queries';
import { FlashProvider } from './flash';
import { IndexingStorageSection } from './IndexingStorageSection';
import { ModelProvidersSection } from './ModelProvidersSection';
import { StorageSection } from './StorageSection';

const STEPS = [
  {
    title: 'AI model',
    description:
      'OneBox works out of the box. To use your own provider and key for AI features, configure it here.',
    content: <ModelProvidersSection kind="llm" />,
  },
  {
    title: 'Embedding model',
    description:
      'Semantic search finds mail by meaning. Bring your own embedding model if you like.',
    content: <ModelProvidersSection kind="embedding" />,
  },
  {
    title: 'Indexing storage',
    description: 'Keep search vectors on OneBox, or in your own Qdrant.',
    content: <IndexingStorageSection />,
  },
  {
    title: 'Cloud storage',
    description: 'Connect somewhere to save attachments to.',
    content: <StorageSection />,
  },
];

// Shown once to new users: every step is optional, and all of it is in Settings later.
export function SetupWizard() {
  const preferences = usePreferences();
  const update = useUpdatePreferences();
  const [step, setStep] = useState(0);
  const [closed, setClosed] = useState(false);
  if (closed || preferences.data?.setupDone !== false) return null;

  const finish = () => {
    setClosed(true);
    update.mutate({ setupDone: true });
  };

  return (
    <Modal visible size="max" onDismiss={finish} header="Set up OneBox">
      <FlashProvider>
        <Wizard
          activeStepIndex={step}
          allowSkipTo
          onNavigate={({ detail }) => setStep(detail.requestedStepIndex)}
          onCancel={finish}
          onSubmit={finish}
          i18nStrings={{
            stepNumberLabel: (n) => `Step ${n}`,
            collapsedStepsLabel: (n, total) => `Step ${n} of ${total}`,
            skipToButtonLabel: () => 'Skip to the end',
            navigationAriaLabel: 'Setup steps',
            cancelButton: 'Skip setup',
            previousButton: 'Back',
            nextButton: 'Next',
            optional: 'optional',
          }}
          submitButtonText="Done"
          steps={STEPS.map((s) => ({ ...s, isOptional: true }))}
        />
        <Box variant="small" color="text-body-secondary" padding={{ top: 's' }}>
          You can change all of this later in Settings.
        </Box>
      </FlashProvider>
    </Modal>
  );
}

export default SetupWizard;
