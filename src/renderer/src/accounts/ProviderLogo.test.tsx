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

  it.each([
    ['GMAIL', 'Gmail', /gmail/],
    ['YAHOO', 'Yahoo', /yahoo/],
  ] as const)('uses the logo file for %s', (provider, label, name) => {
    render(<ProviderLogo provider={provider} />);
    // Vite inlines small images as data URIs and serves larger ones by file name.
    const src = screen.getByRole('img', { name: label }).getAttribute('src') ?? '';
    expect(src.startsWith('data:image/') || name.test(src)).toBe(true);
  });
});
