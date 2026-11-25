import { afterEach, describe, expect, it, vi } from 'vitest';
import { guardBoardPointer } from './boardPointer';

const pointer = (type: string, init: MouseEventInit) =>
  new MouseEvent(type, { bubbles: true, ...init });

describe('the board pointer guard', () => {
  let stop = () => undefined as void;
  afterEach(() => stop());

  function board() {
    const root = document.createElement('div');
    const handle = document.createElement('button');
    handle.className = 'awsui_handle_abc_1';
    root.append(handle);
    document.body.append(root);
    stop = guardBoardPointer(root);
    return handle;
  }

  it('delivers a release that happened outside the window', () => {
    const handle = board();
    const ups = vi.fn();
    window.addEventListener('pointerup', ups);
    handle.dispatchEvent(pointer('pointerdown', { button: 0, clientX: 10, clientY: 10 }));
    window.dispatchEvent(pointer('pointermove', { buttons: 0, clientX: 300, clientY: 40 }));
    expect(ups).toHaveBeenCalledWith(expect.objectContaining({ clientX: 300, clientY: 40 }));
    window.removeEventListener('pointerup', ups);
  });

  it('ends the keyboard mode a press without a move starts', () => {
    vi.useFakeTimers();
    const handle = board();
    const keys = vi.fn();
    handle.addEventListener('keydown', (e) => {
      keys(e.key);
    });
    handle.dispatchEvent(pointer('pointerdown', { button: 0, clientX: 10, clientY: 10 }));
    window.dispatchEvent(pointer('pointerup', { clientX: 11, clientY: 10 }));
    vi.runAllTimers();
    expect(keys).toHaveBeenCalledWith('Escape');
    vi.useRealTimers();
  });

  it('leaves a real drag to the board', () => {
    vi.useFakeTimers();
    const handle = board();
    const keys = vi.fn();
    handle.addEventListener('keydown', keys);
    handle.dispatchEvent(pointer('pointerdown', { button: 0, clientX: 10, clientY: 10 }));
    window.dispatchEvent(pointer('pointermove', { buttons: 1, clientX: 200, clientY: 10 }));
    window.dispatchEvent(pointer('pointerup', { clientX: 200, clientY: 10 }));
    vi.runAllTimers();
    expect(keys).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
