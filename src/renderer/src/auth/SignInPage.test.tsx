import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import { fakeApi } from '../test/fake-api';
import { renderPage } from '../test/render';
import { SignInPage } from './SignInPage';

const fill = async (email: string, password: string) => {
  await userEvent.type(screen.getByLabelText('Email'), email);
  await userEvent.type(screen.getByLabelText('Password'), password);
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
};

describe('SignInPage', () => {
  it('signs in and goes to the inbox', async () => {
    const login = vi.fn(async () => ({
      id: 'u1',
      email: 'a@onebox.dev',
      name: 'A',
      createdAt: '',
    }));
    renderPage(<SignInPage />, { path: '/signin', api: fakeApi({ login }) });

    await fill('a@onebox.dev', 'correct-horse');

    expect(login).toHaveBeenCalledWith('a@onebox.dev', 'correct-horse');
    expect(await screen.findByText('at /inbox')).toBeInTheDocument();
  });

  it('shows the server message for bad credentials', async () => {
    const login = vi.fn(async () => {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    });
    renderPage(<SignInPage />, { path: '/signin', api: fakeApi({ login }) });

    await fill('a@onebox.dev', 'wrong-password');

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it('explains rate limiting in plain words', async () => {
    const login = vi.fn(async () => {
      throw new ApiError(429, 'RATE_LIMITED', 'Too many requests, retry in 30 seconds');
    });
    renderPage(<SignInPage />, { path: '/signin', api: fakeApi({ login }) });

    await fill('a@onebox.dev', 'pw-pw-pw-pw');
    expect(await screen.findByRole('alert')).toHaveTextContent(/wait a minute/);
  });

  it('asks for both fields before calling the api', async () => {
    const login = vi.fn();
    renderPage(<SignInPage />, { path: '/signin', api: fakeApi({ login }) });

    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Enter your email and password.');
    expect(login).not.toHaveBeenCalled();
  });

  it('links to account creation', async () => {
    renderPage(<SignInPage />, { path: '/signin' });
    await userEvent.click(screen.getByRole('link', { name: 'Create account' }));
    expect(await screen.findByText('at /signup')).toBeInTheDocument();
  });
});
