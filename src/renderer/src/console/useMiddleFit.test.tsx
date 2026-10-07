import { act, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMiddleFit } from './useMiddleFit';

const EMAIL = 'abhishek.shah5486@gmail.com';
let width = 0;
let resize: () => void = () => {};

function Label() {
  const trailing = useRef<HTMLSpanElement>(null);
  const [ref, label] = useMiddleFit<HTMLDivElement>(EMAIL, 0, trailing);
  return (
    <div ref={ref}>
      <span data-testid="label">{label}</span>
      <span ref={trailing} />
    </div>
  );
}

beforeEach(() => {
  // Every character is 8px wide; the container is as wide as the test says.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    font: '',
    measureText: (text: string) => ({ width: text.length * 8 }),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => width);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('useMiddleFit', () => {
  it('shows the full address when it fits and shortens the middle when it does not', () => {
    width = EMAIL.length * 8;
    render(<Label />);
    expect(screen.getByTestId('label')).toHaveTextContent(EMAIL);

    width = 20 * 8;
    act(() => resize());
    const short = screen.getByTestId('label').textContent;
    expect(short).toHaveLength(20);
    expect(short).toContain('…');
    expect(short.endsWith('gmail.com')).toBe(true);

    width = 400;
    act(() => resize());
    expect(screen.getByTestId('label')).toHaveTextContent(EMAIL);
  });
});
