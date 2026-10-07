import { useCallback, useState } from 'react';

export const SIDEBAR_MIN = 220;
export const SIDEBAR_MAX = 420;
export const SIDEBAR_DEFAULT = 280;
const STORAGE_KEY = 'onebox.console.sidebar-width';

export const clampWidth = (width: number) =>
  Math.round(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, width)));

function readWidth() {
  try {
    const stored = Number(localStorage.getItem(STORAGE_KEY));
    return stored ? clampWidth(stored) : SIDEBAR_DEFAULT;
  } catch {
    return SIDEBAR_DEFAULT;
  }
}

// The sidebar width is a per-viewer convenience, so it lives in this browser only.
export function useSidebarWidth() {
  const [width, setWidthState] = useState(readWidth);
  const setWidth = useCallback((next: number) => {
    const clamped = clampWidth(next);
    setWidthState(clamped);
    try {
      localStorage.setItem(STORAGE_KEY, String(clamped));
    } catch {
      // Unavailable storage only means the width resets next visit.
    }
  }, []);
  return [width, setWidth] as const;
}
