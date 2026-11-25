// The board waits for a pointer drag or resize to end in two ways it can miss, leaving a card
// stuck until reload:
// - a press without a move (under 3px) starts its keyboard mode (arrows, then Enter), which a
//   mouse user never ends; Escape ends it at once;
// - a release outside the window never arrives; the first move back with no button pressed,
//   or the window losing focus, delivers it there, and the board settles on the nearest place.
const HANDLE = '[class*="awsui_handle_"]';
const CLICK = 4;

export function guardBoardPointer(root: HTMLElement): () => void {
  let press: { x: number; y: number; handle: HTMLElement } | null = null;
  let last = { x: 0, y: 0 };

  const release = (x: number, y: number) => {
    const Pointer = typeof PointerEvent === 'function' ? PointerEvent : MouseEvent;
    window.dispatchEvent(new Pointer('pointerup', { clientX: x, clientY: y, bubbles: true }));
  };

  const down = (e: PointerEvent) => {
    const handle = e.button === 0 && e.target instanceof Element && e.target.closest(HANDLE);
    press = handle instanceof HTMLElement ? { x: e.clientX, y: e.clientY, handle } : null;
    last = { x: e.clientX, y: e.clientY };
  };
  const move = (e: PointerEvent) => {
    if (!press) return;
    last = { x: e.clientX, y: e.clientY };
    if (e.buttons === 0) {
      press = null;
      release(e.clientX, e.clientY);
    }
  };
  const up = (e: PointerEvent) => {
    if (!press) return;
    const { handle, x, y } = press;
    press = null;
    if (Math.hypot(e.clientX - x, e.clientY - y) < CLICK)
      // After the board has handled this release and started its keyboard mode.
      window.setTimeout(() =>
        handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
      );
  };
  const blur = () => {
    if (!press) return;
    press = null;
    release(last.x, last.y);
  };

  root.addEventListener('pointerdown', down, true);
  window.addEventListener('pointermove', move, true);
  window.addEventListener('pointerup', up, true);
  window.addEventListener('blur', blur);
  return () => {
    root.removeEventListener('pointerdown', down, true);
    window.removeEventListener('pointermove', move, true);
    window.removeEventListener('pointerup', up, true);
    window.removeEventListener('blur', blur);
  };
}
