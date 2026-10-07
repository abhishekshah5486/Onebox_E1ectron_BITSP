import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { SIDEBAR_MAX, SIDEBAR_MIN } from './useSidebarWidth';
import styles from './SidebarResizer.module.css';

const STEP = 16;

// A drag handle on the sidebar's right edge; arrow keys resize it too.
export function SidebarResizer({
  width,
  onResize,
}: {
  width: number;
  onResize: (width: number) => void;
}) {
  const start = useRef<{ x: number; width: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    start.current = { x: event.clientX, width };
    setDragging(true);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (start.current) onResize(start.current.width + event.clientX - start.current.x);
  };
  const stop = () => {
    start.current = null;
    setDragging(false);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const delta = { ArrowLeft: -STEP, ArrowRight: STEP }[event.key];
    if (delta) {
      event.preventDefault();
      onResize(width + delta);
    } else if (event.key === 'Home') onResize(SIDEBAR_MIN);
    else if (event.key === 'End') onResize(SIDEBAR_MAX);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-valuemin={SIDEBAR_MIN}
      aria-valuemax={SIDEBAR_MAX}
      aria-valuenow={width}
      tabIndex={0}
      className={`${styles.handle} ${dragging ? styles.dragging : ''}`}
      style={{ left: width - 3 }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stop}
      onPointerCancel={stop}
      onKeyDown={onKeyDown}
    />
  );
}
