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
    // The saved-addresses list is fetched in the background regardless, but
    // no order should ever be submitted for an invalid manual address.
    expect(vi.mocked(apiFetch)).not.toHaveBeenCalledWith('/api/orders', expect.anything());
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

  const SAVED_ADDRESSES = [
    {
      id: '44444444-4444-4444-8444-444444444444',
      label: 'Home',
      line1: '10 Downing Street',
      line2: null,
      city: 'London',
      state: 'London',
      postalCode: 'SW1A 2AA',
      country: 'UK',
      phone: '5551234567',
      isDefault: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  function mockOrdersAndAddresses(addresses: typeof SAVED_ADDRESSES, orderId = '55555555-5555-4555-8555-555555555555') {
    vi.mocked(apiFetch).mockImplementation((path: string) => {
      if (path === '/api/addresses') return Promise.resolve({ addresses });
      if (path === '/api/orders') {
        return Promise.resolve({
          order: {
            id: orderId,
            status: 'CONFIRMED',
            currency: 'INR',
            subtotal: '500.00',
            discountTotal: '0.00',
            shippingTotal: '79.00',
            taxTotal: '0.00',
            grandTotal: '579.00',
            shippingAddress: {
              fullName: 'Priya Sharma',
              line1: '10 Downing Street',
              city: 'London',
              state: 'London',
              postalCode: 'SW1A 2AA',
              country: 'UK',
              phone: '5551234567',
            },
            items: [],
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        });
      }
      return Promise.reject(new Error(`unexpected path ${path}`));
    });
  }

  it('pre-selects the default saved address and checks out with it, without showing the manual form', async () => {
    mockCart(cartWithItem);
    mockOrdersAndAddresses(SAVED_ADDRESSES);
    renderCheckout();

    await screen.findByText('Home (default)');
    expect(screen.queryByLabelText('Full name')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Place order' }));

    await waitFor(() => {
      expect(screen.getByText('order-page-55555555-5555-4555-8555-555555555555-confirmed=1')).toBeInTheDocument();
    });
    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
      '/api/orders',
      expect.objectContaining({ body: JSON.stringify({ addressId: SAVED_ADDRESSES[0].id }) }),
    );
  });

  it('switches to the manual form when "Enter a new address" is chosen', async () => {
    mockCart(cartWithItem);
    mockOrdersAndAddresses(SAVED_ADDRESSES);
    renderCheckout();

    await screen.findByText('Home (default)');
    await userEvent.click(screen.getByRole('radio', { name: 'Enter a new address' }));
    expect(screen.getByLabelText('Full name')).toBeInTheDocument();

    await fillAddress();
    await userEvent.click(screen.getByRole('button', { name: 'Place order' }));

    await waitFor(() => {
      expect(screen.getByText('order-page-55555555-5555-4555-8555-555555555555-confirmed=1')).toBeInTheDocument();
    });
    const call = vi.mocked(apiFetch).mock.calls.find(([path]) => path === '/api/orders');
    expect(JSON.parse((call?.[1] as RequestInit).body as string)).toHaveProperty('shippingAddress');
  });

  it('shows only the manual form when there are no saved addresses', async () => {
    mockCart(cartWithItem);
    mockOrdersAndAddresses([]);
    renderCheckout();

    await waitFor(() => expect(vi.mocked(apiFetch)).toHaveBeenCalledWith('/api/addresses', expect.anything()));
    expect(screen.getByLabelText('Full name')).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
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
