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

  it("uses the brand's official logo file first, with its dark-mode version", () => {
    const { container } = render(
      <ProviderMark providerId="pinecone" logoUrl={null} name="Pinecone" />,
    );
    const [light, dark] = [...container.querySelectorAll('img')].map((img) =>
      img.getAttribute('src'),
    );
    // Small files are inlined, so the colour tells the two versions apart.
    expect(decodeURIComponent(light!)).toContain('#111');
    expect(decodeURIComponent(dark!)).toContain('#fff');
    const chroma = render(<ProviderMark providerId="chroma" logoUrl={null} name="Chroma" />);
    expect(chroma.container.querySelectorAll('img')).toHaveLength(2);
    expect(chroma.container.textContent).toBe('');
  });

  it('shows the logo fetched from a catalogue provider’s own site', () => {
    const { container } = render(
      <ProviderMark
        providerId="cloudflare-workers-ai"
        logoUrl={null}
        name="Cloudflare Workers AI"
      />,
    );
    expect(container.querySelectorAll('img')).toHaveLength(2);
  });

  it('draws other brands from Simple Icons, in their colour', async () => {
    const { container } = render(
      <ProviderMark providerId="zilliz" icon="zilliz" logoUrl={null} name="Zilliz" />,
    );
    await waitFor(() => expect(container.querySelector('svg title')?.textContent).toBe('Zilliz'));
    expect(container.querySelector('svg')?.parentElement).toHaveStyle({ color: '#2858FF' });
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
