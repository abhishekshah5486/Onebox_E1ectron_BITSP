import Container from '@cloudscape-design/components/container';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import KeyValuePairs from '@cloudscape-design/components/key-value-pairs';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Tabs from '@cloudscape-design/components/tabs';
import Tiles from '@cloudscape-design/components/tiles';
import { useNavigate, useParams } from 'react-router';
import { useCurrentUser } from '../auth/AuthProvider';
import { useTheme, type ThemePreference } from '../theme/ThemeProvider';
import { useUiVersion, type UiVersion } from '../theme/UiVersionProvider';
import { BillingSection } from '../billing/BillingSection';
import { AccountsSection } from './AccountsSection';
import { AiSection } from './AiSection';
import { FlashProvider } from './flash';
import { StorageSection } from './StorageSection';
import { IntegrationsSection } from './IntegrationsSection';
import { LabelsSection } from './LabelsSection';
import { PreferencesSection } from './PreferencesSection';
import styles from './SettingsPage.module.css';

const TABS = [
  { id: 'accounts', label: 'Accounts', content: <AccountsSection /> },
  { id: 'mail', label: 'Mail', content: <PreferencesSection /> },
  { id: 'labels', label: 'Labels', content: <LabelsSection /> },
  { id: 'ai', label: 'AI', content: <AiSection /> },
  {
    id: 'integrations',
    label: 'Integrations',
    content: (
      <SpaceBetween size="l">
        <StorageSection />
        <IntegrationsSection />
      </SpaceBetween>
    ),
  },
  { id: 'billing', label: 'Billing', content: <BillingSection /> },
  { id: 'appearance', label: 'Appearance', content: <Appearance /> },
];

export function SettingsPage() {
  const { tab = 'accounts' } = useParams();
  const navigate = useNavigate();
  const { version } = useUiVersion();
  const active = TABS.some((item) => item.id === tab) ? tab : 'accounts';

  const page = (
    <div className={styles.content}>
      <ContentLayout
        header={
          <Header
            variant="h1"
            description="Your mailboxes, how OneBox handles mail, labels and the tools it talks to."
          >
            Settings
          </Header>
        }
      >
        <FlashProvider>
          <Tabs
            activeTabId={active}
            onChange={({ detail }) => void navigate(`/settings/${detail.activeTabId}`)}
            tabs={TABS}
          />
        </FlashProvider>
      </ContentLayout>
    </div>
  );
  // The console (v2) already gives the page its layout; the classic look sits it on a panel.
  return version === 'v2' ? page : <div className={styles.panel}>{page}</div>;
}

function Appearance() {
  const user = useCurrentUser();
  const { preference, setPreference } = useTheme();
  const { version, setVersion } = useUiVersion();
  return (
    <SpaceBetween size="l">
      <Container header={<Header variant="h2">Theme</Header>}>
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
      <Container
        header={
          <Header variant="h2" description="Both versions show the same mail and settings.">
            Interface
          </Header>
        }
      >
        <Tiles
          ariaLabel="Interface"
          value={version}
          onChange={({ detail }) => setVersion(detail.value as UiVersion)}
          items={[
            { value: 'v1', label: 'v1 · Classic', description: 'Gmail-style inbox' },
            { value: 'v2', label: 'v2 · Console', description: 'AWS console-style tables' },
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
    </SpaceBetween>
  );
}

export default SettingsPage;
