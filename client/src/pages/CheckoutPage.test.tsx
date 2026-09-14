import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams, useSearchParams } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { CartDto } from '@audio-commerce/shared';
import * as CartContext from '../context/CartContext.js';
import { apiFetch } from '../lib/apiClient.js';
import CheckoutPage from './CheckoutPage.js';

vi.mock('../lib/apiClient.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/apiClient.js')>();
  return { ...actual, apiFetch: vi.fn() };
});

const cartWithItem: CartDto = {
  items: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      variantId: '22222222-2222-4222-8222-222222222222',
      sku: 'HEL-BLK-01',
      productSlug: 'helix-lineage',
      productName: 'Helix Lineage',
      attributes: { color: 'Midnight' },
      thumbnail: null,
      unitPrice: '500.00',
      compareAtPrice: null,
      qty: 1,
      availableQty: 5,
      inStock: true,
      lineTotal: '500.00',
    },
  ],
  itemCount: 1,
  subtotal: '500.00',
};

function mockCart(cart: CartDto | null) {
  vi.spyOn(CartContext, 'useCart').mockReturnValue({
    cart,
    loading: false,
    addItem: vi.fn(),
    updateItemQty: vi.fn(),
    removeItem: vi.fn(),
    clearCart: vi.fn(),
    refresh: vi.fn().mockResolvedValue(undefined),
  } as unknown as ReturnType<typeof CartContext.useCart>);
}

function OrderRouteProbe() {
  const { orderId } = useParams<{ orderId: string }>();
  const [params] = useSearchParams();
  return (
    <div>
      order-page-{orderId}-confirmed={params.get('confirmed')}
    </div>
  );
}

function renderCheckout() {
  return render(
    <MemoryRouter initialEntries={['/checkout']}>
      <Routes>
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/cart" element={<div>cart-page</div>} />
        <Route path="/orders/:orderId" element={<OrderRouteProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function fillAddress() {
  await userEvent.type(screen.getByLabelText('Full name'), 'Priya Sharma');
  await userEvent.type(screen.getByLabelText('Address line 1'), '221B Baker Street');
  await userEvent.type(screen.getByLabelText('City'), 'Mumbai');
  await userEvent.type(screen.getByLabelText('State'), 'Maharashtra');
  await userEvent.type(screen.getByLabelText('Postal code'), '400001');
  await userEvent.type(screen.getByLabelText('Phone'), '9876543210');
}

describe('CheckoutPage', () => {
  it('redirects to the cart when the cart is empty', () => {
    mockCart({ items: [], itemCount: 0, subtotal: '0.00' });
    renderCheckout();
    expect(screen.getByText('cart-page')).toBeInTheDocument();
  });

  it('shows a validation error when required fields are missing', async () => {
    mockCart(cartWithItem);
    renderCheckout();
    await userEvent.click(screen.getByRole('button', { name: 'Place order' }));
    expect((await screen.findAllByRole('alert')).length).toBeGreaterThan(0);
    expect(vi.mocked(apiFetch)).not.toHaveBeenCalled();
  });

  it('places the order and navigates to the confirmation page', async () => {
    mockCart(cartWithItem);
    vi.mocked(apiFetch).mockResolvedValue({
      order: {
        id: '33333333-3333-4333-8333-333333333333',
        status: 'CONFIRMED',
        currency: 'INR',
        subtotal: '500.00',
        discountTotal: '0.00',
        couponCode: null,
        shippingTotal: '79.00',
        taxTotal: '0.00',
        grandTotal: '579.00',
        shippingAddress: {
          fullName: 'Priya Sharma',
          line1: '221B Baker Street',
          city: 'Mumbai',
          state: 'Maharashtra',
          postalCode: '400001',
          country: 'India',
          phone: '9876543210',
        },
        items: [],
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    });
    renderCheckout();

    await fillAddress();
    await userEvent.click(screen.getByRole('button', { name: 'Place order' }));

    await waitFor(() => {
      expect(screen.getByText('order-page-33333333-3333-4333-8333-333333333333-confirmed=1')).toBeInTheDocument();
    });
    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
      '/api/orders',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('applies a coupon, shows the discount, and includes the code when placing the order', async () => {
    mockCart(cartWithItem);
    vi.mocked(apiFetch).mockImplementation((path: string, options?: RequestInit) => {
      if (path === '/api/coupons/validate') {
        return Promise.resolve({ coupon: { code: 'SAVE50', type: 'FIXED', value: '50.00', discountAmount: '50.00' } });
      }
      if (path === '/api/orders') {
        expect(JSON.parse(options!.body as string)).toMatchObject({ couponCode: 'SAVE50' });
        return Promise.resolve({
          order: {
            id: '77777777-7777-4777-8777-777777777777',
            status: 'CONFIRMED',
            currency: 'INR',
            subtotal: '500.00',
            discountTotal: '50.00',
            couponCode: 'SAVE50',
            shippingTotal: '79.00',
            taxTotal: '0.00',
            grandTotal: '529.00',
            shippingAddress: {
              fullName: 'Priya Sharma',
              line1: '221B Baker Street',
              city: 'Mumbai',
              state: 'Maharashtra',
              postalCode: '400001',
              country: 'India',
              phone: '9876543210',
            },
            items: [],
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        });
      }
      return Promise.reject(new Error(`unexpected path ${path}`));
    });
    renderCheckout();

    await fillAddress();
    await userEvent.type(screen.getByLabelText('Coupon code'), 'SAVE50');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await screen.findByText('SAVE50');
    expect(screen.getByText((_, element) => element?.textContent === 'Coupon SAVE50 applied')).toBeInTheDocument();
    expect(screen.getByText('Discount')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Place order' }));

    await waitFor(() => {
      expect(screen.getByText('order-page-77777777-7777-4777-8777-777777777777-confirmed=1')).toBeInTheDocument();
    });
  });

  it('shows an error and does not apply the coupon when validation fails', async () => {
    mockCart(cartWithItem);
    const { ApiError } = await import('../lib/apiClient.js');
    vi.mocked(apiFetch).mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'This coupon code is not valid.'));
    renderCheckout();

    await userEvent.type(screen.getByLabelText('Coupon code'), 'BOGUS');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(await screen.findByText('This coupon code is not valid.')).toBeInTheDocument();
    expect(screen.queryByText('Discount')).not.toBeInTheDocument();
  });

  it('shows a server error message without navigating on failure', async () => {
    mockCart(cartWithItem);
    const { ApiError } = await import('../lib/apiClient.js');
    vi.mocked(apiFetch).mockRejectedValue(new ApiError(409, 'CONFLICT', 'That item just sold out.'));
    renderCheckout();

    await fillAddress();
    await userEvent.click(screen.getByRole('button', { name: 'Place order' }));

    expect(await screen.findByText('That item just sold out.')).toBeInTheDocument();
  });
});
