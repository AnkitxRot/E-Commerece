import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import RegisterPage from './RegisterPage.js';
import * as AuthContext from '../context/AuthContext.js';

describe('RegisterPage', () => {
  it('rejects a password shorter than 8 characters before calling the API', async () => {
    const register = vi.fn();
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ register, status: 'idle' } as unknown as ReturnType<typeof AuthContext.useAuth>);
    render(<RegisterPage />, { wrapper: MemoryRouter });

    await userEvent.type(screen.getByLabelText('Name'), 'Jane Doe');
    await userEvent.type(screen.getByLabelText('Email'), 'jane@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText(/at least 8/i)).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it('submits valid input to register', async () => {
    const register = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ register, status: 'idle' } as unknown as ReturnType<typeof AuthContext.useAuth>);
    render(<RegisterPage />, { wrapper: MemoryRouter });

    await userEvent.type(screen.getByLabelText('Name'), 'Jane Doe');
    await userEvent.type(screen.getByLabelText('Email'), 'jane@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(register).toHaveBeenCalledWith({ email: 'jane@example.com', password: 'password123', name: 'Jane Doe' });
  });
});
