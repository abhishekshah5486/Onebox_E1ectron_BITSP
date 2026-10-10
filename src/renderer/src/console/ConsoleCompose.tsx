import Autosuggest from '@cloudscape-design/components/autosuggest';
import BreadcrumbGroup from '@cloudscape-design/components/breadcrumb-group';
import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import ContentLayout from '@cloudscape-design/components/content-layout';
import FileUpload from '@cloudscape-design/components/file-upload';
import Form from '@cloudscape-design/components/form';
import FormField from '@cloudscape-design/components/form-field';
import Header from '@cloudscape-design/components/header';
import Input from '@cloudscape-design/components/input';
import ProgressBar from '@cloudscape-design/components/progress-bar';
import Select from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Spinner from '@cloudscape-design/components/spinner';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import TokenGroup from '@cloudscape-design/components/token-group';
import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { composeApi, useContacts, type Recipient } from '../api/compose';
import { useAccounts, usePreferences } from '../api/queries';
import { useAuth } from '../auth/AuthProvider';
import { describeError } from '../auth/errors';
import type { ComposeRequest } from '../compose/ComposeProvider';
import { emptyComposition, parseRecipients, recipientLabel } from '../compose/model';
import { LargeFilesDialog } from '../compose/LargeFilesDialog';
import { RichEditor, type EditorHandle } from '../compose/RichEditor';
import { useComposition } from '../compose/useComposition';
import { formatBytes } from '../mail/format';

// Addresses as Cloudscape tokens, with people the user has mailed suggested as they type.
function RecipientsField({
  label,
  value,
  onChange,
  errorText,
}: {
  label: string;
  value: Recipient[];
  onChange: (recipients: Recipient[]) => void;
  errorText?: string;
}) {
  const [text, setText] = useState('');
  const [invalid, setInvalid] = useState<string[]>([]);
  const contacts = useContacts(text.trim());
  const taken = new Set(value.map((r) => r.address));
  const add = (input: string) => {
    const { recipients, invalid: bad } = parseRecipients(input);
    const fresh = recipients.filter((r) => !taken.has(r.address));
    if (fresh.length) onChange([...value, ...fresh]);
    setInvalid(bad);
    setText(bad.join(', '));
  };
  return (
    <FormField
      label={label}
      errorText={invalid.length ? `Not an email address: ${invalid.join(', ')}` : errorText}
    >
      <SpaceBetween size="xs">
        <Autosuggest
          value={text}
          ariaLabel={label}
          placeholder="Name or email address"
          enteredTextLabel={(entered) => `Add "${entered}"`}
          empty="Press Enter to add this address"
          options={(contacts.data ?? [])
            .filter((c) => !taken.has(c.address))
            .map((c) => ({ value: c.address, label: c.name ?? c.address, description: c.address }))}
          onChange={({ detail }) => {
            if (/[,;]\s*$/.test(detail.value)) add(detail.value);
            else setText(detail.value);
          }}
          onSelect={({ detail }) => {
            const picked = contacts.data?.find((c) => c.address === detail.value);
            if (picked && !taken.has(picked.address)) {
              onChange([...value, picked]);
              setText('');
            } else {
              add(detail.value);
            }
          }}
          onKeyDown={({ detail }) => {
            if (detail.key === 'Enter' && text.trim()) add(text);
          }}
          onBlur={() => text.trim() && add(text)}
        />
        {value.length > 0 && (
          <TokenGroup
            items={value.map((r) => ({
              label: recipientLabel(r),
              ...(r.name && { description: r.address }),
              dismissLabel: `Remove ${r.address}`,
            }))}
            onDismiss={({ detail }) => onChange(value.filter((_, i) => i !== detail.itemIndex))}
          />
        )}
      </SpaceBetween>
    </FormField>
  );
}

