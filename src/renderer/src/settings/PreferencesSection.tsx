import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import Form from '@cloudscape-design/components/form';
import FormField from '@cloudscape-design/components/form-field';
import Header from '@cloudscape-design/components/header';
import Select from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Spinner from '@cloudscape-design/components/spinner';
import Textarea from '@cloudscape-design/components/textarea';
import Toggle from '@cloudscape-design/components/toggle';
import { useMemo, useState } from 'react';
import { usePreferences, useUpdatePreferences } from '../api/queries';
import type { AutonomyMode, Preferences } from '../api/settings';
import { describeError } from '../auth/errors';
import { useFlash } from './flash';

const AUTONOMY: { value: AutonomyMode; label: string; description: string }[] = [
  { value: 'MANUAL', label: 'Manual', description: 'AI classifies mail; you write every reply' },
  { value: 'SUGGEST', label: 'Suggest', description: 'AI drafts replies for you to edit and send' },
  { value: 'SEMI', label: 'Approve', description: 'AI queues actions; you approve each one' },
  { value: 'AUTO', label: 'Autonomous', description: 'AI acts on safe actions automatically' },
];

type Draft = Omit<Preferences, 'updatedAt'>;

export function PreferencesSection() {
  const preferences = usePreferences();
  if (!preferences.data) {
    return (
      <Container header={<Header variant="h2">Mail preferences</Header>}>
        {preferences.isError ? describeError(preferences.error) : <Spinner />}
      </Container>
    );
  }
  // Remounting on each save resets the draft to what the server stored.
  return (
    <PreferencesForm key={preferences.data.updatedAt ?? 'defaults'} saved={preferences.data} />
  );
}

function PreferencesForm({ saved }: { saved: Preferences }) {
  const update = useUpdatePreferences();
  const flash = useFlash();
  const [draft, setDraft] = useState<Draft>(() => ({
    markSeenOnFetch: saved.markSeenOnFetch,
    autonomyMode: saved.autonomyMode,
    signature: saved.signature,
    timezone: saved.timezone,
  }));

  const timezones = useMemo(
    () => Intl.supportedValuesOf('timeZone').map((zone) => ({ value: zone, label: zone })),
    [],
  );

  const changes = Object.fromEntries(
    Object.entries(draft).filter(([key, value]) => saved[key as keyof Draft] !== value),
  ) as Partial<Draft>;
  const dirty = Object.keys(changes).length > 0;
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft({ ...draft, [key]: value });
  const autonomy = AUTONOMY.find((option) => option.value === draft.autonomyMode)!;

  return (
    <Container header={<Header variant="h2">Mail preferences</Header>}>
      <Form
        actions={
          <Button
            variant="primary"
            disabled={!dirty}
            loading={update.isPending}
            onClick={() =>
              update.mutate(
                {
                  ...changes,
                  ...(changes.signature !== undefined && { signature: changes.signature || null }),
                },
                {
                  onSuccess: () => flash({ type: 'success', content: 'Preferences saved.' }),
                  onError: (error) => flash({ type: 'error', content: describeError(error) }),
                },
              )
            }
          >
            Save preferences
          </Button>
        }
      >
        <SpaceBetween size="l">
          <FormField
            label="Read status"
            description="When off, OneBox leaves new mail unread in Gmail, Outlook and other mail apps."
          >
            <Toggle
              checked={draft.markSeenOnFetch}
              onChange={({ detail }) => set('markSeenOnFetch', detail.checked)}
            >
              Mark messages as read in my mailbox when OneBox fetches them
            </Toggle>
          </FormField>
          <FormField label="AI autonomy" description={autonomy.description}>
            <Select
              ariaLabel="AI autonomy"
              selectedOption={autonomy}
              options={AUTONOMY}
              onChange={({ detail }) =>
                set('autonomyMode', detail.selectedOption.value as AutonomyMode)
              }
            />
          </FormField>
          <FormField
            label="Time zone"
            description="Used for dates, schedules and meeting detection."
          >
            <Select
              ariaLabel="Time zone"
              filteringType="auto"
              selectedOption={{ value: draft.timezone, label: draft.timezone }}
              options={timezones}
              onChange={({ detail }) => set('timezone', detail.selectedOption.value!)}
            />
          </FormField>
          <FormField label="Signature" description="Added to replies OneBox drafts for you.">
            <Textarea
              ariaLabel="Signature"
              rows={3}
              value={draft.signature ?? ''}
              onChange={({ detail }) => set('signature', detail.value)}
            />
          </FormField>
        </SpaceBetween>
      </Form>
    </Container>
  );
}
