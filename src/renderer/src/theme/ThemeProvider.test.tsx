import { applyMode, Mode } from '@cloudscape-design/global-styles';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, useTheme } from './ThemeProvider';

vi.mock('@cloudscape-design/global-styles', () => ({
  applyMode: vi.fn(),
  Mode: { Light: 'light', Dark: 'dark' },
}));

let systemDark = false;
let listeners: ((event: MediaQueryListEvent) => void)[] = [];

beforeEach(() => {
  localStorage.clear();
  systemDark = false;
  listeners = [];
  vi.mocked(applyMode).mockClear();
  vi.stubGlobal('matchMedia', () => ({
    matches: systemDark,
    addEventListener: (_: string, fn: (event: MediaQueryListEvent) => void) => listeners.push(fn),
    removeEventListener: vi.fn(),
  }));
});

function Probe() {
  const { preference, resolved, setPreference } = useTheme();
  return (
    <>
      <span>{`${preference}:${resolved}`}</span>
      <button onClick={() => setPreference('dark')}>dark</button>
    </>
  );
}

const renderProbe = () =>
  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );

describe('ThemeProvider', () => {
  it('follows the system by default and applies it to tokens and cloudscape', () => {
    systemDark = true;
    renderProbe();
    expect(screen.getByText('system:dark')).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(applyMode).toHaveBeenLastCalledWith(Mode.Dark);
  });

  it('reacts when the system appearance changes', () => {
    renderProbe();
    act(() => listeners.forEach((fn) => fn({ matches: true } as MediaQueryListEvent)));
    expect(screen.getByText('system:dark')).toBeInTheDocument();
  });

  it('persists an explicit choice', async () => {
    renderProbe();
    await userEvent.click(screen.getByRole('button', { name: 'dark' }));

    expect(screen.getByText('dark:dark')).toBeInTheDocument();
    expect(localStorage.getItem('onebox.theme')).toBe('dark');
  });

  it('restores a saved choice over the system setting', () => {
    systemDark = true;
    localStorage.setItem('onebox.theme', 'light');
    renderProbe();
    expect(screen.getByText('light:light')).toBeInTheDocument();
    expect(applyMode).toHaveBeenLastCalledWith(Mode.Light);
  });

  it('throws when used outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/ThemeProvider/);
  });
});
