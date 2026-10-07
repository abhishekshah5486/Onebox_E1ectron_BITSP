import type { Provider } from '../api/accounts';

export interface ProviderChoice {
  id: string;
  provider: Provider;
  label: string;
  description: string;
  passwordHelp: string;
  appPasswordUrl?: string;
}

// Hotmail and Live addresses run on Outlook's servers, so they share its preset.
export const PROVIDER_CHOICES: ProviderChoice[] = [
  {
    id: 'gmail',
    provider: 'GMAIL',
    label: 'Gmail',
    description: 'gmail.com and Google Workspace',
    passwordHelp:
      'Use a Gmail app password, not your normal password (2-Step Verification must be on).',
    appPasswordUrl: 'https://myaccount.google.com/apppasswords',
  },
  {
    id: 'outlook',
    provider: 'OUTLOOK',
    label: 'Outlook',
    description: 'outlook.com and Microsoft 365',
    passwordHelp: 'Use your Microsoft password, or an app password if two-step verification is on.',
  },
  {
    id: 'hotmail',
    provider: 'OUTLOOK',
    label: 'Hotmail',
    description: 'hotmail.com and live.com',
    passwordHelp: 'Use your Microsoft password, or an app password if two-step verification is on.',
  },
  {
    id: 'icloud',
    provider: 'ICLOUD',
    label: 'iCloud',
    description: 'icloud.com, me.com, mac.com',
    passwordHelp: 'Apple requires an app-specific password: Apple Account → Sign-In and Security.',
    appPasswordUrl: 'https://account.apple.com/account/manage',
  },
  {
    id: 'yahoo',
    provider: 'YAHOO',
    label: 'Yahoo',
    description: 'yahoo.com and ymail.com',
    passwordHelp: 'Generate an app password in Yahoo Account Security.',
    appPasswordUrl: 'https://login.yahoo.com/account/security',
  },
  {
    id: 'imap',
    provider: 'IMAP',
    label: 'Other IMAP',
    description: 'Any other mail server',
    passwordHelp: 'The password your mail provider gives you for IMAP access.',
  },
];
