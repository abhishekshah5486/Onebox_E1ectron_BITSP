import AppLayout from '@cloudscape-design/components/app-layout';
import Spinner from '@cloudscape-design/components/spinner';
import TopNavigation from '@cloudscape-design/components/top-navigation';
import { Suspense, useState } from 'react';
import { Outlet, useNavigate } from 'react-router';
import { useAuth, useCurrentUser } from '../auth/AuthProvider';
import { useTheme, type ThemePreference } from '../theme/ThemeProvider';
import { Icon } from '../ui/Icon';
import { VersionSwitch } from '../ui/VersionSwitch';
import { ConsoleNavigation } from './ConsoleNavigation';

const NEXT_THEME: Record<ThemePreference, ThemePreference> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};
const THEME_LABEL: Record<ThemePreference, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

export function ConsoleShell() {
  const user = useCurrentUser();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { preference, setPreference } = useTheme();
  const [navigationOpen, setNavigationOpen] = useState(true);

  return (
    <>
      <div id="onebox-top-nav" style={{ position: 'sticky', top: 0, zIndex: 1002 }}>
        <TopNavigation
          identity={{
            href: '/inbox',
            title: 'OneBox',
            onFollow: (event) => {
              event.preventDefault();
              void navigate('/inbox');
            },
          }}
          search={
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <VersionSwitch />
            </div>
          }
          utilities={[
            {
              type: 'button',
              iconSvg: <Icon name={preference} size={16} />,
              ariaLabel: `Theme: ${THEME_LABEL[preference]}. Switch to ${THEME_LABEL[NEXT_THEME[preference]]}`,
              title: `Theme: ${THEME_LABEL[preference]}`,
              onClick: () => setPreference(NEXT_THEME[preference]),
            },
            {
              type: 'button',
              iconName: 'settings',
              ariaLabel: 'Settings',
              title: 'Settings',
              onClick: () => void navigate('/settings'),
            },
            {
              type: 'menu-dropdown',
              text: user.name,
              description: user.email,
              iconName: 'user-profile',
              ariaLabel: `Account: ${user.name}`,
              items: [{ id: 'signout', text: 'Sign out' }],
              onItemClick: ({ detail }) => {
                if (detail.id === 'signout') void signOut();
              },
            },
          ]}
        />
      </div>
      <AppLayout
        headerSelector="#onebox-top-nav"
        navigation={<ConsoleNavigation />}
        navigationOpen={navigationOpen}
        onNavigationChange={({ detail }) => setNavigationOpen(detail.open)}
        toolsHide
        contentType="table"
        content={
          <Suspense fallback={<Spinner size="large" />}>
            <Outlet />
          </Suspense>
        }
      />
    </>
  );
}

export default ConsoleShell;
