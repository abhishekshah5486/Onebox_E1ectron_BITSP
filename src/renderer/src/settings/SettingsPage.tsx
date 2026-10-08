import Container from '@cloudscape-design/components/container';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import KeyValuePairs from '@cloudscape-design/components/key-value-pairs';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Tabs from '@cloudscape-design/components/tabs';
import Tiles from '@cloudscape-design/components/tiles';
import { useLocation, useNavigate } from 'react-router';
import { useCurrentUser } from '../auth/AuthProvider';
import { useTheme, type ThemePreference } from '../theme/ThemeProvider';
import { useUiVersion, type UiVersion } from '../theme/UiVersionProvider';
import { AccountsSection } from './AccountsSection';
import { FlashProvider } from './flash';
import { IntegrationsSection } from './IntegrationsSection';
import { LabelsSection } from './LabelsSection';
import { PreferencesSection } from './PreferencesSection';
import styles from './SettingsPage.module.css';

export function SettingsPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const tab = pathname === '/settings/labels' ? 'labels' : 'general';

  return (
    <div className={styles.panel}>
      <ContentLayout header={<Header variant="h1">Settings</Header>}>
        <FlashProvider>
          <Tabs
            activeTabId={tab}
            onChange={({ detail }) =>
              void navigate(detail.activeTabId === 'labels' ? '/settings/labels' : '/settings')
            }
            tabs={[
              { id: 'general', label: 'General', content: <General /> },
              { id: 'labels', label: 'Labels', content: <LabelsSection /> },
            ]}
          />
        </FlashProvider>
      </ContentLayout>
    </div>
  );
}

function General() {
  const user = useCurrentUser();
  const { preference, setPreference } = useTheme();
  const { version, setVersion } = useUiVersion();
  return (
    <SpaceBetween size="l">
      <AccountsSection />
      <PreferencesSection />
      <IntegrationsSection />

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
