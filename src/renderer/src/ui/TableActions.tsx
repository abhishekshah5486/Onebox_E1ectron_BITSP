import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import type { ReactNode } from 'react';

export type ExportRow = Record<string, string | number | boolean | null>;

// Saves the rows as a spreadsheet; SheetJS loads only when someone exports.
export async function exportRows(rows: ExportRow[], name: string, format: 'csv' | 'xlsx') {
  const XLSX = await import('xlsx');
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), name.slice(0, 31));
  const day = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(book, `onebox-${name.toLowerCase().replace(/\s+/g, '-')}-${day}.${format}`, {
    bookType: format,
  });
}

// A table's refresh and export buttons, before any of its own actions.
export function TableActions({
  name,
  rows,
  onRefresh,
  refreshing = false,
  children,
}: {
  // Names the file, e.g. "Payments" → onebox-payments-2026-10-10.csv.
  name: string;
  rows: () => ExportRow[];
  onRefresh: () => void;
  refreshing?: boolean;
  children?: ReactNode;
}) {
  return (
    <SpaceBetween direction="horizontal" size="xs">
      <Button
        iconName="refresh"
        ariaLabel={`Refresh ${name.toLowerCase()}`}
        loading={refreshing}
        onClick={onRefresh}
      />
      <Button iconName="download" onClick={() => void exportRows(rows(), name, 'csv')}>
        CSV
      </Button>
      <Button iconName="download" onClick={() => void exportRows(rows(), name, 'xlsx')}>
        XLSX
      </Button>
      {children}
    </SpaceBetween>
  );
}
