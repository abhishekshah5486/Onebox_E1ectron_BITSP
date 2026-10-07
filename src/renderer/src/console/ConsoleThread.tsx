import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ContentLayout from '@cloudscape-design/components/content-layout';
import ExpandableSection from '@cloudscape-design/components/expandable-section';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Spinner from '@cloudscape-design/components/spinner';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { Address, Message } from '../api/mail';
import { useThread, useUpdateThread } from '../api/mail-queries';
import { describeError } from '../auth/errors';
import { EmailFrame } from '../mail/EmailFrame';
import { displayName, formatBytes } from '../mail/format';

const recipients = (list: Address[]) => list.map(displayName).join(', ');

function ConsoleMessage({ message, expanded }: { message: Message; expanded: boolean }) {
  const [showImages, setShowImages] = useState(false);
  const files = message.attachments.filter((attachment) => !attachment.inline);
  const from = message.from
    ? `${displayName(message.from)} <${message.from.address}>`
    : '(unknown sender)';

  return (
    <ExpandableSection
      variant="container"
      defaultExpanded={expanded}
      headerText={from}
      headerDescription={`To ${recipients(message.to) || 'undisclosed recipients'} · ${new Date(message.receivedAt).toLocaleString()}`}
    >
      <SpaceBetween size="s">
        {message.htmlBody ? (
          <>
            {message.hasRemoteImages && !showImages && (
              <Alert
                type="info"
                action={<Button onClick={() => setShowImages(true)}>Show images</Button>}
              >
                Images are hidden to protect your privacy.
              </Alert>
            )}
            <EmailFrame html={message.htmlBody} allowRemoteImages={showImages} />
          </>
        ) : (
          <Box variant="pre">{message.textBody}</Box>
        )}
        {files.length > 0 && (
          <Box variant="small" color="text-body-secondary">
            Attachments:{' '}
            {files.map((file) => `${file.filename} (${formatBytes(file.sizeBytes)})`).join(', ')}
          </Box>
        )}
      </SpaceBetween>
    </ExpandableSection>
  );
}

export function ConsoleThread({ basePath }: { basePath: string }) {
  const { threadId = '' } = useParams();
  const navigate = useNavigate();
  const query = useThread(threadId);
  const update = useUpdateThread();
  const markedRead = useRef(false);
  const thread = query.data?.thread;

  useEffect(() => {
    if (thread && thread.unreadCount > 0 && !markedRead.current) {
      markedRead.current = true;
      update.mutate({ id: thread.id, isRead: true });
    }
  }, [thread, update]);

  const back = () => void navigate(basePath);

  if (query.isPending) return <Spinner size="large" />;
  if (query.isError) return <Alert type="error">{describeError(query.error)}</Alert>;

  const { messages } = query.data;
  return (
    <ContentLayout
      header={
        <Header
          variant="h1"
          description={`${messages.length} ${messages.length === 1 ? 'message' : 'messages'}`}
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button iconName="arrow-left" onClick={back}>
                Back
              </Button>
              <Button
                onClick={() => {
                  update.mutate({ id: query.data.thread.id, isRead: false });
                  back();
                }}
              >
                Mark as unread
              </Button>
              <Button
                iconName={query.data.thread.isStarred ? 'star-filled' : 'star'}
                onClick={() =>
                  update.mutate({
                    id: query.data.thread.id,
                    isStarred: !query.data.thread.isStarred,
                  })
                }
              >
                {query.data.thread.isStarred ? 'Unstar' : 'Star'}
              </Button>
            </SpaceBetween>
          }
        >
          {query.data.thread.subject || '(no subject)'}
        </Header>
      }
    >
      <SpaceBetween size="m">
        {messages.map((message, index) => (
          <ConsoleMessage
            key={message.id}
            message={message}
            expanded={index === messages.length - 1 || !message.isRead}
          />
        ))}
      </SpaceBetween>
    </ContentLayout>
  );
}
