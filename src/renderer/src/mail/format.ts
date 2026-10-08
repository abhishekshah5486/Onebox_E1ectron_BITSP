import type { Address } from '../api/mail';

// Gmail's style ("Oct 8", "2:03 PM") whatever the system locale; times stay in local time.
export const LOCALE = 'en-US';

export function formatListDate(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString(LOCALE, { hour: 'numeric', minute: '2-digit', hour12: true });
  }
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString(LOCALE, { month: 'short', day: 'numeric' });
  }
  return date.toLocaleDateString(LOCALE, { year: 'numeric', month: 'short', day: 'numeric' });
}

export const displayName = (address: Address | null) =>
  address ? address.name || address.address.split('@')[0]! : '(unknown sender)';

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// A precise, unambiguous timestamp for the console view, e.g. "2026-10-07 17:36 UTC".
export function formatUtc(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
}

// Gmail-style header date, e.g. "Wed, Oct 7, 10:44 PM (2 hours ago)".
export function formatMessageDate(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const absolute = date.toLocaleString(LOCALE, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const minutes = Math.round((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 0 || minutes >= 7 * 24 * 60) return absolute;
  const ago =
    minutes < 1
      ? 'just now'
      : minutes < 60
        ? `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`
        : minutes < 24 * 60
          ? `${Math.floor(minutes / 60)} ${Math.floor(minutes / 60) === 1 ? 'hour' : 'hours'} ago`
          : `${Math.floor(minutes / 1440)} ${Math.floor(minutes / 1440) === 1 ? 'day' : 'days'} ago`;
  return `${absolute} (${ago})`;
}

// Keeps the start and the end (usually the domain) so long addresses stay recognisable on one line.
export function middleTruncate(text: string, max = 26): string {
  if (text.length <= max) return text;
  const tail = Math.floor((max - 1) / 2);
  return `${text.slice(0, max - 1 - tail)}…${text.slice(-tail)}`;
}

export const countLabel = (count: number) => (count > 99 ? '99+' : String(count));

// Full timestamp with the zone, e.g. "Thu, Oct 8, 2026, 2:03 PM GMT+5:30", for tooltips.
export const formatFullDate = (iso: string) =>
  new Date(iso).toLocaleString(LOCALE, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  });
