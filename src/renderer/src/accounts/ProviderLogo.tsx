import { siGmail, siIcloud } from 'simple-icons';
import type { Provider } from '../api/accounts';

const LABEL: Record<Provider, string> = {
  GMAIL: 'Gmail',
  OUTLOOK: 'Outlook',
  ICLOUD: 'iCloud',
  YAHOO: 'Yahoo',
  IMAP: 'IMAP',
};

// Gmail and iCloud marks come from Simple Icons (CC0). Microsoft and Yahoo asked for their marks to
// be removed there, so they get a neutral monogram in their brand colour instead.
const MONOGRAM: Partial<Record<Provider, { letter: string; color: string }>> = {
  OUTLOOK: { letter: 'O', color: '#0078D4' },
  YAHOO: { letter: 'Y', color: '#6001D2' },
};

export function ProviderLogo({ provider, size = 20 }: { provider: Provider; size?: number }) {
  const label = LABEL[provider];
  const icon = provider === 'GMAIL' ? siGmail : provider === 'ICLOUD' ? siIcloud : null;

  if (icon) {
    return (
      <svg role="img" aria-label={label} width={size} height={size} viewBox="0 0 24 24">
        <path d={icon.path} fill={`#${icon.hex}`} />
      </svg>
    );
  }

  const monogram = MONOGRAM[provider];
  if (monogram) {
    return (
      <svg role="img" aria-label={label} width={size} height={size} viewBox="0 0 24 24">
        <rect width="24" height="24" rx="6" fill={monogram.color} />
        <text
          x="12"
          y="17"
          textAnchor="middle"
          fontSize="14"
          fontWeight="700"
          fill="#fff"
          fontFamily="Arial, sans-serif"
        >
          {monogram.letter}
        </text>
      </svg>
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
