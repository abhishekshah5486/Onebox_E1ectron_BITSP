import type { PaginationProps } from '@cloudscape-design/components/pagination';

export const PAGE_LABELS: PaginationProps.Labels = {
  nextPageLabel: 'Next page',
  previousPageLabel: 'Previous page',
  pageLabel: (number) => `Page ${number}`,
};
