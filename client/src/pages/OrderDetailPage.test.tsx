import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch } from '../lib/apiClient.js';
import OrderDetailPage from './OrderDetailPage.js';

vi.mock('../lib/apiClient.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/apiClient.js')>();
  return { ...actual, apiFetch: vi.fn() };
});

const order = {
  id: '33333333-3333-4333-8333-333333333333',
  status: 'CONFIRMED' as const,
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
  items: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      productSlug: 'helix-lineage',
      productName: 'Helix Lineage',
      variantSku: 'HEL-BLK-01',
      variantAttributes: { color: 'Midnight' },
      unitPrice: '500.00',
      qty: 1,
      lineTotal: '500.00',
    },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
};

function renderOrder(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/orders/:orderId" element={<OrderDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('OrderDetailPage', () => {
  it('shows a confirmation banner when just placed', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ order });
    renderOrder('/orders/33333333-3333-4333-8333-333333333333?confirmed=1');
    expect(await screen.findByText(/your order is confirmed/i)).toBeInTheDocument();
    expect(screen.getByText('Helix Lineage')).toBeInTheDocument();
    expect(screen.getByText('₹579.00')).toBeInTheDocument();
  });

  it('omits the confirmation banner when viewed from order history', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ order });
    renderOrder('/orders/33333333-3333-4333-8333-333333333333');
    expect(await screen.findByRole('heading', { name: 'Order details' })).toBeInTheDocument();
    expect(screen.queryByText(/your order is confirmed/i)).not.toBeInTheDocument();
  });

  it('shows a not-found state for another user\'s order', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'Forbidden'));
    renderOrder('/orders/44444444-4444-4444-8444-444444444444');
    expect(await screen.findByRole('heading', { name: 'Order not found' })).toBeInTheDocument();
  });
});