function ComposeEditor({ request }: { request: ComposeRequest }) {
  const navigate = useNavigate();
  const accounts = useAccounts();
  // Once saved, the address names the draft (without reloading), so a refresh reopens it.
  const state = useComposition(request, (draftId) =>
    window.history.replaceState(window.history.state, '', `/compose/${draftId}`),
  );
  const editor = useRef<EditorHandle>(null);
  const { composition, update } = state;
  const [copies, setCopies] = useState(composition.cc.length + composition.bcc.length > 0);
  const [tried, setTried] = useState(false);
  const senders = accounts.data ?? [];
  const sender = senders.find((a) => a.id === composition.accountId);
  const mode = composition.replyTo?.mode;
  const title = mode === 'forward' ? 'Forward email' : mode ? 'Reply' : 'Compose email';
  const location = useLocation();
  // Back to where it was opened from; opened straight from a link, to the inbox instead.
  const leave = () => void (location.key === 'default' ? navigate('/inbox') : navigate(-1));
  const noRecipients = composition.to.length + composition.cc.length + composition.bcc.length === 0;

  return (
    <ContentLayout
      breadcrumbs={
        <BreadcrumbGroup
          ariaLabel="Breadcrumbs"
          onFollow={(event) => {
            event.preventDefault();
            void navigate(event.detail.href);
          }}
          items={[
            { text: 'Mail', href: '/inbox' },
            { text: title, href: '/compose' },
          ]}
        />
      }
      header={
        <Header
          variant="h1"
          description="Write and send an email from one of your connected accounts. Drafts save as you type."
          info={
            state.saveState === 'saving' ? (
              <StatusIndicator type="loading">Saving draft</StatusIndicator>
            ) : state.saveState === 'saved' ? (
              <StatusIndicator type="success">Draft saved</StatusIndicator>
            ) : state.saveState === 'error' ? (
              <StatusIndicator type="error">Draft not saved</StatusIndicator>
            ) : undefined
          }
        >
          {title}
        </Header>
      }
    >
      {state.tooLarge.length > 0 && (
        <LargeFilesDialog
          files={state.tooLarge}
          onCancel={state.keepSmallOnly}
          onConfirm={(accountId) =>
            void state.shareTooLarge(accountId, (html) => editor.current?.insertHtml(html))
          }
        />
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setTried(true);
          // Problems show on their fields, the console way, rather than in a banner.
          if (state.problem) return;
          void state.send().then((sent) => sent && leave());
        }}
      >
        <Form
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="link"
                formAction="none"
                onClick={() => {
                  void state.discard();
                  leave();
                }}
              >
                Discard draft
              </Button>
              <Button
                formAction="none"
                onClick={() => {
                  void state.keep();
                  leave();
                }}
              >
                Save draft
              </Button>
              <Button variant="primary" iconName="send" loading={state.sending}>
                Send
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="l">
            <Container header={<Header variant="h2">Recipients</Header>}>
              <SpaceBetween size="l">
                <FormField
                  label="From"
                  {...(tried &&
                    !composition.accountId && { errorText: 'Choose the account to send from.' })}
                >
                  <Select
                    selectedOption={
                      sender
                        ? {
                            value: sender.id,
                            label: sender.displayName ?? sender.emailAddress,
                            description: sender.emailAddress,
                          }
                        : null
                    }
                    placeholder="Choose an account"
                    options={senders.map((a) => ({
                      value: a.id,
                      label: a.displayName ?? a.emailAddress,
                      description: a.emailAddress,
                    }))}
                    onChange={({ detail }) =>
                      update({ accountId: detail.selectedOption.value ?? null })
                    }
                  />
                </FormField>
                <RecipientsField
                  label="To"
                  value={composition.to}
                  onChange={(to) => update({ to })}
                  {...(tried && noRecipients && { errorText: 'Add at least one recipient.' })}
                />
                {copies ? (
                  <>
                    <RecipientsField
                      label="Cc"
                      value={composition.cc}
                      onChange={(cc) => update({ cc })}
                    />
                    <RecipientsField
                      label="Bcc"
                      value={composition.bcc}
                      onChange={(bcc) => update({ bcc })}
                    />
                  </>
                ) : (
                  <Button variant="inline-link" formAction="none" onClick={() => setCopies(true)}>
                    Add Cc or Bcc
                  </Button>
                )}
              </SpaceBetween>
            </Container>

            <Container header={<Header variant="h2">Message</Header>}>
              <SpaceBetween size="l">
                <FormField label="Subject">
                  <Input
                    value={composition.subject}
                    placeholder="What it's about"
                    onChange={({ detail }) => update({ subject: detail.value })}
                  />
                </FormField>
                <FormField label="Body" stretch>
                  <RichEditor
                    ref={editor}
                    variant="console"
                    initialHtml={composition.html}
                    onChange={(html, text) => update({ html, text })}
                    placeholder="Write your message"
                    autoFocus={mode === 'reply' || mode === 'replyAll'}
                  />
                </FormField>
                <FormField
                  label="Attachments"
                  description="Up to 25 MB attached; larger files are shared by link from your cloud storage."
                  {...(tried &&
                    state.uploads.length > 0 && {
                      errorText: 'Wait for attachments to finish uploading.',
                    })}
                  constraintText={
                    composition.attachments.length
                      ? `${composition.attachments.length} attached, ${formatBytes(
                          composition.attachments.reduce((sum, a) => sum + a.sizeBytes, 0),
                        )}`
                      : undefined
                  }
                >
                  <SpaceBetween size="xs">
                    <FileUpload
                      multiple
                      value={[]}
                      onChange={({ detail }) => void state.addFiles(detail.value)}
                      i18nStrings={{
                        uploadButtonText: (multiple) => (multiple ? 'Choose files' : 'Choose file'),
                        dropzoneText: (multiple) =>
                          multiple ? 'Drop files to attach' : 'Drop file to attach',
                        removeFileAriaLabel: (index) => `Remove file ${index + 1}`,
                        limitShowFewer: 'Show fewer files',
                        limitShowMore: 'Show more files',
                        errorIconAriaLabel: 'Error',
                      }}
                      showFileSize
                    />
                    {state.uploads.map((upload) => (
                      <ProgressBar
                        key={upload.id}
                        label={upload.filename}
                        description={formatBytes(upload.sizeBytes)}
                        value={Math.round(upload.progress * 100)}
                      />
                    ))}
                    {composition.attachments.length > 0 && (
                      <TokenGroup
                        items={composition.attachments.map((a) => ({
                          label: a.filename,
                          description: formatBytes(a.sizeBytes),
                          iconName: 'file',
                          dismissLabel: `Remove ${a.filename}`,
                        }))}
                        onDismiss={({ detail }) =>
                          state.removeAttachment(composition.attachments[detail.itemIndex]!.blobKey)
                        }
                      />
                    )}
                  </SpaceBetween>
                </FormField>
              </SpaceBetween>
            </Container>
          </SpaceBetween>
        </Form>
      </form>
    </ContentLayout>
  );
}

