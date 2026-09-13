import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../lib/apiClient.js';
import { ToastProvider } from '../context/ToastContext.js';
import { Toast } from '../components/Toast.js';
import AdminReviewsPage from './AdminReviewsPage.js';

vi.mock('../lib/apiClient.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/apiClient.js')>();
  return { ...actual, apiFetch: vi.fn() };
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/reviews']}>
      <ToastProvider>
        <Routes>
          <Route path="/admin/reviews" element={<AdminReviewsPage />} />
        </Routes>
        <Toast />
      </ToastProvider>
    </MemoryRouter>,
  );
}

const REVIEW = {
  id: '11111111-1111-4111-8111-111111111111',
  rating: 4,
  body: 'Sounds great.',
  status: 'PENDING',
  createdAt: '2026-01-01T00:00:00.000Z',
  product: { slug: 'aurelia-nova', name: 'Aurelia Nova' },
  reviewer: { name: 'Priya', email: 'priya@example.com' },
};

describe('AdminReviewsPage', () => {
  it('shows an empty state when there are no reviews', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ items: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } });
    renderPage();
    expect(await screen.findByText('No reviews found')).toBeInTheDocument();
  });

  it('lists pending reviews with approve/reject actions', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ items: [REVIEW], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });
    renderPage();
    expect(await screen.findByText('Aurelia Nova')).toBeInTheDocument();
    expect(screen.getByText('Priya (priya@example.com)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Approve review/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reject review/ })).toBeInTheDocument();
  });

  it('does not show moderation actions for an already-decided review', async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      items: [{ ...REVIEW, status: 'APPROVED' }],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
    renderPage();
    expect(await screen.findByText('Aurelia Nova')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Approve review/ })).not.toBeInTheDocument();
  });

  it('approves a review and removes it from the pending list', async () => {
    vi.mocked(apiFetch).mockImplementation((path) => {
      if (String(path).includes('/status')) {
        return Promise.resolve({ review: { ...REVIEW, status: 'APPROVED' } });
      }
      return Promise.resolve({ items: [REVIEW], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });
    });
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /Approve review/ }));

    expect(await screen.findByText('Review approved')).toBeInTheDocument();
    expect(screen.queryByText('Aurelia Nova')).not.toBeInTheDocument();
  });

  it('shows an error toast when moderation fails', async () => {
    vi.mocked(apiFetch).mockImplementation((path) => {
      if (String(path).includes('/status')) {
        return Promise.reject(new Error('boom'));
      }
      return Promise.resolve({ items: [REVIEW], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });
    });
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /Reject review/ }));

    expect(await screen.findByText('Could not update this review')).toBeInTheDocument();
  });
});
