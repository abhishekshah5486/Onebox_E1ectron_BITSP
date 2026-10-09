import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { applyCloudscapeTheme, applyConsoleTheme } from './cloudscape-theme';

// v1 is the Gmail-style interface; v2 is the AWS console-style one built on stock Cloudscape.
export type UiVersion = 'v1' | 'v2';

const STORAGE_KEY = 'onebox.ui-version';

interface UiVersionContextValue {
  version: UiVersion;
  setVersion: (version: UiVersion) => void;
}

const UiVersionContext = createContext<UiVersionContextValue | null>(null);

function readVersion(): UiVersion {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'v2' ? 'v2' : 'v1';
  } catch {
    return 'v1';
  }
}

export function UiVersionProvider({ children }: { children: ReactNode }) {
  const [version, setVersionState] = useState<UiVersion>(readVersion);

  // v1 retints Cloudscape to match the Gmail look; v2 keeps the stock AWS palette.
  useEffect(() => {
    document.documentElement.dataset.ui = version;
    return (version === 'v1' ? applyCloudscapeTheme() : applyConsoleTheme()).reset;
  }, [version]);

  const value = useMemo<UiVersionContextValue>(
    () => ({
      version,
      setVersion: (next) => {
        try {
          localStorage.setItem(STORAGE_KEY, next);
        } catch {
          // Storage can be unavailable (private mode); the choice then lasts for this session.
        }
        setVersionState(next);
      },
    }),
    [version],
  );

  return <UiVersionContext value={value}>{children}</UiVersionContext>;
}

const fallback: UiVersionContextValue = { version: 'v1', setVersion: () => {} };

export function useUiVersion(): UiVersionContextValue {
  return useContext(UiVersionContext) ?? fallback;
}
