import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../lib/apiClient.js';
import { ToastProvider } from '../context/ToastContext.js';
import { Toast } from '../components/Toast.js';
import AdminCouponsPage from './AdminCouponsPage.js';

vi.mock('../lib/apiClient.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/apiClient.js')>();
  return { ...actual, apiFetch: vi.fn() };
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/coupons']}>
      <ToastProvider>
        <Routes>
          <Route path="/admin/coupons" element={<AdminCouponsPage />} />
        </Routes>
        <Toast />
      </ToastProvider>
    </MemoryRouter>,
  );
}

const COUPON = {
  id: '33333333-3333-4333-8333-333333333333',
  code: 'SAVE10',
  type: 'PERCENT',
  value: '10.00',
  expiresAt: '2030-01-01T00:00:00.000Z',
  usageLimit: null,
  timesUsed: 0,
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('AdminCouponsPage', () => {
  it('shows an empty state when there are no coupons', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ coupons: [] });
    renderPage();
    expect(await screen.findByText('No coupons yet')).toBeInTheDocument();
  });

  it('shows an error state with retry when the list fails to load', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error('network down'));
    renderPage();
    expect(await screen.findByText('Unable to load coupons')).toBeInTheDocument();
  });

  it('lists coupons with their type, value, usage, and status', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ coupons: [COUPON] });
    renderPage();
    expect(await screen.findByText('SAVE10')).toBeInTheDocument();
    expect(screen.getByText('10%')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('validates the create form before submitting', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ coupons: [] });
    renderPage();
    await screen.findByText('No coupons yet');
    await userEvent.click(screen.getByRole('button', { name: 'Create coupon' }));
    expect(await screen.findAllByText(/String must contain|Invalid|expected string/i)).not.toHaveLength(0);
  });

  it('creates a coupon and shows it in the list', async () => {
    const created = { ...COUPON, id: '55555555-5555-4555-8555-555555555555', code: 'WELCOME20' };
    vi.mocked(apiFetch).mockImplementation((path: string, options?: RequestInit) => {
      if (options?.method === 'POST') return Promise.resolve({ coupon: created });
      return Promise.resolve({ coupons: [] });
    });
    renderPage();
    await screen.findByText('No coupons yet');

    await userEvent.type(screen.getByLabelText('Code'), 'WELCOME20');
    await userEvent.type(screen.getByLabelText(/Percent/), '20.00');
    await userEvent.type(screen.getByLabelText('Expires on'), '2030-01-01');
    await userEvent.click(screen.getByRole('button', { name: 'Create coupon' }));

    expect(await screen.findByText('Coupon created')).toBeInTheDocument();
    expect(await screen.findByText('WELCOME20')).toBeInTheDocument();
  });

  it('deactivates an active coupon', async () => {
    vi.mocked(apiFetch).mockImplementation((path: string, options?: RequestInit) => {
      if (options?.method === 'PATCH') return Promise.resolve({ coupon: { ...COUPON, active: false } });
      return Promise.resolve({ coupons: [COUPON] });
    });
    renderPage();
    await screen.findByText('SAVE10');

    await userEvent.click(screen.getByRole('button', { name: 'Deactivate' }));

    expect(await screen.findByText('Coupon deactivated')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('offers no delete button once a coupon has been used', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ coupons: [{ ...COUPON, timesUsed: 3 }] });
    renderPage();
    await screen.findByText('SAVE10');
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('shows an error toast when delete fails', async () => {
    vi.mocked(apiFetch).mockImplementation((path: string, options?: RequestInit) => {
      if (options?.method === 'DELETE') return Promise.reject(new Error('boom'));
      return Promise.resolve({ coupons: [COUPON] });
    });
    renderPage();
    await screen.findByText('SAVE10');

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Could not delete this coupon')).toBeInTheDocument();
  });
});
