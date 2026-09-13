import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import * as AuthContext from '../context/AuthContext.js';
import * as WishlistContext from '../context/WishlistContext.js';
import { ToastProvider } from '../context/ToastContext.js';
import { Toast } from './Toast.js';
import { WishlistButton } from './WishlistButton.js';

function mockAuth(user: { id: string } | null) {
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
    user,
    status: user ? 'authenticated' : 'unauthenticated',
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  } as unknown as ReturnType<typeof AuthContext.useAuth>);
}

function mockWishlist(overrides: Partial<ReturnType<typeof WishlistContext.useWishlist>> = {}) {
  vi.spyOn(WishlistContext, 'useWishlist').mockReturnValue({
    wishlist: { items: [] },
    loading: false,
    error: null,
    isWishlisted: () => false,
    addProduct: vi.fn(),
    removeProduct: vi.fn(),
    refresh: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof WishlistContext.useWishlist>);
}

function renderButton(slug = 'aurelia-nova') {
  return render(
    <MemoryRouter initialEntries={['/p/aurelia-nova']}>
      <ToastProvider>
        <Routes>
          <Route path="/p/:productSlug" element={<WishlistButton slug={slug} />} />
          <Route path="/login" element={<div>login-page</div>} />
        </Routes>
        <Toast />
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('WishlistButton', () => {
  it('shows "Add to wishlist" and aria-pressed=false when not wishlisted', () => {
    mockAuth({ id: 'u1' });
    mockWishlist({ isWishlisted: () => false });
    renderButton();
    const btn = screen.getByRole('button', { name: 'Add to wishlist' });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows "Remove from wishlist" and aria-pressed=true when already wishlisted', () => {
    mockAuth({ id: 'u1' });
    mockWishlist({ isWishlisted: () => true });
    renderButton();
    const btn = screen.getByRole('button', { name: 'Remove from wishlist' });
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('sends a signed-out shopper to login instead of calling the API', async () => {
    mockAuth(null);
    const addProduct = vi.fn();
    mockWishlist({ addProduct });
    renderButton();

    await userEvent.click(screen.getByRole('button', { name: 'Add to wishlist' }));

    expect(await screen.findByText('login-page')).toBeInTheDocument();
    expect(addProduct).not.toHaveBeenCalled();
  });

  it('adds the product and shows a success toast', async () => {
    mockAuth({ id: 'u1' });
    const addProduct = vi.fn().mockResolvedValue(undefined);
    mockWishlist({ isWishlisted: () => false, addProduct });
    renderButton('aurelia-nova');

    await userEvent.click(screen.getByRole('button', { name: 'Add to wishlist' }));

    await waitFor(() => expect(addProduct).toHaveBeenCalledWith('aurelia-nova'));
    expect(await screen.findByText('Added to your wishlist')).toBeInTheDocument();
  });

  it('removes the product without a toast', async () => {
    mockAuth({ id: 'u1' });
    const removeProduct = vi.fn().mockResolvedValue(undefined);
    mockWishlist({ isWishlisted: () => true, removeProduct });
    renderButton('aurelia-nova');

    await userEvent.click(screen.getByRole('button', { name: 'Remove from wishlist' }));

    await waitFor(() => expect(removeProduct).toHaveBeenCalledWith('aurelia-nova'));
  });

  it('shows an error toast when the API call fails', async () => {
    mockAuth({ id: 'u1' });
    const addProduct = vi.fn().mockRejectedValue(new Error('boom'));
    mockWishlist({ isWishlisted: () => false, addProduct });
    renderButton();

    await userEvent.click(screen.getByRole('button', { name: 'Add to wishlist' }));

    expect(await screen.findByText('Could not update your wishlist')).toBeInTheDocument();
  });
});
