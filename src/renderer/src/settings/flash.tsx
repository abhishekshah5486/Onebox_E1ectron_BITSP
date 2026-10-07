import Flashbar, { type FlashbarProps } from '@cloudscape-design/components/flashbar';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface FlashInput {
  type: 'success' | 'error' | 'warning' | 'info';
  content: ReactNode;
  header?: ReactNode;
}

const FlashContext = createContext<((flash: FlashInput) => void) | null>(null);
let nextId = 0;

export function FlashProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<FlashbarProps.MessageDefinition[]>([]);

  const dismiss = useCallback(
    (id: string) => setItems((current) => current.filter((item) => item.id !== id)),
    [],
  );

  const push = useCallback(
    (flash: FlashInput) => {
      const id = `flash-${nextId++}`;
      setItems((current) => [
        { ...flash, id, dismissible: true, onDismiss: () => dismiss(id) },
        ...current.slice(0, 2),
      ]);
      if (flash.type === 'success') setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );

  const value = useMemo(() => push, [push]);
  return (
    <FlashContext value={value}>
      <Flashbar items={items} stackItems={items.length > 1} />
      {children}
    </FlashContext>
  );
}

export function useFlash() {
  const push = useContext(FlashContext);
  if (!push) throw new Error('useFlash must be used inside FlashProvider');
  return push;
}
