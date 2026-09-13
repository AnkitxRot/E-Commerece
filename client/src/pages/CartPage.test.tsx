import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { CartDto } from '@audio-commerce/shared';
import * as CartContext from '../context/CartContext.js';
import { ToastProvider } from '../context/ToastContext.js';
import { Toast } from '../components/Toast.js';
import CartPage from './CartPage.js';

const item: CartDto['items'][number] = {
  id: '11111111-1111-4111-8111-111111111111',
  variantId: '22222222-2222-4222-8222-222222222222',
  sku: 'HEL-BLK-01',
  productSlug: 'helix-lineage',
  productName: 'Helix Lineage',
  attributes: { color: 'Midnight' },
  thumbnail: null,
  unitPrice: '52990.00',
  compareAtPrice: null,
  qty: 2,
  availableQty: 5,
  inStock: true,
  lineTotal: '105980.00',
};

function mockCart(cart: CartDto | null, overrides: Partial<ReturnType<typeof CartContext.useCart>> = {}) {
  vi.spyOn(CartContext, 'useCart').mockReturnValue({
    cart,
    loading: false,
    addItem: vi.fn(),
    updateItemQty: vi.fn(),
    removeItem: vi.fn(),
    clearCart: vi.fn(),
    refresh: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof CartContext.useCart>);
}

function renderCartPage() {
  return render(
    <MemoryRouter initialEntries={['/cart']}>
      <ToastProvider>
        <Routes>
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<div>checkout-page</div>} />
          <Route path="/products" element={<div>products-page</div>} />
        </Routes>
        <Toast />
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('CartPage', () => {
  it('shows an empty state with a continue shopping action', () => {
    mockCart({ items: [], itemCount: 0, subtotal: '0.00' });
    renderCartPage();
    expect(screen.getByText('Your cart is empty')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continue shopping' })).toHaveAttribute('href', '/products');
  });

  it('lists items and shows their line total', () => {
    mockCart({ items: [item], itemCount: 2, subtotal: '105980.00' });
    renderCartPage();
    expect(screen.getByText('Helix Lineage')).toBeInTheDocument();
    expect(screen.getAllByText('₹1,05,980.00').length).toBeGreaterThan(0);
  });

  it('charges flat shipping below the free threshold and totals correctly', () => {
    const cheapItem = { ...item, unitPrice: '300.00', qty: 1, lineTotal: '300.00' };
    mockCart({ items: [cheapItem], itemCount: 1, subtotal: '300.00' });
    renderCartPage();
    expect(screen.getByText('₹79.00')).toBeInTheDocument();
    expect(screen.getByText('₹379.00')).toBeInTheDocument();
  });

  it('shows free shipping at or above the ₹999 threshold', () => {
    mockCart({ items: [item], itemCount: 2, subtotal: '105980.00' });
    renderCartPage();
    expect(screen.getByText('Free')).toBeInTheDocument();
  });

  it('increments quantity via the stepper', async () => {
    const updateItemQty = vi.fn().mockResolvedValue(undefined);
    mockCart({ items: [item], itemCount: 2, subtotal: '105980.00' }, { updateItemQty });
    renderCartPage();

    await userEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));
    await waitFor(() => expect(updateItemQty).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', 3));
  });

  it('removes an item and shows a confirmation toast', async () => {
    const removeItem = vi.fn().mockResolvedValue(undefined);
    mockCart({ items: [item], itemCount: 2, subtotal: '105980.00' }, { removeItem });
    renderCartPage();

    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(removeItem).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111'));
    expect(await screen.findByText('Removed from cart')).toBeInTheDocument();
  });

  it('blocks checkout when an item exceeds available stock', () => {
    mockCart({ items: [{ ...item, qty: 10, availableQty: 5 }], itemCount: 10, subtotal: '529900.00' });
    renderCartPage();
    expect(screen.getByText(/Only 5 left/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Proceed to checkout' })).toBeDisabled();
  });

  it('navigates to checkout when proceeding', async () => {
    mockCart({ items: [item], itemCount: 2, subtotal: '105980.00' });
    renderCartPage();
    await userEvent.click(screen.getByRole('button', { name: 'Proceed to checkout' }));
    expect(await screen.findByText('checkout-page')).toBeInTheDocument();
  });
});
