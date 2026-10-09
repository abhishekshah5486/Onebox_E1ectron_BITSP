import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { middleTruncate } from '../mail/format';

const MIN_CHARS = 8;

// Fits text into the space its container has left, shortening it in the middle only when needed.
// `fixed` is the width of icons beside the text; `trailing` is a sibling (e.g. a badge) to leave room for.
export function useMiddleFit<T extends HTMLElement>(
  text: string,
  fixed: number,
  trailing: RefObject<HTMLElement | null>,
) {
  const ref = useRef<T>(null);
  const [label, setLabel] = useState(text);

  useLayoutEffect(() => {
    const container = ref.current;
    const context = document.createElement('canvas').getContext('2d');
    if (!container || !context) return;

    const fit = () => {
      const available = container.clientWidth - fixed - (trailing.current?.offsetWidth ?? 0);
      const style = getComputedStyle(container);
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const fits = (candidate: string) => context.measureText(candidate).width <= available;
      // jsdom and hidden layouts report no width; show the whole address there.
      if (container.clientWidth === 0 || fits(text)) return setLabel(text);

      let low = MIN_CHARS;
      let high = text.length - 1;
      while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        if (fits(middleTruncate(text, mid))) low = mid;
        else high = mid - 1;
      }
      setLabel(middleTruncate(text, low));
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    if (trailing.current) observer.observe(trailing.current);
    return () => observer.disconnect();
  }, [text, fixed, trailing]);

  return [ref, label] as const;
}
