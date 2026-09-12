import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch } from '../lib/apiClient.js';
import * as AuthContext from '../context/AuthContext.js';
import { StorefrontLayout } from './StorefrontLayout.js';

vi.mock('../lib/apiClient.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/apiClient.js')>();
  return { ...actual, apiFetch: vi.fn() };
});

function renderLayout() {
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
    user: null,
    status: 'unauthenticated',
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  } as unknown as ReturnType<typeof AuthContext.useAuth>);

  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<StorefrontLayout />}>
          <Route index element={<div>home-outlet</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('StorefrontLayout', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it('keeps Aurelia Audio and auth links when settings and categories fail', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new ApiError(500, 'INTERNAL', 'Request failed'));
    renderLayout();

    expect(await screen.findByText('home-outlet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Aurelia Audio' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Create account' })).toHaveAttribute('href', '/register');
    expect(screen.queryByRole('link', { name: /cart|wishlist/i })).not.toBeInTheDocument();
  });

  it('uses store name and top-level shop links on success', async () => {
    vi.mocked(apiFetch).mockImplementation(async (path: string) => {
      const url = String(path);
      if (url === '/api/catalog/settings') {
        return { storeName: 'Helix House', logoUrl: null, contactEmail: 'hello@example.com' };
      }
      if (url === '/api/catalog/categories') {
        return {
          categories: [
            {
              slug: 'over-ear',
              name: 'Over-ear',
              children: [{ slug: 'closed-back', name: 'Closed-back', children: [] }],
            },
          ],
        };
      }
      throw new Error(`unexpected ${url}`);
    });
    renderLayout();

    expect(await screen.findByRole('link', { name: 'Helix House' })).toHaveAttribute('href', '/');
    const shopLinks = screen.getAllByRole('link', { name: 'Shop' });
    expect(shopLinks.length).toBeGreaterThan(0);
    expect(shopLinks.every((link) => link.getAttribute('href') === '/products')).toBe(true);
    const categoryLinks = screen.getAllByRole('link', { name: 'Over-ear' });
    expect(categoryLinks.every((link) => link.getAttribute('href') === '/c/over-ear')).toBe(true);
    expect(screen.queryByRole('link', { name: 'Closed-back' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.queryAllByRole('link', { name: /cart|wishlist/i })).toHaveLength(0);
    expect(screen.getByText('home-outlet')).toBeInTheDocument();
  });
});
