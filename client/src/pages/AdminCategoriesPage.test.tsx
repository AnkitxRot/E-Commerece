import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../lib/apiClient.js';
import { ToastProvider } from '../context/ToastContext.js';
import { Toast } from '../components/Toast.js';
import AdminCategoriesPage from './AdminCategoriesPage.js';

vi.mock('../lib/apiClient.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/apiClient.js')>();
  return { ...actual, apiFetch: vi.fn() };
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/categories']}>
      <ToastProvider>
        <Routes>
          <Route path="/admin/categories" element={<AdminCategoriesPage />} />
        </Routes>
        <Toast />
      </ToastProvider>
    </MemoryRouter>,
  );
}

const CATEGORY = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'headphones',
  name: 'Headphones',
  parentId: null,
  parentName: null,
  isActive: true,
  productCount: 0,
  childCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('AdminCategoriesPage', () => {
  it('shows an empty state when there are no categories', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ categories: [] });
    renderPage();
    expect(await screen.findByText('No categories yet')).toBeInTheDocument();
  });

  it('shows an error state with retry when the list fails to load', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error('network down'));
    renderPage();
    expect(await screen.findByText('Unable to load categories')).toBeInTheDocument();
  });

  it('lists categories with their status and product count', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ categories: [CATEGORY] });
    renderPage();
    expect(await screen.findByRole('cell', { name: 'Headphones' })).toBeInTheDocument();
    expect(screen.getByText('headphones')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('validates the create form before submitting', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ categories: [] });
    renderPage();
    await screen.findByText('No categories yet');
    await userEvent.click(screen.getByRole('button', { name: 'Create category' }));
    expect(await screen.findAllByText(/String must contain|Invalid/i)).not.toHaveLength(0);
  });

  it('creates a category and shows it in the list', async () => {
    const created = { ...CATEGORY, id: '33333333-3333-4333-8333-333333333333', name: 'Speakers', slug: 'speakers' };
    vi.mocked(apiFetch).mockImplementation((path: string, options?: RequestInit) => {
      if (options?.method === 'POST') return Promise.resolve({ category: created });
      return Promise.resolve({ categories: [] });
    });
    renderPage();
    await screen.findByText('No categories yet');

    await userEvent.type(screen.getByLabelText('Name'), 'Speakers');
    await userEvent.click(screen.getByRole('button', { name: 'Create category' }));

    expect(await screen.findByText('Category created')).toBeInTheDocument();
    expect(await screen.findByRole('cell', { name: 'Speakers' })).toBeInTheDocument();
  });

  it('deactivates an active category', async () => {
    vi.mocked(apiFetch).mockImplementation((path: string, options?: RequestInit) => {
      if (options?.method === 'PATCH') return Promise.resolve({ category: { ...CATEGORY, isActive: false } });
      return Promise.resolve({ categories: [CATEGORY] });
    });
    renderPage();
    await screen.findByRole('cell', { name: 'Headphones' });

    await userEvent.click(screen.getByRole('button', { name: 'Deactivate' }));

    expect(await screen.findByText('Category deactivated')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('shows an error toast when delete is blocked by product references', async () => {
    vi.mocked(apiFetch).mockImplementation((path: string, options?: RequestInit) => {
      if (options?.method === 'DELETE') return Promise.reject(new Error('boom'));
      return Promise.resolve({ categories: [CATEGORY] });
    });
    renderPage();
    await screen.findByRole('cell', { name: 'Headphones' });

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Could not delete this category')).toBeInTheDocument();
  });
});
