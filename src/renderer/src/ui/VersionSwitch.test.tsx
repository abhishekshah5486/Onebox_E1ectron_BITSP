import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UiVersionProvider } from '../theme/UiVersionProvider';
import { VersionSwitch } from './VersionSwitch';

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('VersionSwitch', () => {
  it('slides the pill to the chosen version, then switches the interface', () => {
    render(
      <UiVersionProvider>
        <VersionSwitch />
      </UiVersionProvider>,
    );
    const v1 = screen.getByRole('radio', { name: /v1/ });
    const v2 = screen.getByRole('radio', { name: /v2/ });
    expect(v1).toHaveAttribute('aria-checked', 'true');

    act(() => v2.click());
    expect(v2).toHaveAttribute('aria-checked', 'true');
    expect(localStorage.getItem('onebox.ui-version')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(localStorage.getItem('onebox.ui-version')).toBe('v2');
    expect(document.documentElement.dataset.ui).toBe('v2');
  });
});
