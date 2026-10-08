import Flashbar, { type FlashbarProps } from '@cloudscape-design/components/flashbar';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export interface FlashInput {
  type: 'success' | 'error' | 'warning' | 'info';
  content: ReactNode;
  header?: ReactNode;
  // A button on the banner, e.g. Undo.
  action?: { label: string; onClick: () => void };
}

type Push = (flash: FlashInput) => void;
const FlashContext = createContext<Push | null>(null);
let nextId = 0;

function useFlashItems() {
  const [items, setItems] = useState<FlashbarProps.MessageDefinition[]>([]);
  const dismiss = useCallback(
    (id: string) => setItems((current) => current.filter((item) => item.id !== id)),
    [],
  );
  const push = useCallback<Push>(
    ({ action, type, ...flash }) => {
      const id = `flash-${nextId++}`;
      setItems((current) => [
        {
          ...flash,
          id,
          type,
          dismissible: true,
          onDismiss: () => dismiss(id),
          ...(action && {
            buttonText: action.label,
            onButtonClick: () => {
              dismiss(id);
              action.onClick();
            },
          }),
        },
        ...current.slice(0, 2),
      ]);
      if (type === 'success' || type === 'info')
        setTimeout(() => dismiss(id), action ? 8000 : 5000);
    },
    [dismiss],
  );
  return { items, push };
}

// Banners above a page's content. Inside a FlashArea (the console) they go to its banner area instead.
export function FlashProvider({ children }: { children: ReactNode }) {
  const outer = useContext(FlashContext);
  const { items, push } = useFlashItems();
  if (outer) return children;
  return (
    <FlashContext value={push}>
      {items.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Flashbar items={items} />
        </div>
      )}
      {children}
    </FlashContext>
  );
}

// A shell-wide banner area, like the AWS console's: the shell decides where the bar sits.
export function FlashArea({ children }: { children: (bar: ReactNode) => ReactNode }) {
  const { items, push } = useFlashItems();
  const bar = useMemo(() => (items.length > 0 ? <Flashbar items={items} /> : null), [items]);
  return <FlashContext value={push}>{children(bar)}</FlashContext>;
}

export function useFlash() {
  const push = useContext(FlashContext);
  if (!push) throw new Error('useFlash must be used inside FlashProvider');
  return push;
}

// For components used in both shells: banners in the console, nothing elsewhere.
export const useOptionalFlash = () => useContext(FlashContext);
