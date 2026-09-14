import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../lib/apiClient.js';
import OrderHistoryPage from './OrderHistoryPage.js';

vi.mock('../lib/apiClient.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/apiClient.js')>();
  return { ...actual, apiFetch: vi.fn() };
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/account/orders']}>
      <Routes>
        <Route path="/account/orders" element={<OrderHistoryPage />} />
        <Route path="/orders/:orderId" element={<div>order-detail-page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('OrderHistoryPage', () => {
  it('shows an empty state when there are no orders', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ orders: [] });
    renderPage();
    expect(await screen.findByText('No orders yet')).toBeInTheDocument();
  });

  it('lists orders and links to their detail page', async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      orders: [
        {
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
          items: [
            {
              id: '11111111-1111-4111-8111-111111111111',
              productSlug: 'helix-lineage',
              productName: 'Helix Lineage',
              variantSku: 'HEL-BLK-01',
              variantAttributes: {},
              unitPrice: '500.00',
              qty: 1,
              lineTotal: '500.00',
            },
          ],
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
    renderPage();
    const link = await screen.findByRole('link', { name: /Order #33333333/ });
    expect(link).toHaveAttribute('href', '/orders/33333333-3333-4333-8333-333333333333');
    expect(screen.getByText('₹579.00')).toBeInTheDocument();
  });
});
