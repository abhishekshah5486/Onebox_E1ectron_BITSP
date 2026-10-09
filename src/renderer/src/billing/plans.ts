export type PlanId = 'FREE' | 'STANDARD' | 'PRO';

// What a feature is about, so each interface can show its own icon for it.
export type FeatureKind =
  | 'inbox'
  | 'storage'
  | 'ai'
  | 'draft'
  | 'model'
  | 'credit'
  | 'automation'
  | 'support'
  | 'new'
  | 'everything';

export interface Feature {
  text: string;
  kind: FeatureKind;
}
export type BillingInterval = 'monthly' | 'annual';

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  // Prices in paise; annual is the per-month price when paid yearly.
  monthlyPrice: number;
  annualMonthlyPrice: number;
  // Credits each billing period (once, for Free).
  credits: number;
  bonusCredits: number;
  features: Feature[];
}

// Starting numbers, to be confirmed: 1 credit is worth $0.01 of AI usage, billed at 2x cost.
export const PLANS: Plan[] = [
  {
    id: 'FREE',
    name: 'Free',
    tagline: 'Try OneBox with your own inboxes',
    monthlyPrice: 0,
    annualMonthlyPrice: 0,
    credits: 20,
    bonusCredits: 0,
    features: [
      { text: 'Unified inbox for all your accounts', kind: 'inbox' },
      { text: 'Save attachments to cloud storage', kind: 'storage' },
      { text: '20 AI credits to try sorting, once', kind: 'credit' },
    ],
  },
  {
    id: 'STANDARD',
    name: 'Standard',
    tagline: 'For people who live in their inbox',
    monthlyPrice: 49_900,
    annualMonthlyPrice: 41_500,
    credits: 500,
    bonusCredits: 250,
    features: [
      { text: 'AI sorting into your own labels', kind: 'ai' },
      { text: 'Suggestions you review before they apply', kind: 'ai' },
      { text: 'Summaries and reply drafts', kind: 'draft' },
      { text: 'Choose the AI model for each task', kind: 'model' },
      { text: 'Buy extra credits when you need them', kind: 'credit' },
    ],
  },
  {
    id: 'PRO',
    name: 'Pro',
    tagline: 'For busy teams and power users',
    monthlyPrice: 149_900,
    annualMonthlyPrice: 124_900,
    credits: 2_000,
    bonusCredits: 0,
    features: [
      { text: 'Everything in Standard', kind: 'everything' },
      { text: '4x the monthly credits', kind: 'credit' },
      { text: 'Automation rules and Slack alerts', kind: 'automation' },
      { text: 'Priority support', kind: 'support' },
      { text: 'Early access to new AI features', kind: 'new' },
    ],
  },
];

export const ANNUAL_SAVING = '17%';

// The plans side by side, row by row: true / false for included or not, or a short value.
export interface ComparisonRow {
  feature: string;
  values: Record<PlanId, boolean | string>;
}

export const COMPARISON: ComparisonRow[] = [
  {
    feature: 'AI credits',
    values: { FREE: '20, once', STANDARD: '500 a month', PRO: '2,000 a month' },
  },
  {
    feature: 'Bonus credits',
    values: { FREE: false, STANDARD: '250 in the first month', PRO: false },
  },
  {
    feature: 'Unified inbox for all your accounts',
    values: { FREE: true, STANDARD: true, PRO: true },
  },
  {
    feature: 'Save attachments to cloud storage',
    values: { FREE: true, STANDARD: true, PRO: true },
  },
  {
    feature: 'AI sorting into your own labels',
    values: { FREE: 'With free credits', STANDARD: true, PRO: true },
  },
  {
    feature: 'Suggestions you review before they apply',
    values: { FREE: false, STANDARD: true, PRO: true },
  },
  { feature: 'Summaries and reply drafts', values: { FREE: false, STANDARD: true, PRO: true } },
  {
    feature: 'Choose the AI model for each task',
    values: { FREE: false, STANDARD: true, PRO: true },
  },
  { feature: 'Buy extra credits', values: { FREE: false, STANDARD: true, PRO: true } },
  {
    feature: 'Automation rules and Slack alerts',
    values: { FREE: false, STANDARD: false, PRO: true },
  },
  { feature: 'Priority support', values: { FREE: false, STANDARD: false, PRO: true } },
  {
    feature: 'Early access to new AI features',
    values: { FREE: false, STANDARD: false, PRO: true },
  },
];

// Free has no yearly price, so yearly billing only lists the paid plans.
export const plansFor = (interval: BillingInterval) =>
  interval === 'annual' ? PLANS.filter((plan) => plan.monthlyPrice > 0) : PLANS;

export const planById = (id: PlanId) => PLANS.find((plan) => plan.id === id)!;

export const formatRupees = (paise: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(paise / 100);

// Credits have three decimals, as billing keeps them, e.g. 0.038 or 1,999.962; whole numbers
// stay whole (500).
export const formatCredits = (credits: number) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 }).format(credits);
