import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../lib/apiClient.js';
import AdminProductsPage from './AdminProductsPage.js';

vi.mock('../lib/apiClient.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/apiClient.js')>();
  return { ...actual, apiFetch: vi.fn() };
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/products']}>
      <Routes>
        <Route path="/admin/products" element={<AdminProductsPage />} />
        <Route path="/admin/products/new" element={<div>new-product-page</div>} />
        <Route path="/admin/products/:id" element={<div>edit-product-page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function listPayload() {
  return {
    items: [
      {
        id: '11111111-1111-4111-8111-111111111111',
        slug: 'aurelia-nova',
        name: 'Aurelia Nova',
        status: 'ACTIVE',
        basePrice: '19999.00',
        category: { id: '11111111-1111-4111-8111-111111111111', name: 'Over-ear' },
        brand: { id: '22222222-2222-4222-8222-222222222222', name: 'Aurelia' },
        totalStock: 2,
        lowStock: true,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
  };
}

describe('AdminProductsPage', () => {
  it('shows an empty state when there are no products', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ items: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } });
    renderPage();
    expect(await screen.findByText('No products found')).toBeInTheDocument();
  });

  it('lists products and flags low stock', async () => {
    vi.mocked(apiFetch).mockResolvedValue(listPayload());
    renderPage();
    expect(await screen.findByRole('link', { name: 'Aurelia Nova' })).toHaveAttribute(
      'href',
      '/admin/products/11111111-1111-4111-8111-111111111111',
    );
    expect(screen.getByText('2 (low)')).toBeInTheDocument();
  });

  it('refetches with a status filter', async () => {
    vi.mocked(apiFetch).mockResolvedValue(listPayload());
    renderPage();
    await screen.findByRole('link', { name: 'Aurelia Nova' });

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'DRAFT');

    expect(vi.mocked(apiFetch)).toHaveBeenLastCalledWith(
      expect.stringContaining('status=DRAFT'),
      expect.anything(),
    );
  });
});
