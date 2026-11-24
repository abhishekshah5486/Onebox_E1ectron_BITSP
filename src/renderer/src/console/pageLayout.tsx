import type { AppLayoutProps } from '@cloudscape-design/components/app-layout';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

// What a page adds to the console's layout: its breadcrumbs, a split panel, its content type.
export interface PageLayout {
  breadcrumbs?: ReactNode;
  splitPanel?: ReactNode;
  splitPanelOpen?: boolean;
  onSplitPanelToggle?: (open: boolean) => void;
  contentType?: AppLayoutProps.ContentType;
}

const Context = createContext<{ set: (layout: PageLayout) => void } | null>(null);

export function PageLayoutProvider({ children }: { children: (layout: PageLayout) => ReactNode }) {
  const [layout, setLayout] = useState<PageLayout>({});
  // The same value every render, or each page's cleanup would run and clear its layout again.
  const value = useMemo(() => ({ set: setLayout }), []);
  return <Context.Provider value={value}>{children(layout)}</Context.Provider>;
}

// Sets the page's part of the layout while it is shown; the deps say when it changed.
export function usePageLayout(layout: PageLayout, deps: unknown[]) {
  const context = useContext(Context);
  useEffect(() => {
    context?.set(layout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the caller lists what changes it
  }, deps);
  useEffect(() => () => context?.set({}), [context]);
}
