import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import LoginPage from './LoginPage.js';
import * as AuthContext from '../context/AuthContext.js';

describe('LoginPage', () => {
  it('shows a validation error for an invalid email without calling the API', async () => {
    const login = vi.fn();
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ login, status: 'idle' } as unknown as ReturnType<typeof AuthContext.useAuth>);
    render(<LoginPage />, { wrapper: MemoryRouter });

    await userEvent.type(screen.getByLabelText('Email'), 'not-an-email');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('calls login with valid credentials and shows a server error on failure', async () => {
    const login = vi.fn().mockRejectedValue(new Error('Invalid email or password'));
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ login, status: 'idle' } as unknown as ReturnType<typeof AuthContext.useAuth>);
    render(<LoginPage />, { wrapper: MemoryRouter });

    await userEvent.type(screen.getByLabelText('Email'), 'me@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(login).toHaveBeenCalledWith({ email: 'me@example.com', password: 'password123' });
    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
  });
});
