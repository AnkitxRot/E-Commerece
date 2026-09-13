import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch } from '../lib/apiClient.js';
import AdminOverviewPage from './AdminOverviewPage.js';

vi.mock('../lib/apiClient.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/apiClient.js')>();
  return { ...actual, apiFetch: vi.fn() };
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/admin" element={<AdminOverviewPage />} />
        <Route path="/admin/orders" element={<div>orders-page</div>} />
        <Route path="/admin/orders/:id" element={<div>order-detail-page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const DASHBOARD = {
  productCount: 12,
  activeProductCount: 10,
  orderCount: 3,
  revenueTotal: '1499.00',
  lowStockCount: 1,
  recentOrders: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      status: 'CONFIRMED',
      currency: 'INR',
      grandTotal: '999.00',
      customerEmail: 'shopper@example.com',
      itemCount: 2,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
};

describe('AdminOverviewPage', () => {
  it('renders stats and recent orders once loaded', async () => {
    vi.mocked(apiFetch).mockResolvedValue(DASHBOARD);
    renderPage();
    expect(await screen.findByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('shopper@example.com')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /11111111/ })).toHaveAttribute(
      'href',
      '/admin/orders/11111111-1111-4111-8111-111111111111',
    );
  });

  it('shows an error state with retry on failure', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new ApiError(500, 'SERVER_ERROR', 'Something broke'));
    vi.mocked(apiFetch).mockResolvedValueOnce(DASHBOARD);
    renderPage();
    expect(await screen.findByText('Unable to load the dashboard')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Dashboard')).toBeInTheDocument();
  });
});
