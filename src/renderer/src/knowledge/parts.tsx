import { useCallback, useState, type ReactNode } from 'react';
import { fileIconUrl } from '../mail/attachments/fileIcons';
import type { Tone } from './format';
import styles from './Knowledge.module.css';

const TONE: Record<Tone, string | undefined> = {
  violet: styles.chipViolet,
  blue: styles.chipBlue,
  cyan: styles.chipCyan,
  green: styles.chipGreen,
  amber: styles.chipAmber,
  red: styles.chipRed,
  gray: undefined,
};

export function Chip({
  tone = 'gray',
  title,
  children,
}: {
  tone?: Tone;
  title?: string;
  children: ReactNode;
}) {
  return (
    <span className={`${styles.chip} ${TONE[tone] ?? ''}`} title={title}>
      {children}
    </span>
  );
}

export function FileIcon({ name, mimeType }: { name: string; mimeType: string }) {
  return <img className={styles.fileIcon} src={fileIconUrl(name, mimeType)} alt="" />;
}

// Four-point sparkles, the mark of everything the model does on this page.
export function Sparkles({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M10 2.5l1.7 4.8 4.8 1.7-4.8 1.7L10 15.5l-1.7-4.8L3.5 9l4.8-1.7z" />
      <path d="M18 12.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z" />
      <path d="M17 2.5l.6 1.6 1.6.6-1.6.6L17 6.9l-.6-1.6-1.6-.6 1.6-.6z" />
    </svg>
  );
}

// The question's words marked in a passage.
export function Marked({ text, words }: { text: string; words: string[] }) {
  if (words.length === 0) return <>{text}</>;
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(${escaped.join('|')})`, 'giu');
  return (
    <>
      {text.split(pattern).map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className={styles.hit}>
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

const RECENT_KEY = 'onebox.knowledge.recent';
const RECENT_MAX = 8;

function readRecent(): string[] {
  try {
    const stored = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as unknown;
    return Array.isArray(stored) ? stored.filter((q): q is string => typeof q === 'string') : [];
  } catch {
    return [];
  }
}

// The person's last searches on this device, newest first.
export function useRecentSearches() {
  const [recent, setRecent] = useState(readRecent);
  const remember = useCallback((query: string) => {
    setRecent((previous) => {
      const next = [query, ...previous.filter((q) => q !== query)].slice(0, RECENT_MAX);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        // Storage may be unavailable; the list still works for this session.
      }
      return next;
    });
  }, []);
  return { recent, remember };
}
