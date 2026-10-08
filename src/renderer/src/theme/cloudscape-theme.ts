import { applyTheme, type Theme } from '@cloudscape-design/components/theming';

const both = (light: string, dark: string) => ({ light, dark });

// Maps Cloudscape's palette onto the OneBox tokens in tokens.css so both UI kits read as one.
export const oneboxCloudscapeTheme: Theme = {
  tokens: {
    colorBackgroundLayoutMain: both('#f0f4f9', '#1b1b1b'),
    colorBackgroundContainerContent: both('#ffffff', '#2c2c2c'),
    colorBackgroundContainerHeader: both('#ffffff', '#2c2c2c'),
    colorBackgroundInputDefault: both('#ffffff', '#2c2c2c'),
    colorBorderDividerDefault: both('#e3e6ea', '#363636'),
    colorBorderContainerTop: both('#e3e6ea', '#363636'),
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
