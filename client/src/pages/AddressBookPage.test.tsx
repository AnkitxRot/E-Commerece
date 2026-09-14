import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../lib/apiClient.js';
import { ToastProvider } from '../context/ToastContext.js';
import { Toast } from '../components/Toast.js';
import AddressBookPage from './AddressBookPage.js';

vi.mock('../lib/apiClient.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/apiClient.js')>();
  return { ...actual, apiFetch: vi.fn() };
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/account/addresses']}>
      <ToastProvider>
        <Routes>
          <Route path="/account/addresses" element={<AddressBookPage />} />
        </Routes>
        <Toast />
      </ToastProvider>
    </MemoryRouter>,
  );
}

const ADDRESS = {
  id: '66666666-6666-4666-8666-666666666666',
  label: 'Home',
  line1: '221B Baker Street',
  line2: null,
  city: 'Mumbai',
  state: 'Maharashtra',
  postalCode: '400001',
  country: 'India',
  phone: '9876543210',
  isDefault: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

async function fillCreateForm() {
  await userEvent.type(screen.getByLabelText('Label (e.g. Home, Work)'), 'Home');
  await userEvent.type(screen.getByLabelText('Phone'), '9876543210');
  await userEvent.type(screen.getByLabelText('Address line 1'), '221B Baker Street');
  await userEvent.type(screen.getByLabelText('City'), 'Mumbai');
  await userEvent.type(screen.getByLabelText('State'), 'Maharashtra');
  await userEvent.type(screen.getByLabelText('Postal code'), '400001');
}

describe('AddressBookPage', () => {
  it('shows an empty state when there are no saved addresses', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ addresses: [] });
    renderPage();
    expect(await screen.findByText('No saved addresses yet')).toBeInTheDocument();
  });

  it('shows an error state with retry when the list fails to load', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error('network down'));
    renderPage();
    expect(await screen.findByText('Unable to load your addresses')).toBeInTheDocument();
  });

  it('lists saved addresses with their default status', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ addresses: [{ ...ADDRESS, isDefault: true }] });
    renderPage();
    expect(await screen.findByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Default')).toBeInTheDocument();
  });

  it('validates the create form before submitting', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ addresses: [] });
    renderPage();
    await screen.findByText('No saved addresses yet');
    await userEvent.click(screen.getByRole('button', { name: 'Add address' }));
    expect(await screen.findAllByText(/String must contain|Invalid|expected string/i)).not.toHaveLength(0);
  });

  it('creates an address and shows it in the list', async () => {
    const created = { ...ADDRESS, id: '77777777-7777-4777-8777-777777777777' };
    vi.mocked(apiFetch).mockImplementation((path: string, options?: RequestInit) => {
      if (options?.method === 'POST') return Promise.resolve({ address: created });
      return Promise.resolve({ addresses: [] });
    });
    renderPage();
    await screen.findByText('No saved addresses yet');

    await fillCreateForm();
    await userEvent.click(screen.getByRole('button', { name: 'Add address' }));

    expect(await screen.findByText('Address added')).toBeInTheDocument();
  });

  it('asks for confirmation before deleting, and does nothing if declined', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    vi.mocked(apiFetch).mockResolvedValue({ addresses: [ADDRESS] });
    renderPage();
    await screen.findByText('Home');

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(vi.mocked(apiFetch)).not.toHaveBeenCalledWith(expect.stringContaining(ADDRESS.id), expect.objectContaining({ method: 'DELETE' }));
    confirmSpy.mockRestore();
  });

  it('deletes an address once confirmed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(apiFetch).mockImplementation((path: string, options?: RequestInit) => {
      if (options?.method === 'DELETE') return Promise.resolve(undefined);
      return Promise.resolve({ addresses: [ADDRESS] });
    });
    renderPage();
    await screen.findByText('Home');

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Address deleted')).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it('sets an address as default', async () => {
    vi.mocked(apiFetch).mockImplementation((path: string, options?: RequestInit) => {
      if (options?.method === 'POST' && path.endsWith('/default')) {
        return Promise.resolve({ address: { ...ADDRESS, isDefault: true } });
      }
      return Promise.resolve({ addresses: [ADDRESS] });
    });
    renderPage();
    await screen.findByText('Home');

    await userEvent.click(screen.getByRole('button', { name: 'Set as default' }));

    expect(await screen.findByText('Default address updated')).toBeInTheDocument();
    expect(screen.getByText('Default')).toBeInTheDocument();
  });
});
