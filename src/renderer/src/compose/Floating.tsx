import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';

const GAP = 6;
const MARGIN = 8;

// A menu or panel fixed to the screen next to its button, so the compose window's edges don't
// clip it. It opens above or below, stays on screen, and closes on Escape or a click elsewhere.
export function Floating({
  anchor,
  onClose,
  placement = 'above',
  className,
  label,
  maxHeight = Infinity,
  children,
}: {
  anchor: RefObject<HTMLElement | null>;
  // A cap on its height; it's also kept within the space available on screen.
  maxHeight?: number;
  onClose: () => void;
  placement?: 'above' | 'below';
  className?: string | undefined;
  label: string;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });

  useLayoutEffect(() => {
    const place = () => {
      const button = anchor.current?.getBoundingClientRect();
      const width = panel.current?.offsetWidth ?? 0;
      if (!button) return;
      const left = Math.max(MARGIN, Math.min(button.left, window.innerWidth - width - MARGIN));
      setStyle(
        placement === 'above'
          ? {
              left,
              bottom: window.innerHeight - button.top + GAP,
              maxHeight: Math.min(maxHeight, button.top - GAP - MARGIN),
            }
          : {
              left,
              top: button.bottom + GAP,
              maxHeight: Math.min(maxHeight, window.innerHeight - button.bottom - GAP - MARGIN),
            },
      );
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [anchor, placement, maxHeight]);

  useEffect(() => {
    // Capture, so a click that something else stops on its way still closes this.
    const away = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !anchor.current?.contains(target)) onClose();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onClose();
    };
    document.addEventListener('pointerdown', away, true);
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', away, true);
      document.removeEventListener('keydown', escape, true);
    };
  }, [anchor, onClose]);

  return (
    <div
      ref={panel}
      role="menu"
      aria-label={label}
      className={className}
      style={{ position: 'fixed', zIndex: 2300, overflowY: 'auto', ...style }}
    >
      {children}
    </div>
  );
}
