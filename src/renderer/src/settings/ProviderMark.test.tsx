import { render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProviderMark } from './ProviderMark';

describe('ProviderMark', () => {
  it('shows the colour logo for a provider, by its LobeHub name where that differs', async () => {
    const { container } = render(
      <ProviderMark providerId="anthropic" logoUrl={null} name="Anthropic" />,
    );
    await waitFor(() => expect(container.querySelector('svg title')?.textContent).toBe('Claude'));
  });

  it('draws brands LobeHub lacks from Simple Icons, in their colour', async () => {
    const { container } = render(
      <ProviderMark providerId="qdrant" icon="qdrant" logoUrl={null} name="Qdrant" />,
    );
    await waitFor(() => expect(container.querySelector('svg title')?.textContent).toBe('Qdrant'));
    expect(container.querySelector('svg')?.parentElement).toHaveStyle({ color: '#DC244C' });
  });

  it('keeps the text colour for brands whose colour is black', async () => {
    const { container } = render(<ProviderMark providerId="ollama" logoUrl={null} name="Ollama" />);
    await waitFor(() => expect(container.querySelector('svg title')?.textContent).toBe('Ollama'));
    expect(container.querySelector('svg')?.parentElement?.style.color).toBe('');
  });

  it("falls back to the catalogue's logo, then the initial", () => {
    const withLogo = render(
      <ProviderMark
        providerId="no-such-provider"
        logoUrl="https://models.dev/logos/x.svg"
        name="X"
      />,
    );
    expect(withLogo.container.querySelector('img')).toHaveAttribute(
      'src',
      'https://models.dev/logos/x.svg',
    );
    const bare = render(<ProviderMark providerId="no-such-provider" logoUrl={null} name="acme" />);
    expect(bare.container.textContent).toBe('A');
  });
});
