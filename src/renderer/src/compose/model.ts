import type { Composition, Recipient, ReplyMode } from '../api/compose';
import type { Address, Message } from '../api/mail';

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

const ADDRESS = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]+$/;

export const isAddress = (value: string) => ADDRESS.test(value.trim());

export const recipientLabel = (recipient: Recipient) => recipient.name || recipient.address;

// "Priya <priya@acme.com>, sam@acme.com; Lee" -> recipients, plus whatever wasn't an address.
export function parseRecipients(input: string): { recipients: Recipient[]; invalid: string[] } {
  const recipients: Recipient[] = [];
  const invalid: string[] = [];
  for (const part of input.split(/[,;\n]+/)) {
    const value = part.trim();
    if (!value) continue;
    const named = value.match(/^"?([^"<]*?)"?\s*<([^>]+)>$/);
    const address = (named ? named[2]! : value).trim();
    if (isAddress(address)) {
      recipients.push({ name: named?.[1]?.trim() || null, address: address.toLowerCase() });
    } else {
      invalid.push(value);
    }
  }
  return { recipients, invalid };
}

export const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => `&${{ '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot', "'": '#39' }[c]};`,
  );

// The user's signature (plain text in Preferences) under a "-- " line, as mail apps do.
export const signatureHtml = (signature: string | null | undefined) =>
  signature?.trim()
    ? `<br><div class="onebox-signature">-- <br>${escapeHtml(signature.trim()).replace(/\n/g, '<br>')}</div>`
    : '';

export const emptyComposition = (
  accountId: string | null,
  signature?: string | null,
): Composition => ({
  accountId,
  to: [],
  cc: [],
  bcc: [],
  subject: '',
  html: signature ? `<br>${signatureHtml(signature)}` : '',
  text: '',
  attachments: [],
  replyTo: null,
});

const toRecipient = (address: Address): Recipient => ({
  name: address.name || null,
  address: address.address.toLowerCase(),
});

const prefixed = (subject: string, prefix: 'Re' | 'Fwd') =>
  new RegExp(`^${prefix}:`, 'i').test(subject.trim())
    ? subject.trim()
    : `${prefix}: ${subject.trim()}`;

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

const person = (address: Address | null) =>
  address
    ? address.name
      ? `${escapeHtml(address.name)} &lt;${escapeHtml(address.address)}&gt;`
      : escapeHtml(address.address)
    : 'Unknown sender';

const originalBody = (message: Message) =>
  message.htmlBody ?? `<div style="white-space:pre-wrap">${escapeHtml(message.textBody)}</div>`;

// A reply, reply-all or forward of a message: who it goes to, its subject and the quoted original.
export function replyComposition(
  message: Message,
  mode: ReplyMode,
  // The user's own addresses, never added as recipients of their own reply.
  mine: string[],
  signature?: string | null,
): Composition {
  const own = new Set(mine.map((address) => address.toLowerCase()));
  const notMine = (list: Recipient[]) => {
    const seen = new Set<string>();
    return list.filter((r) => !own.has(r.address) && !seen.has(r.address) && seen.add(r.address));
  };
  const fromMe = message.from ? own.has(message.from.address.toLowerCase()) : false;
  // Replying to your own message goes back to the people you wrote to.
  const replyTarget = fromMe
    ? message.to.map(toRecipient)
    : (message.replyTo.length ? message.replyTo : message.from ? [message.from] : []).map(
        toRecipient,
      );

  const base = {
    accountId: message.accountId,
    bcc: [],
    text: '',
    replyTo: { messageId: message.id, mode },
  };
  const sign = signatureHtml(signature);

  if (mode === 'forward') {
    const header = [
      '---------- Forwarded message ---------',
      `From: ${person(message.from)}`,
      `Date: ${escapeHtml(when(message.receivedAt))}`,
      `Subject: ${escapeHtml(message.subject)}`,
      `To: ${message.to.map(person).join(', ')}`,
      ...(message.cc.length ? [`Cc: ${message.cc.map(person).join(', ')}`] : []),
    ].join('<br>');
    return {
      ...base,
      to: [],
      cc: [],
      subject: prefixed(message.subject, 'Fwd'),
      html: `<br>${sign}<br><div class="onebox-forward">${header}<br><br>${originalBody(message)}</div>`,
      attachments: [],
    };
  }

  const to = notMine(replyTarget);
  const cc =
    mode === 'replyAll'
      ? notMine([...message.to, ...message.cc].map(toRecipient)).filter(
          (r) => !to.some((t) => t.address === r.address),
        )
      : [];
  return {
    ...base,
    to,
    cc,
    subject: prefixed(message.subject, 'Re'),
    html:
      `<br>${sign}<br><div class="onebox-quote">On ${escapeHtml(when(message.receivedAt))}, ${person(message.from)} wrote:<br>` +
      `<blockquote style="margin:0 0 0 .8ex;border-left:1px solid #ccc;padding-left:1ex">${originalBody(message)}</blockquote></div>`,
    attachments: [],
  };
}

// Whether there's anything worth keeping as a draft.
export const hasContent = (composition: Composition) =>
  composition.to.length + composition.cc.length + composition.bcc.length > 0 ||
  composition.subject.trim() !== '' ||
  composition.text.trim() !== '' ||
  composition.attachments.length > 0;