// v2's compose page: a new message, a reply or forward handed over on open, or a saved draft.
export function ConsoleCompose() {
  const { api } = useAuth();
  const { draftId } = useParams();
  const location = useLocation();
  const given = location.state as ComposeRequest | null;
  const draft = useQuery({
    queryKey: ['compose', 'draft', draftId],
    queryFn: () => composeApi.draft(api, draftId!),
    enabled: Boolean(draftId) && !given,
  });

  if (given) return <ComposeEditor key={location.key} request={given} />;
  if (draftId) {
    if (draft.isPending) return <Spinner size="large" />;
    if (draft.isError)
      return <StatusIndicator type="error">{describeError(draft.error)}</StatusIndicator>;
    return <ComposeEditor key={draftId} request={{ composition: draft.data, draftId }} />;
  }
  return <NewMessage />;
}

// Opened from the address bar or the navigation: a blank message from the first account.
function NewMessage() {
  const accounts = useAccounts();
  const preferences = usePreferences();
  if (accounts.isPending || preferences.isPending) return <Spinner size="large" />;
  const sender = accounts.data?.find((a) => a.status === 'CONNECTED') ?? accounts.data?.[0];
  return (
    <ComposeEditor
      request={{ composition: emptyComposition(sender?.id ?? null, preferences.data?.signature) }}
    />
  );
}
