// Two accounts on the same provider share a logo, so each also gets a stable colour.
export const ACCOUNT_COLORS = [
  '#1a73e8',
  '#d93025',
  '#188038',
  '#e37400',
  '#9334e6',
  '#c5221f',
  '#007b83',
  '#b06000',
];

export function accountColor(accountId: string): string {
  let hash = 0;
  for (const char of accountId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return ACCOUNT_COLORS[hash % ACCOUNT_COLORS.length]!;
}

export const accountLabel = (account: { displayName: string | null; emailAddress: string }) =>
  account.displayName ?? account.emailAddress;
