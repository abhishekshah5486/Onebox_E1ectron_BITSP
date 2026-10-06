import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Icon } from './Icon';
import { Logo } from './Logo';

describe('Icon', () => {
  it('renders a decorative svg at the requested size', () => {
    const { container } = render(<Icon name="inbox" size={24} />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('width', '24');
    expect(svg.querySelector('path')?.getAttribute('d')).toMatch(/^M19 3H4\.99/);
  });
});

describe('Logo', () => {
  it('shows the wordmark unless disabled', () => {
    expect(render(<Logo />).getByText('OneBox')).toBeInTheDocument();
    expect(render(<Logo withWordmark={false} />).container.textContent).toBe('');
  });
});
