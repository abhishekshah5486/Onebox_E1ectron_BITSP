import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './TooltipLayer.module.css';

interface Tip {
  text: string;
  x: number;
  y: number;
  above: boolean;
}

const EDGE = 64;
const target = (node: EventTarget | null) =>
  node instanceof Element ? node.closest<HTMLElement>('[data-tooltip]') : null;

// One tooltip for the whole app: any element with data-tooltip shows it at once on hover or
// keyboard focus, like Gmail. Drawn on top of everything, so lists never clip it.
export function TooltipLayer() {
  const [tip, setTip] = useState<Tip | null>(null);

  useEffect(() => {
    const show = (element: HTMLElement | null) => {
      const text = element?.dataset.tooltip;
      if (!element || !text) return;
      const rect = element.getBoundingClientRect();
      const above = rect.bottom + 40 > window.innerHeight;
      setTip({
        text,
        x: Math.min(Math.max(rect.left + rect.width / 2, EDGE), window.innerWidth - EDGE),
        y: above ? rect.top - 6 : rect.bottom + 6,
        above,
      });
    };
    const onOver = (event: MouseEvent) => show(target(event.target));
    const onOut = (event: MouseEvent) => {
      const from = target(event.target);
      if (from && from !== target(event.relatedTarget)) setTip(null);
    };
    const onFocus = (event: FocusEvent) => {
      const element = target(event.target);
      if (element?.matches(':focus-visible')) show(element);
    };
    const hide = () => setTip(null);
    document.addEventListener('mouseover', onOver);
    document.addEventListener('mouseout', onOut);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', hide);
    document.addEventListener('mousedown', hide);
    window.addEventListener('scroll', hide, true);
    return () => {
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseout', onOut);
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('focusout', hide);
      document.removeEventListener('mousedown', hide);
      window.removeEventListener('scroll', hide, true);
    };
  }, []);

  if (!tip) return null;
  return createPortal(
    <div
      role="tooltip"
      className={`${styles.tip} ${tip.above ? styles.above : ''}`}
      style={{ left: tip.x, top: tip.y }}
    >
      {tip.text}
    </div>,
    document.body,
  );
}
