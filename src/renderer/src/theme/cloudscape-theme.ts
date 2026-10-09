import { applyTheme, type Theme } from '@cloudscape-design/components/theming';

const both = (light: string, dark: string) => ({ light, dark });

// Maps Cloudscape's palette onto the OneBox tokens in tokens.css so both UI kits read as one.
export const oneboxCloudscapeTheme: Theme = {
  tokens: {
    colorBackgroundLayoutMain: both('#f0f4f9', '#171717'),
    colorBackgroundContainerContent: both('#ffffff', '#1e1f20'),
    colorBackgroundContainerHeader: both('#ffffff', '#1e1f20'),
    colorBackgroundInputDefault: both('#ffffff', '#2c2c2c'),
    colorBorderDividerDefault: both('#e3e6ea', '#2a2b2d'),
    colorBorderContainerTop: both('#e3e6ea', '#2a2b2d'),
    colorBackgroundItemSelected: both('#e8f0fe', '#1c2b45'),
    colorBorderItemSelected: both('#0b57d0', '#a8c7fa'),
    colorBorderItemFocused: both('#0b57d0', '#a8c7fa'),
    colorBackgroundControlChecked: both('#0b57d0', '#a8c7fa'),
    colorBackgroundButtonPrimaryDefault: both('#0b57d0', '#a8c7fa'),
    colorBackgroundButtonPrimaryHover: both('#0842a0', '#d3e3fd'),
    colorBackgroundButtonPrimaryActive: both('#0842a0', '#d3e3fd'),
    colorTextButtonPrimaryDefault: both('#ffffff', '#062e6f'),
    colorTextAccent: both('#0b57d0', '#a8c7fa'),
    colorTextLinkDefault: both('#0b57d0', '#a8c7fa'),
    colorTextHeadingDefault: both('#1f1f1f', '#e3e3e3'),
    colorTextBodyDefault: both('#1f1f1f', '#e3e3e3'),
  },
};

export const applyCloudscapeTheme = () => applyTheme({ theme: oneboxCloudscapeTheme });

// v2 keeps AWS's palette, but its top bar follows light mode instead of staying dark.
const lightBar = (light: string) => ({ light });
export const consoleTheme: Theme = {
  tokens: {},
  contexts: {
    'top-navigation': {
      tokens: {
        colorBackgroundContainerContent: lightBar('#ffffff'),
        colorBackgroundDropdownItemDefault: lightBar('#ffffff'),
        colorBackgroundDropdownItemHover: lightBar('#f3f3f7'),
        colorBorderDropdownContainer: lightBar('#b4b4bb'),
        colorBorderDropdownItemHover: lightBar('#8c8c94'),
        colorBorderDividerDefault: lightBar('#c6c6cd'),
        colorTextTopNavigationTitle: lightBar('#0f141a'),
        colorTextInteractiveDefault: lightBar('#424650'),
        colorTextInteractiveHover: lightBar('#0f141a'),
        colorTextInteractiveActive: lightBar('#0f141a'),
        colorTextBodyDefault: lightBar('#0f141a'),
        colorTextBodySecondary: lightBar('#424650'),
        colorTextHeadingDefault: lightBar('#0f141a'),
        colorTextDropdownItemDefault: lightBar('#0f141a'),
        colorTextDropdownItemHighlighted: lightBar('#0f141a'),
        colorTextDropdownItemSecondary: lightBar('#656871'),
      },
    },
  },
};

export const applyConsoleTheme = () => applyTheme({ theme: consoleTheme });
