import { applyTheme } from '@cloudscape-design/components/theming';

// Panels stand apart from the page: a darker page behind lighter, bordered containers.
export function applyConsoleTheme() {
  return applyTheme({
    theme: {
      tokens: {
        colorBackgroundLayoutMain: { light: '#f2f3f7', dark: '#0b0c0e' },
        colorBackgroundContainerContent: { light: '#ffffff', dark: '#18191c' },
        colorBackgroundContainerHeader: { light: '#ffffff', dark: '#18191c' },
        colorBorderContainerTop: { light: '#dcdee6', dark: '#33353b' },
        colorBorderDividerDefault: { light: '#dcdee6', dark: '#2c2e33' },
      },
    },
  });
}
