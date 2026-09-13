import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../lib/apiClient.js';
import AdminOrdersPage from './AdminOrdersPage.js';

vi.mock('../lib/apiClient.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/apiClient.js')>();
  return { ...actual, apiFetch: vi.fn() };
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/orders']}>
      <Routes>
        <Route path="/admin/orders" element={<AdminOrdersPage />} />
        <Route path="/admin/orders/:id" element={<div>order-detail-page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminOrdersPage', () => {
  it('shows an empty state when there are no orders', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ items: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } });
    renderPage();
    expect(await screen.findByText('No orders found')).toBeInTheDocument();
  });

  it('lists orders with a link to detail', async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      items: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          status: 'CONFIRMED',
          currency: 'INR',
          grandTotal: '579.00',
          customerEmail: 'priya@example.com',
          itemCount: 1,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
    renderPage();
    expect(await screen.findByRole('link', { name: /22222222/ })).toHaveAttribute(
      'href',
      '/admin/orders/22222222-2222-4222-8222-222222222222',
    );
    expect(screen.getByText('priya@example.com')).toBeInTheDocument();
  });
});
