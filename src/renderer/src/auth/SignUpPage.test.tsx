import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import { fakeApi, testUser } from '../test/fake-api';
import { renderPage } from '../test/render';
import { SignUpPage } from './SignUpPage';

describe('SignUpPage', () => {
  it('creates the account with a trimmed name and goes to the inbox', async () => {
    const register = vi.fn(async () => testUser);
    renderPage(<SignUpPage />, { path: '/signup', api: fakeApi({ register }) });

    await userEvent.type(screen.getByLabelText('Full name'), '  Abhishek Shah ');
    await userEvent.type(screen.getByLabelText('Email'), 'abhishek@onebox.dev');
    await userEvent.type(screen.getByLabelText('Password'), 'long-enough-pw');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(register).toHaveBeenCalledWith({
      name: 'Abhishek Shah',
      email: 'abhishek@onebox.dev',
      password: 'long-enough-pw',
    });
    expect(await screen.findByText('at /inbox')).toBeInTheDocument();
  });

  it('flags a short password without calling the api', async () => {
    const register = vi.fn();
    renderPage(<SignUpPage />, { path: '/signup', api: fakeApi({ register }) });

    await userEvent.type(screen.getByLabelText('Full name'), 'A');
    await userEvent.type(screen.getByLabelText('Email'), 'a@onebox.dev');
    await userEvent.type(screen.getByLabelText('Password'), 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Use at least 10 characters')).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it('shows a taken email from the server', async () => {
    const register = vi.fn(async () => {
      throw new ApiError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
    });
    renderPage(<SignUpPage />, { path: '/signup', api: fakeApi({ register }) });

    await userEvent.type(screen.getByLabelText('Full name'), 'A');
    await userEvent.type(screen.getByLabelText('Email'), 'taken@onebox.dev');
    await userEvent.type(screen.getByLabelText('Password'), 'long-enough-pw');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('already exists');
  });
});
