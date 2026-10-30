import { add, addDays, format, isValid, parseISO, sub, type Duration } from 'date-fns';

// Gmail's "Date within" choices.
export const WITHIN: { id: string; label: string; span: Duration }[] = [
  { id: '1d', label: '1 day', span: { days: 1 } },
  { id: '3d', label: '3 days', span: { days: 3 } },
  { id: '1w', label: '1 week', span: { weeks: 1 } },
  { id: '2w', label: '2 weeks', span: { weeks: 2 } },
  { id: '1m', label: '1 month', span: { months: 1 } },
  { id: '2m', label: '2 months', span: { months: 2 } },
  { id: '6m', label: '6 months', span: { months: 6 } },
  { id: '1y', label: '1 year', span: { years: 1 } },
];

export const SEARCH_IN = [
  { id: 'all', label: 'All Mail' },
  { id: 'inbox', label: 'Inbox' },
  { id: 'starred', label: 'Starred' },
  { id: 'sent', label: 'Sent Mail' },
  { id: 'drafts', label: 'Drafts' },
  { id: 'archive', label: 'Archive' },
  { id: 'spam', label: 'Spam' },
  { id: 'trash', label: 'Trash' },
  { id: 'unread', label: 'Unread Mail' },
  { id: 'read', label: 'Read Mail' },
  { id: 'anywhere', label: 'Mail & Spam & Trash' },
] as const;

export const SIZE_UNITS = ['MB', 'KB', 'bytes'] as const;

export interface AdvancedSearch {
  from: string;
  to: string;
  subject: string;
  hasWords: string;
  doesntHave: string;
  sizeOp: 'larger' | 'smaller';
  size: string;
  sizeUnit: (typeof SIZE_UNITS)[number];
  within: string;
  // yyyy-mm-dd; empty for any date.
  date: string;
  searchIn: (typeof SEARCH_IN)[number]['id'];
  hasAttachment: boolean;
}

export const EMPTY_SEARCH: AdvancedSearch = {
  from: '',
  to: '',
  subject: '',
  hasWords: '',
  doesntHave: '',
  sizeOp: 'larger',
  size: '',
  sizeUnit: 'MB',
  within: '1d',
  date: '',
  searchIn: 'all',
  hasAttachment: false,
};

const quoted = (value: string) => (/\s/.test(value) ? `"${value.replaceAll('"', '')}"` : value);
const operator = (name: string, value: string) =>
  value.trim() ? `${name}:${quoted(value.trim())}` : '';
const day = (date: Date) => format(date, 'yyyy/MM/dd');

// The advanced fields as one query, the same operators you could type yourself.
export function buildQuery(form: AdvancedSearch): string {
  const parts = [
    operator('from', form.from),
    operator('to', form.to),
    operator('subject', form.subject),
    form.hasWords.trim(),
    // Each word left out on its own, like Gmail's "Doesn't have".
    ...form.doesntHave
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => `-${word}`),
  ];
  const size = Number(form.size);
  if (form.size.trim() && Number.isFinite(size) && size > 0) {
    const unit = form.sizeUnit === 'MB' ? 'M' : form.sizeUnit === 'KB' ? 'K' : '';
    parts.push(`${form.sizeOp}:${size}${unit}`);
  }
  const date = form.date ? parseISO(form.date) : null;
  const span = WITHIN.find((w) => w.id === form.within)?.span;
  if (date && isValid(date) && span) {
    // before: is exclusive, so the last day of the window is still included.
    parts.push(`after:${day(sub(date, span))}`, `before:${day(addDays(add(date, span), 1))}`);
  }
  if (form.searchIn === 'starred') parts.push('is:starred');
  else if (form.searchIn === 'unread') parts.push('is:unread');
  else if (form.searchIn === 'read') parts.push('is:read');
  else if (form.searchIn !== 'all') parts.push(`in:${form.searchIn}`);
  if (form.hasAttachment) parts.push('has:attachment');
  return parts.filter(Boolean).join(' ');
}
