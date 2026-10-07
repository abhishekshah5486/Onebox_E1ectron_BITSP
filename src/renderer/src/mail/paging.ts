export const PAGE_SIZE = 50;

export function rangeLabel(page: number, count: number, total?: number | null) {
  if (count === 0) return total ? `0 of ${total.toLocaleString()}` : '0';
  const start = (page - 1) * PAGE_SIZE + 1;
  const range = `${start.toLocaleString()}–${(start + count - 1).toLocaleString()}`;
  return total ? `${range} of ${total.toLocaleString()}` : range;
}
