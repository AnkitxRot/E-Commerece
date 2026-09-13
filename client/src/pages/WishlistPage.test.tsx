import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { WishlistDto } from '@audio-commerce/shared';
import * as AuthContext from '../context/AuthContext.js';
import * as WishlistContext from '../context/WishlistContext.js';
import { ToastProvider } from '../context/ToastContext.js';
import WishlistPage from './WishlistPage.js';

vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
  user: { id: 'u1' },
  status: 'authenticated',
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
} as unknown as ReturnType<typeof AuthContext.useAuth>);

const nova: WishlistDto['items'][number] = {
  addedAt: '2026-01-01T00:00:00.000Z',
  product: {
    slug: 'aurelia-nova',
    name: 'Aurelia Nova',
    brand: { slug: 'aurelia', name: 'Aurelia' },
    category: { slug: 'over-ear', name: 'Over-ear' },
    priceFrom: '19999.00',
    priceTo: '24999.00',
    compareAtPrice: null,
    rating: 4.6,
    reviewCount: 128,
    thumbnail: null,
    inStock: true,
    featured: true,
  },
};

function mockWishlist(overrides: Partial<ReturnType<typeof WishlistContext.useWishlist>>) {
  vi.spyOn(WishlistContext, 'useWishlist').mockReturnValue({
    wishlist: null,
    loading: false,
    error: null,
    isWishlisted: () => false,
    addProduct: vi.fn(),
    removeProduct: vi.fn(),
    refresh: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof WishlistContext.useWishlist>);
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <WishlistPage />
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('WishlistPage', () => {
  it('shows a loading skeleton instead of the empty state', () => {
    mockWishlist({ wishlist: null, loading: true });
    const { container } = renderPage();
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(screen.queryByText('Your wishlist is empty')).not.toBeInTheDocument();
  });

  it('shows an empty state with a continue-shopping link', () => {
    mockWishlist({ wishlist: { items: [] }, loading: false });
    renderPage();
    expect(screen.getByText('Your wishlist is empty')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continue shopping' })).toHaveAttribute('href', '/products');
  });

  it('shows an error state with retry', () => {
    const refresh = vi.fn();
    mockWishlist({ wishlist: null, error: new Error('Request failed'), refresh });
    renderPage();
    expect(screen.getByText('Unable to load your wishlist')).toBeInTheDocument();
    screen.getByRole('button', { name: 'Try again' }).click();
    expect(refresh).toHaveBeenCalled();
  });

  it('lists wishlisted products linking to their PDP', () => {
    mockWishlist({ wishlist: { items: [nova] } });
    renderPage();
    expect(screen.getByRole('link', { name: /Aurelia Nova/ })).toHaveAttribute('href', '/p/aurelia-nova');
  });
});
