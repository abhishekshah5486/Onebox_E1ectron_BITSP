import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type * as XLSX from 'xlsx';
import { TableActions } from './TableActions';

const writeFile = vi.fn();
vi.mock('xlsx', async (load) => ({ ...(await load<typeof XLSX>()), writeFile }));

describe('TableActions', () => {
  it('refreshes, and exports the rows as CSV or XLSX', async () => {
    const onRefresh = vi.fn();
    render(
      <TableActions
        name="Payments"
        rows={() => [{ Date: '9 Oct', Amount: 499 }]}
        onRefresh={onRefresh}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Refresh payments' }));
    expect(onRefresh).toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'CSV' }));
    await waitFor(() =>
      expect(writeFile).toHaveBeenLastCalledWith(
        expect.objectContaining({ SheetNames: ['Payments'] }),
        expect.stringMatching(/^onebox-payments-\d{4}-\d\d-\d\d\.csv$/),
        { bookType: 'csv' },
      ),
    );
    await userEvent.click(screen.getByRole('button', { name: 'XLSX' }));
    await waitFor(() =>
      expect(writeFile).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.stringMatching(/\.xlsx$/),
        { bookType: 'xlsx' },
      ),
    );
  });
});
