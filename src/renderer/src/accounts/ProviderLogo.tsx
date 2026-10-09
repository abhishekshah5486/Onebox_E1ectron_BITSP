import type { Provider } from '../api/accounts';
import gmail from './logos/gmail.png';
import icloud from './logos/icloud.svg';
import outlook from './logos/outlook.svg';
import yahoo from './logos/yahoo.svg';

const LABEL: Record<Provider, string> = {
  GMAIL: 'Gmail',
  OUTLOOK: 'Outlook',
  ICLOUD: 'iCloud',
  YAHOO: 'Yahoo',
  IMAP: 'IMAP',
};

// Rendered through <img>, so a logo file can never run script inside the app.
const LOGO: Partial<Record<Provider, string>> = {
  GMAIL: gmail,
  OUTLOOK: outlook,
  ICLOUD: icloud,
  YAHOO: yahoo,
};

export function ProviderLogo({ provider, size = 20 }: { provider: Provider; size?: number }) {
  const label = LABEL[provider];
  const src = LOGO[provider];
  if (src) {
    return (
      <img src={src} alt={label} width={size} height={size} style={{ objectFit: 'contain' }} />
    );
  }

  return (
    <svg role="img" aria-label={label} width={size} height={size} viewBox="0 0 24 24">
      <rect width="24" height="24" rx="6" fill="#5f6368" />
      <path
        d="M6 8h12v8H6z M6 8l6 4.5L18 8"
        fill="none"
        stroke="#fff"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
