import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACCOUNT_COLORS, accountColor, accountLabel } from './account-color';
import { ProviderLogo } from './ProviderLogo';

describe('ProviderLogo', () => {
  it.each([
    ['GMAIL', 'Gmail'],
    ['OUTLOOK', 'Outlook'],
    ['ICLOUD', 'iCloud'],
    ['YAHOO', 'Yahoo'],
    ['IMAP', 'IMAP'],
  ] as const)('labels %s for screen readers', (provider, label) => {
    render(<ProviderLogo provider={provider} />);
    expect(screen.getByRole('img', { name: label })).toBeInTheDocument();
  });

  it('uses the Simple Icons mark for Gmail', () => {
    const { container } = render(<ProviderLogo provider="GMAIL" />);
    expect(container.querySelector('path')?.getAttribute('fill')).toBe('#EA4335');
  });

  it('uses a monogram rather than a trademarked mark for Outlook', () => {
    render(<ProviderLogo provider="OUTLOOK" />);
    expect(screen.getByRole('img', { name: 'Outlook' })).toHaveTextContent('O');
  });
});

describe('accountColor', () => {
  it('is stable per account and drawn from the palette', () => {
    const id = '50bc6cff-8069-4da6-8361-e544fb24a365';
    expect(accountColor(id)).toBe(accountColor(id));
    expect(ACCOUNT_COLORS).toContain(accountColor(id));
  });

  it('spreads accounts across colours', () => {
    const colors = new Set(Array.from({ length: 40 }, (_, i) => accountColor(`account-${i}`)));
    expect(colors.size).toBeGreaterThan(4);
  });
});

describe('accountLabel', () => {
  it('prefers the display name', () => {
    expect(accountLabel({ displayName: 'Work', emailAddress: 'me@corp.example' })).toBe('Work');
    expect(accountLabel({ displayName: null, emailAddress: 'me@gmail.com' })).toBe('me@gmail.com');
  });
});
