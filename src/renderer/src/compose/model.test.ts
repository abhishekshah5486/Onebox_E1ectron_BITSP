import { describe, expect, it } from 'vitest';
import type { Message } from '../api/mail';
import { hasContent, parseRecipients, replyComposition, signatureHtml } from './model';

const message: Message = {
  id: 'm1',
  accountId: 'acc-1',
  from: { name: 'Priya', address: 'Priya@acme.example' },
  to: [
    { name: 'Me', address: 'me@onebox.test' },
    { name: 'Sam', address: 'sam@acme.example' },
  ],
  cc: [{ name: '', address: 'lee@acme.example' }],
  replyTo: [],
  subject: 'Pricing for 20 seats',
  snippet: '',
  textBody: 'Can you send <pricing>?',
  htmlBody: null,
  hasRemoteImages: false,
  attachments: [],
  isRead: true,
  isStarred: false,
  receivedAt: '2026-10-08T10:00:00.000Z',
  sentAt: null,
  authentication: null,
};

describe('recipients', () => {
  it('reads names, bare addresses and separators, and keeps what is not an address', () => {
    expect(parseRecipients('Priya <Priya@Acme.example>, sam@acme.example; nope')).toEqual({
      recipients: [
        { name: 'Priya', address: 'priya@acme.example' },
        { name: null, address: 'sam@acme.example' },
      ],
      invalid: ['nope'],
    });
  });
});

describe('replies', () => {
  it('replies to the sender only, quoting the original safely', () => {
    const reply = replyComposition(message, 'reply', ['me@onebox.test'], 'Abhishek');
    expect(reply).toMatchObject({
      accountId: 'acc-1',
      to: [{ name: 'Priya', address: 'priya@acme.example' }],
      cc: [],
      subject: 'Re: Pricing for 20 seats',
      replyTo: { messageId: 'm1', mode: 'reply' },
    });
    expect(reply.html).toContain('&lt;pricing&gt;');
    expect(reply.html).toContain('Priya &lt;Priya@acme.example&gt; wrote:');
    expect(reply.html).toContain(signatureHtml('Abhishek'));
  });

  it('replies to everyone except the user, and does not stack prefixes', () => {
    const reply = replyComposition({ ...message, subject: 'RE: Pricing' }, 'replyAll', [
      'ME@onebox.test',
    ]);
    expect(reply.to.map((r) => r.address)).toEqual(['priya@acme.example']);
    expect(reply.cc.map((r) => r.address)).toEqual(['sam@acme.example', 'lee@acme.example']);
    expect(reply.subject).toBe('RE: Pricing');
  });

  it('forwards with the original details and no recipients', () => {
    const forward = replyComposition(message, 'forward', ['me@onebox.test']);
    expect(forward.to).toEqual([]);
    expect(forward.subject).toBe('Fwd: Pricing for 20 seats');
    expect(forward.html).toContain('---------- Forwarded message ---------');
  });

  it('answers your own message to the people you wrote to', () => {
    const mine = { ...message, from: { name: 'Me', address: 'me@onebox.test' } };
    expect(replyComposition(mine, 'reply', ['me@onebox.test']).to.map((r) => r.address)).toEqual([
      'sam@acme.example',
    ]);
  });
});

describe('drafts', () => {
  it('only keeps compositions with something in them', () => {
    const blank = replyComposition(message, 'forward', []);
    expect(hasContent({ ...blank, subject: '', text: '' })).toBe(false);
    expect(hasContent({ ...blank, subject: '', text: 'Hi' })).toBe(true);
  });
});
