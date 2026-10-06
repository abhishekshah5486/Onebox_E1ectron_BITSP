import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import KeyValuePairs from '@cloudscape-design/components/key-value-pairs';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Table from '@cloudscape-design/components/table';
import Tiles from '@cloudscape-design/components/tiles';
import { useCurrentUser } from '../auth/AuthProvider';
import { useTheme, type ThemePreference } from '../theme/ThemeProvider';
import styles from './SettingsPage.module.css';

const INTEGRATIONS = [
  { id: 'slack', name: 'Slack', description: 'Post alerts for important email to a channel' },
  {
    id: 'webhook',
    name: 'Outgoing webhooks',
    description: 'Send signed events to your own systems',
  },
];

export function SettingsPage() {
  const user = useCurrentUser();
  const { preference, setPreference } = useTheme();

  return (
    <div className={styles.panel}>
      <ContentLayout header={<Header variant="h1">Settings</Header>}>
        <SpaceBetween size="l">
          <Container header={<Header variant="h2">Appearance</Header>}>
            <Tiles
              ariaLabel="Theme"
              value={preference}
              onChange={({ detail }) => setPreference(detail.value as ThemePreference)}
              items={[
                { value: 'light', label: 'Light', description: 'Bright background' },
                { value: 'dark', label: 'Dark', description: 'Easier on the eyes at night' },
                { value: 'system', label: 'System', description: 'Match your device' },
              ]}
            />
          </Container>

          <Container header={<Header variant="h2">Profile</Header>}>
            <KeyValuePairs
              columns={3}
              items={[
                { label: 'Name', value: user.name },
                { label: 'Email', value: user.email },
                { label: 'Member since', value: new Date(user.createdAt).toLocaleDateString() },
              ]}
            />
          </Container>

          <Table
            header={
              <Header
                variant="h2"
                description="Mailboxes OneBox syncs into your unified inbox"
                actions={<Button disabled>Add account</Button>}
              >
                Connected accounts
              </Header>
            }
            columnDefinitions={[
              { id: 'email', header: 'Email', cell: (item: { email: string }) => item.email },
              { id: 'provider', header: 'Provider', cell: () => '' },
              { id: 'status', header: 'Status', cell: () => '' },
            ]}
            items={[]}
            empty={
              <Box textAlign="center" color="inherit">
                <b>No accounts connected</b>
                <Box variant="p" color="inherit">
                  Connecting Gmail, Outlook and IMAP accounts arrives with the accounts service.
                </Box>
              </Box>
            }
          />

          <Table
            header={
              <Header variant="h2" description="Bring OneBox events into the tools you use">
                Integrations
              </Header>
            }
            columnDefinitions={[
              { id: 'name', header: 'Integration', cell: (item) => item.name },
              { id: 'description', header: 'Description', cell: (item) => item.description },
              {
                id: 'status',
                header: 'Status',
                cell: () => <StatusIndicator type="stopped">Not configured</StatusIndicator>,
              },
            ]}
            items={INTEGRATIONS}
            trackBy="id"
          />
        </SpaceBetween>
      </ContentLayout>
    </div>
  );
}
