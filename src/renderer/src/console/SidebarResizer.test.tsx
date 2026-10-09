import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { SidebarResizer } from './SidebarResizer';
import {
  clampWidth,
  SIDEBAR_DEFAULT,
  SIDEBAR_MAX,
  SIDEBAR_MIN,
  useSidebarWidth,
} from './useSidebarWidth';

function Harness() {
  const [width, setWidth] = useSidebarWidth();
  return <SidebarResizer width={width} onResize={setWidth} />;
}

beforeEach(() => localStorage.clear());

describe('sidebar resizing', () => {
  it('keeps the width within its limits', () => {
    expect(clampWidth(100)).toBe(SIDEBAR_MIN);
    expect(clampWidth(999)).toBe(SIDEBAR_MAX);
    expect(clampWidth(300.4)).toBe(300);
  });

  it('resizes with the arrow keys and remembers the width', () => {
    const { unmount } = render(<Harness />);
    const handle = screen.getByRole('separator', { name: 'Resize sidebar' });
    expect(handle).toHaveAttribute('aria-valuenow', String(SIDEBAR_DEFAULT));

    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(handle).toHaveAttribute('aria-valuenow', String(SIDEBAR_DEFAULT + 16));
    fireEvent.keyDown(handle, { key: 'End' });
    expect(handle).toHaveAttribute('aria-valuenow', String(SIDEBAR_MAX));
    unmount();

    render(<Harness />);
    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', String(SIDEBAR_MAX));
  });

  it('follows a drag but never past the limits', () => {
    function Drag() {
      const [width, setWidth] = useState(SIDEBAR_DEFAULT);
      return <SidebarResizer width={width} onResize={(w) => setWidth(clampWidth(w))} />;
    }
    render(<Drag />);
    const handle = screen.getByRole('separator');
    handle.setPointerCapture = () => {};
    fireEvent.pointerDown(handle, { clientX: 280, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 330, pointerId: 1 });
    expect(handle).toHaveAttribute('aria-valuenow', '330');
    fireEvent.pointerMove(handle, { clientX: 2000, pointerId: 1 });
    expect(handle).toHaveAttribute('aria-valuenow', String(SIDEBAR_MAX));
    fireEvent.pointerUp(handle, { pointerId: 1 });
  });
});
