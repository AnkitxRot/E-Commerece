import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../lib/apiClient.js';
import { ToastProvider } from '../context/ToastContext.js';
import { Toast } from '../components/Toast.js';
import AdminBrandsPage from './AdminBrandsPage.js';

vi.mock('../lib/apiClient.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/apiClient.js')>();
  return { ...actual, apiFetch: vi.fn() };
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/brands']}>
      <ToastProvider>
        <Routes>
          <Route path="/admin/brands" element={<AdminBrandsPage />} />
        </Routes>
        <Toast />
      </ToastProvider>
    </MemoryRouter>,
  );
}

const BRAND = {
  id: '22222222-2222-4222-8222-222222222222',
  slug: 'aurelia',
  name: 'Aurelia',
  logoUrl: null,
  isActive: true,
  productCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('AdminBrandsPage', () => {
  it('shows an empty state when there are no brands', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ brands: [] });
    renderPage();
    expect(await screen.findByText('No brands yet')).toBeInTheDocument();
  });

  it('shows an error state with retry when the list fails to load', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error('network down'));
    renderPage();
    expect(await screen.findByText('Unable to load brands')).toBeInTheDocument();
  });

  it('lists brands with their status and product count', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ brands: [BRAND] });
    renderPage();
    expect(await screen.findByText('Aurelia')).toBeInTheDocument();
    expect(screen.getByText('aurelia')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('validates the create form before submitting', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ brands: [] });
    renderPage();
    await screen.findByText('No brands yet');
    await userEvent.click(screen.getByRole('button', { name: 'Create brand' }));
    expect(await screen.findAllByText(/String must contain|Invalid/i)).not.toHaveLength(0);
  });

  it('creates a brand and shows it in the list', async () => {
    const created = { ...BRAND, id: '44444444-4444-4444-8444-444444444444', name: 'Nova', slug: 'nova' };
    vi.mocked(apiFetch).mockImplementation((path: string, options?: RequestInit) => {
      if (options?.method === 'POST') return Promise.resolve({ brand: created });
      return Promise.resolve({ brands: [] });
    });
    renderPage();
    await screen.findByText('No brands yet');

    await userEvent.type(screen.getByLabelText('Name'), 'Nova');
    await userEvent.click(screen.getByRole('button', { name: 'Create brand' }));

    expect(await screen.findByText('Brand created')).toBeInTheDocument();
    expect(await screen.findByText('Nova')).toBeInTheDocument();
  });

  it('deactivates an active brand', async () => {
    vi.mocked(apiFetch).mockImplementation((path: string, options?: RequestInit) => {
      if (options?.method === 'PATCH') return Promise.resolve({ brand: { ...BRAND, isActive: false } });
      return Promise.resolve({ brands: [BRAND] });
    });
    renderPage();
    await screen.findByText('Aurelia');

    await userEvent.click(screen.getByRole('button', { name: 'Deactivate' }));

    expect(await screen.findByText('Brand deactivated')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('shows an error toast when delete is blocked by product references', async () => {
    vi.mocked(apiFetch).mockImplementation((path: string, options?: RequestInit) => {
      if (options?.method === 'DELETE') return Promise.reject(new Error('boom'));
      return Promise.resolve({ brands: [BRAND] });
    });
    renderPage();
    await screen.findByText('Aurelia');

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Could not delete this brand')).toBeInTheDocument();
  });
});
