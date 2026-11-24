import AppLayout from '@cloudscape-design/components/app-layout';
import Spinner from '@cloudscape-design/components/spinner';
import TopNavigation from '@cloudscape-design/components/top-navigation';
import { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { useAuth, useCurrentUser } from '../auth/AuthProvider';
import { useBilling } from '../billing/billing';
import { formatCredits } from '../billing/plans';
import { ComposeProvider } from '../compose/ComposeProvider';
import { FlashArea } from '../settings/flash';
import { useTheme, type ThemePreference } from '../theme/ThemeProvider';
import { Icon } from '../ui/Icon';
import oneboxMark from '../ui/onebox-mark.svg';
import { VersionSwitch } from '../ui/VersionSwitch';
import { useLiveUpdates } from '../api/useLiveUpdates';
import { ConsoleNavigation } from './ConsoleNavigation';
import { applyConsoleTheme } from './consoleTheme';
import { PageLayoutProvider } from './pageLayout';
import { ConsoleSearchBox } from './ConsoleSearchBox';
import styles from './ConsoleShell.module.css';
import { SidebarResizer } from './SidebarResizer';
import { useSidebarWidth } from './useSidebarWidth';

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
  const billing = useBilling();
  const { preference, setPreference } = useTheme();
  const [navigationWidth, setNavigationWidth] = useSidebarWidth();
  // A service page opens with the console's navigation folded away; mail keeps it open.
  const area = useLocation().pathname.startsWith('/knowledge') ? 'service' : 'mail';
  const [open, setOpen] = useState({ mail: true, service: false });
  const navigationOpen = open[area];
  const setNavigationOpen = (value: boolean) => setOpen((o) => ({ ...o, [area]: value }));
  useEffect(() => applyConsoleTheme().reset, []);
  useLiveUpdates();

  return (
    <FlashArea>
      {(banners) => (
        <ComposeProvider>
          <div
            id="onebox-top-nav"
            className={styles.topNav}
            style={{ position: 'sticky', top: 0, zIndex: 1002 }}
          >
            <TopNavigation
              identity={{
                href: '/inbox',
                title: 'OneBox',
                logo: { src: oneboxMark, alt: 'OneBox' },
                onFollow: (event) => {
                  event.preventDefault();
                  void navigate('/inbox');
                },
              }}
              // On narrow windows the search folds into an icon that opens it.
              i18nStrings={{
                searchIconAriaLabel: 'Search',
                searchDismissIconAriaLabel: 'Close search',
                overflowMenuTriggerText: 'More',
                overflowMenuTitleText: 'All',
              }}
              search={
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <ConsoleSearchBox />
                  <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
                    <VersionSwitch />
                  </div>
                </div>
              }
              utilities={[
                ...(billing.data
                  ? [
                      {
                        type: 'button' as const,
                        iconSvg: <Icon name="credit" size={16} />,
                        text: `${formatCredits(billing.data.balance)} credits`,
                        ariaLabel: `${formatCredits(billing.data.balance)} credits left. See plans`,
                        title: 'Credits left. See plans',
                        onClick: () => void navigate('/plans'),
                      },
                    ]
                  : []),
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
          <PageLayoutProvider>
            {(page) => (
              <AppLayout
                headerSelector="#onebox-top-nav"
                navigation={<ConsoleNavigation />}
                navigationWidth={navigationWidth}
                navigationOpen={navigationOpen}
                onNavigationChange={({ detail }) => setNavigationOpen(detail.open)}
                toolsHide
                notifications={banners}
                stickyNotifications
                breadcrumbs={page.breadcrumbs}
                splitPanel={page.splitPanel}
                splitPanelOpen={page.splitPanelOpen}
                onSplitPanelToggle={({ detail }) => page.onSplitPanelToggle?.(detail.open)}
                splitPanelPreferences={{ position: 'side' }}
                contentType={page.contentType ?? 'table'}
                content={
                  <Suspense fallback={<Spinner size="large" />}>
                    <Outlet />
                  </Suspense>
                }
              />
            )}
          </PageLayoutProvider>
          {navigationOpen && (
            <SidebarResizer width={navigationWidth} onResize={setNavigationWidth} />
          )}
        </ComposeProvider>
      )}
    </FlashArea>
  );
}

export default ConsoleShell;
