import Container from '@cloudscape-design/components/container';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import KeyValuePairs from '@cloudscape-design/components/key-value-pairs';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Tiles from '@cloudscape-design/components/tiles';
import { useCurrentUser } from '../auth/AuthProvider';
import { useTheme, type ThemePreference } from '../theme/ThemeProvider';
import { AccountsSection } from './AccountsSection';
import { FlashProvider } from './flash';
import { IntegrationsSection } from './IntegrationsSection';
import { PreferencesSection } from './PreferencesSection';
import styles from './SettingsPage.module.css';

export function SettingsPage() {
  const user = useCurrentUser();
  const { preference, setPreference } = useTheme();

  return (
    <div className={styles.panel}>
      <ContentLayout header={<Header variant="h1">Settings</Header>}>
        <FlashProvider>
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
        </FlashProvider>
      </ContentLayout>
    </div>
  );
}

export default SettingsPage;
