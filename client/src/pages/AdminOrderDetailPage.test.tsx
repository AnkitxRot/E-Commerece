import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../lib/apiClient.js';
import AdminOrderDetailPage from './AdminOrderDetailPage.js';

vi.mock('../lib/apiClient.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/apiClient.js')>();
  return { ...actual, apiFetch: vi.fn() };
});

function order(status: string) {
  return {
    order: {
      id: '33333333-3333-4333-8333-333333333333',
      status,
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
      customer: { id: '55555555-5555-4555-8555-555555555555', email: 'priya@example.com', name: 'Priya Sharma' },
      items: [
        {
          id: '66666666-6666-4666-8666-666666666666',
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
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/orders/33333333-3333-4333-8333-333333333333']}>
      <Routes>
        <Route path="/admin/orders/:id" element={<AdminOrderDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminOrderDetailPage', () => {
  it('renders order detail with items and totals', async () => {
    vi.mocked(apiFetch).mockResolvedValue(order('CONFIRMED'));
    renderPage();
    expect(await screen.findByText('priya@example.com', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Helix Lineage')).toBeInTheDocument();
    expect(screen.getByText('₹579.00')).toBeInTheDocument();
  });

  it('applies a status transition', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(order('CONFIRMED'));
    vi.mocked(apiFetch).mockResolvedValueOnce(order('PROCESSING'));
    renderPage();
    await screen.findByText('Helix Lineage');

    await userEvent.selectOptions(screen.getByLabelText('Update status'), 'PROCESSING');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(vi.mocked(apiFetch)).toHaveBeenLastCalledWith(
      '/api/admin/orders/33333333-3333-4333-8333-333333333333/status',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ status: 'PROCESSING' }) }),
    );
    expect(await screen.findByText('PROCESSING', { exact: true })).toBeInTheDocument();
  });
});
