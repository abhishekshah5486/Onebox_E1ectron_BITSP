import Flashbar, { type FlashbarProps } from '@cloudscape-design/components/flashbar';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export interface FlashInput {
  type: 'success' | 'error' | 'warning' | 'info';
  content: ReactNode;
  header?: ReactNode;
  // A button on the banner, e.g. Undo.
  action?: { label: string; onClick: () => void };
  // A later banner with the same id replaces this one, e.g. "Saving…" then "Saved".
  id?: string;
  // Shows a spinner and stays until replaced.
  loading?: boolean;
  // Colours beyond Cloudscape's own: burgundy for something the person stopped (based on info),
  // amber for something that ran out (based on warning).
  tone?: Tone;
}

type Tone = 'burgundy' | 'amber';
type Item = FlashbarProps.MessageDefinition & { tone?: Tone };

// Cloudscape colours a whole bar by message type, so each tone gets its own bar.
const TONE_STYLES: Record<Tone, FlashbarProps.Style> = {
  burgundy: {
    item: {
      root: {
        background: { info: '#8b1538' },
        borderColor: { info: '#8b1538' },
        color: { info: '#ffffff' },
      },
      dismissButton: {
        color: {
          default: { info: '#ffffff' },
          hover: { info: '#f6d4df' },
          active: { info: '#f6d4df' },
        },
      },
    },
  },
  amber: {
    item: {
      root: {
        background: { warning: '#a85400' },
        borderColor: { warning: '#a85400' },
        color: { warning: '#ffffff' },
      },
      dismissButton: {
        color: {
          default: { warning: '#ffffff' },
          hover: { warning: '#fde7c8' },
          active: { warning: '#fde7c8' },
        },
      },
    },
  },
};

function FlashStack({ items }: { items: Item[] }) {
  const plain = items.filter((item) => !item.tone);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {plain.length > 0 && <Flashbar items={plain} />}
      {(['burgundy', 'amber'] as const).map((tone) => {
        const toned = items.filter((item) => item.tone === tone);
        return toned.length > 0 ? (
          <Flashbar key={tone} items={toned} style={TONE_STYLES[tone]} />
        ) : null;
      })}
    </div>
  );
}

type Push = (flash: FlashInput) => void;
const FlashContext = createContext<Push | null>(null);
let nextId = 0;

function useFlashItems() {
  const [items, setItems] = useState<Item[]>([]);
  const dismiss = useCallback(
    (id: string) => setItems((current) => current.filter((item) => item.id !== id)),
    [],
  );
  const push = useCallback<Push>(
    ({ action, type, id: given, tone, ...flash }) => {
      const id = given ?? `flash-${nextId++}`;
      setItems((current) => [
        {
          ...flash,
          id,
          // Tones keep their base type's icon: info for burgundy, warning for amber.
          type: tone === 'burgundy' ? 'info' : tone === 'amber' ? 'warning' : type,
          ...(tone && { tone }),
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
        ...current.filter((item) => item.id !== id).slice(0, 2),
      ]);
      if (
        (type === 'success' || type === 'info' || tone === 'burgundy') &&
        tone !== 'amber' &&
        !flash.loading
      )
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
          <FlashStack items={items} />
        </div>
      )}
      {children}
    </FlashContext>
  );
}

// A shell-wide banner area, like the AWS console's: the shell decides where the bar sits.
export function FlashArea({ children }: { children: (bar: ReactNode) => ReactNode }) {
  const { items, push } = useFlashItems();
  const bar = useMemo(() => (items.length > 0 ? <FlashStack items={items} /> : null), [items]);
  return <FlashContext value={push}>{children(bar)}</FlashContext>;
}

export function useFlash() {
  const push = useContext(FlashContext);
  if (!push) throw new Error('useFlash must be used inside FlashProvider');
  return push;
}

// For components used in both shells: banners in the console, nothing elsewhere.
export const useOptionalFlash = () => useContext(FlashContext);
