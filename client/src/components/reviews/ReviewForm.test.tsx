import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import * as AuthContext from '../../context/AuthContext.js';
import { ToastProvider } from '../../context/ToastContext.js';
import { Toast } from '../Toast.js';
import { apiFetch } from '../../lib/apiClient.js';
import { ReviewForm } from './ReviewForm.js';

vi.mock('../../lib/apiClient.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/apiClient.js')>();
  return { ...actual, apiFetch: vi.fn() };
});

function mockAuth(user: { id: string } | null) {
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
    user,
    status: user ? 'authenticated' : 'unauthenticated',
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  } as unknown as ReturnType<typeof AuthContext.useAuth>);
}

function renderForm() {
  return render(
    <MemoryRouter initialEntries={['/p/aurelia-nova']}>
      <ToastProvider>
        <Routes>
          <Route path="/p/:slug" element={<ReviewForm productSlug="aurelia-nova" />} />
          <Route path="/login" element={<div>login-page</div>} />
        </Routes>
        <Toast />
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('ReviewForm', () => {
  it('prompts a signed-out visitor to log in', () => {
    mockAuth(null);
    renderForm();
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
  });

  it('validates that a rating and body are provided', async () => {
    mockAuth({ id: 'u1' });
    renderForm();

    await userEvent.click(screen.getByRole('button', { name: 'Submit review' }));

    expect(await screen.findByText('Select a rating.')).toBeInTheDocument();
    expect(screen.getByText('Write a review before submitting.')).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('selects a rating via click and submits successfully', async () => {
    mockAuth({ id: 'u1' });
    vi.mocked(apiFetch).mockResolvedValue({
      review: {
        id: '11111111-1111-4111-8111-111111111111',
        rating: 5,
        body: 'Great!',
        status: 'PENDING',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    });
    renderForm();

    await userEvent.click(screen.getByRole('radio', { name: '5 of 5 stars' }));
    await userEvent.type(screen.getByLabelText('Your review'), 'Great!');
    await userEvent.click(screen.getByRole('button', { name: 'Submit review' }));

    expect(await screen.findByText('Thanks — your review is awaiting approval.')).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith(
      '/api/products/aurelia-nova/reviews',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('selects a rating via keyboard arrows', async () => {
    mockAuth({ id: 'u1' });
    renderForm();

    const firstStar = screen.getByRole('radio', { name: '1 of 5 stars' });
    firstStar.focus();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');

    expect(screen.getByRole('radio', { name: '2 of 5 stars' })).toHaveAttribute('aria-checked', 'true');
  });

  it('shows an inline message when the user already reviewed the product', async () => {
    mockAuth({ id: 'u1' });
    const { ApiError } = await import('../../lib/apiClient.js');
    vi.mocked(apiFetch).mockRejectedValue(new ApiError(409, 'CONFLICT', 'You have already reviewed this product'));
    renderForm();

    await userEvent.click(screen.getByRole('radio', { name: '4 of 5 stars' }));
    await userEvent.type(screen.getByLabelText('Your review'), 'Fine.');
    await userEvent.click(screen.getByRole('button', { name: 'Submit review' }));

    expect(await screen.findByText('You have already reviewed this product.')).toBeInTheDocument();
  });

  it('shows an error toast for other failures', async () => {
    mockAuth({ id: 'u1' });
    vi.mocked(apiFetch).mockRejectedValue(new Error('boom'));
    renderForm();

    await userEvent.click(screen.getByRole('radio', { name: '4 of 5 stars' }));
    await userEvent.type(screen.getByLabelText('Your review'), 'Fine.');
    await userEvent.click(screen.getByRole('button', { name: 'Submit review' }));

    expect(await screen.findByText('Could not submit your review')).toBeInTheDocument();
  });
});
