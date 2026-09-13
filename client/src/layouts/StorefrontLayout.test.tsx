import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch } from '../lib/apiClient.js';
import * as AuthContext from '../context/AuthContext.js';
import * as CartContext from '../context/CartContext.js';
import { StorefrontLayout } from './StorefrontLayout.js';

vi.mock('../lib/apiClient.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/apiClient.js')>();
  return { ...actual, apiFetch: vi.fn() };
});

function renderLayout(itemCount = 0) {
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
    user: null,
    status: 'unauthenticated',
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  } as unknown as ReturnType<typeof AuthContext.useAuth>);

  vi.spyOn(CartContext, 'useCart').mockReturnValue({
    cart: { items: [], itemCount, subtotal: '0.00' },
    loading: false,
    addItem: vi.fn(),
    updateItemQty: vi.fn(),
    removeItem: vi.fn(),
    clearCart: vi.fn(),
    refresh: vi.fn(),
  } as unknown as ReturnType<typeof CartContext.useCart>);

  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<StorefrontLayout />}>
          <Route index element={<div>home-outlet</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('StorefrontLayout', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it('keeps the Everyday brand name and auth links when settings and categories fail', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new ApiError(500, 'INTERNAL', 'Request failed'));
    renderLayout();

    expect(await screen.findByText('home-outlet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Everyday' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Create account' })).toHaveAttribute('href', '/register');
    expect(screen.getByRole('link', { name: 'Cart' })).toHaveAttribute('href', '/cart');
    expect(screen.getByRole('link', { name: 'Wishlist' })).toHaveAttribute('href', '/wishlist');
  });

  it('uses store name and top-level shop links on success', async () => {
    vi.mocked(apiFetch).mockImplementation(async (path: string) => {
      const url = String(path);
      if (url === '/api/catalog/settings') {
        return { storeName: 'Helix House', logoUrl: null, contactEmail: 'hello@example.com' };
      }
      if (url === '/api/catalog/categories') {
        return {
          categories: [
            {
              slug: 'over-ear',
              name: 'Over-ear',
              children: [{ slug: 'closed-back', name: 'Closed-back', children: [] }],
            },
          ],
        };
      }
      throw new Error(`unexpected ${url}`);
    });
    renderLayout();

    expect(await screen.findByRole('link', { name: 'Helix House' })).toHaveAttribute('href', '/');
    const shopLinks = screen.getAllByRole('link', { name: 'Shop' });
    expect(shopLinks.length).toBeGreaterThan(0);
    expect(shopLinks.every((link) => link.getAttribute('href') === '/products')).toBe(true);
    const categoryLinks = screen.getAllByRole('link', { name: 'Over-ear' });
    expect(categoryLinks.every((link) => link.getAttribute('href') === '/c/over-ear')).toBe(true);
    expect(screen.queryByRole('link', { name: 'Closed-back' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.getByText('home-outlet')).toBeInTheDocument();
  });

  it('shows the cart item count as an accessible label', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new ApiError(500, 'INTERNAL', 'Request failed'));
    renderLayout(3);
    expect(await screen.findByRole('link', { name: 'Cart, 3 items' })).toHaveAttribute('href', '/cart');
  });

  it('opens and closes the mobile navigation drawer', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    vi.mocked(apiFetch).mockRejectedValue(new ApiError(500, 'INTERNAL', 'Request failed'));
    renderLayout();

    await screen.findByText('home-outlet');
    expect(screen.queryByLabelText('Close menu')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getAllByLabelText('Close menu').length).toBeGreaterThan(0);
    await user.click(screen.getAllByRole('button', { name: 'Close menu' })[0]);
    expect(screen.queryByLabelText('Close menu')).not.toBeInTheDocument();
  });
});
