import type { Billing, LedgerEntry } from '../billing/billing';

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

// A Free user's month: the sign-up grant and a few AI actions, newest first.
export function sampleBilling(): Billing {
  const charges: Omit<LedgerEntry, 'id' | 'balanceAfter' | 'modelId'>[] = [
    {
      at: minutesAgo(5),
      kind: 'charge',
      description: 'Sorted an email into labels',
      model: 'Kimi K3',
      credits: -0.4,
    },
    {
      at: minutesAgo(18),
      kind: 'charge',
      description: 'Sorted an email into labels',
      model: 'Grok 4.7',
      credits: -0.4,
    },
    {
      at: minutesAgo(42),
      kind: 'charge',
      description: 'Summarised a conversation',
      model: 'Claude Sonnet 5.5',
      credits: -1.2,
    },
    {
      at: minutesAgo(65),
      kind: 'refund',
      description: 'Model call failed, credits returned',
      model: 'DeepSeek V4 Pro',
      credits: 0.6,
    },
    {
      at: minutesAgo(66),
      kind: 'charge',
      description: 'Sorted an email into labels',
      model: 'DeepSeek V4 Pro',
      credits: -0.6,
    },
    {
      at: minutesAgo(120),
      kind: 'charge',
      description: 'Drafted a reply',
      model: 'GPT-5.6 Terra',
      credits: -2.1,
    },
    {
      at: minutesAgo(180),
      kind: 'charge',
      description: 'Sorted an email into labels',
      model: 'Kimi K3',
      credits: -0.4,
    },
    {
      at: minutesAgo(240),
      kind: 'charge',
      description: 'Sorted an email into labels',
      model: 'Gemini 3.5 Flash',
      credits: -0.3,
    },
    {
      at: minutesAgo(1440),
      kind: 'charge',
      description: 'Summarised a conversation',
      model: 'Kimi K3',
      credits: -0.9,
    },
    {
      at: minutesAgo(1500),
      kind: 'charge',
      description: 'Sorted an email into labels',
      model: 'Kimi K3',
      credits: -0.4,
    },
    {
      at: minutesAgo(2880),
      kind: 'charge',
      description: 'Drafted a reply',
      model: 'Claude Sonnet 5.5',
      credits: -1.7,
    },
    {
      at: minutesAgo(4320),
      kind: 'grant',
      description: 'Free plan credits',
      model: null,
      credits: 20,
    },
  ];
  // Running balance, oldest first.
  let balance = 0;
  const ledger = [...charges]
    .reverse()
    .map((entry, index) => {
      balance = Math.round((balance + entry.credits) * 10) / 10;
      return { ...entry, id: `preview-${index}`, modelId: null, balanceAfter: balance };
    })
    .reverse();
  return {
    subscription: { plan: 'FREE', interval: null, status: 'free', renewsAt: null },
    balance,
    periodCredits: 20,
    ledger,
  };
}
