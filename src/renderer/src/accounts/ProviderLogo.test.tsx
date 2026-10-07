import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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

  it('uses the official logo file for Gmail', () => {
    render(<ProviderLogo provider="GMAIL" />);
    // Vite inlines small SVGs as data URIs and serves larger ones by file name.
    const src = screen.getByRole('img', { name: 'Gmail' }).getAttribute('src');
    expect(src).toMatch(/^data:image\/svg\+xml|gmail.*\.svg/);
  });
});
