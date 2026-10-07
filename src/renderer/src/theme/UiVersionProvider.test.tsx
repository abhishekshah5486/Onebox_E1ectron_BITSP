import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { UiVersionProvider, useUiVersion } from './UiVersionProvider';

function Probe() {
  const { version, setVersion } = useUiVersion();
  return (
    <button onClick={() => setVersion(version === 'v1' ? 'v2' : 'v1')}>version {version}</button>
  );
}

beforeEach(() => localStorage.clear());

describe('UiVersionProvider', () => {
  it('starts on v1 and remembers a switch to v2', () => {
    const { unmount } = render(
      <UiVersionProvider>
        <Probe />
      </UiVersionProvider>,
    );
    act(() => screen.getByRole('button').click());
    expect(screen.getByRole('button')).toHaveTextContent('version v2');
    expect(document.documentElement.dataset.ui).toBe('v2');
    unmount();

    render(
      <UiVersionProvider>
        <Probe />
      </UiVersionProvider>,
    );
    expect(screen.getByRole('button')).toHaveTextContent('version v2');
  });

  it('falls back to v1 outside the provider', () => {
    render(<Probe />);
    expect(screen.getByRole('button')).toHaveTextContent('version v1');
  });
});
