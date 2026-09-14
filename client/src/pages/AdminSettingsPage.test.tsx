import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../lib/apiClient.js';
import { ToastProvider } from '../context/ToastContext.js';
import { Toast } from '../components/Toast.js';
import AdminSettingsPage from './AdminSettingsPage.js';

vi.mock('../lib/apiClient.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/apiClient.js')>();
  return { ...actual, apiFetch: vi.fn() };
});

const SETTINGS = {
  settings: {
    storeName: 'Aurelia Audio',
    logoUrl: null,
    faviconUrl: null,
    contactEmail: 'hello@aureliaaudio.demo',
    contactPhone: null,
    socialLinks: {},
    heroContent: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
};

const BLOCK = {
  id: '99999999-9999-4999-8999-999999999999',
  type: 'ANNOUNCEMENT',
  payload: { message: 'Free shipping over ₹999' },
  position: 0,
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/settings']}>
      <ToastProvider>
        <Routes>
          <Route path="/admin/settings" element={<AdminSettingsPage />} />
        </Routes>
        <Toast />
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('AdminSettingsPage', () => {
  it('loads settings and blocks, and saves a settings change', async () => {
    vi.mocked(apiFetch).mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === '/api/admin/settings' && options?.method === 'PATCH') return SETTINGS;
      if (path === '/api/admin/settings') return SETTINGS;
      if (path === '/api/admin/content-blocks') return { blocks: [] };
      throw new Error(`Unexpected fetch: ${path}`);
    });

    renderPage();
    expect(await screen.findByDisplayValue('Aurelia Audio')).toBeInTheDocument();
    expect(await screen.findByText('No content blocks yet')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(await screen.findByText('Settings saved')).toBeInTheDocument();
  });

  it('shows an error state with retry when loading fails', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error('network down'));
    renderPage();
    expect(await screen.findByText('Unable to load settings')).toBeInTheDocument();
    expect(await screen.findByText('Unable to load content blocks')).toBeInTheDocument();
  });

  it('lists a content block and deletes it once confirmed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(apiFetch).mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === '/api/admin/settings') return SETTINGS;
      if (path === '/api/admin/content-blocks' && options?.method === undefined) return { blocks: [BLOCK] };
      if (path === `/api/admin/content-blocks/${BLOCK.id}` && options?.method === 'DELETE') return undefined;
      throw new Error(`Unexpected fetch: ${path} ${options?.method}`);
    });

    renderPage();
    expect(await screen.findByText('Free shipping over ₹999')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Content block deleted')).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it('creates a new announcement block', async () => {
    const created = { ...BLOCK, id: '88888888-8888-4888-8888-888888888888', payload: { message: 'New message' } };
    vi.mocked(apiFetch).mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === '/api/admin/settings') return SETTINGS;
      if (path === '/api/admin/content-blocks' && options?.method === 'POST') return { block: created };
      if (path === '/api/admin/content-blocks') return { blocks: [] };
      throw new Error(`Unexpected fetch: ${path} ${options?.method}`);
    });

    renderPage();
    await screen.findByText('No content blocks yet');

    await userEvent.type(screen.getByLabelText('Message'), 'New message');
    await userEvent.click(screen.getByRole('button', { name: 'Add block' }));

    expect(await screen.findByText('Content block created')).toBeInTheDocument();
    expect(await screen.findByText('New message')).toBeInTheDocument();
  });
});
