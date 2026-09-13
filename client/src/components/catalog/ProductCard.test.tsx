import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { ProductCardDto } from '@audio-commerce/shared';
import * as AuthContext from '../../context/AuthContext.js';
import * as WishlistContext from '../../context/WishlistContext.js';
import { ToastProvider } from '../../context/ToastContext.js';
import { ProductCard } from './ProductCard.js';
import { ProductGrid } from './ProductGrid.js';

vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
  user: null,
  status: 'unauthenticated',
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
} as unknown as ReturnType<typeof AuthContext.useAuth>);

vi.spyOn(WishlistContext, 'useWishlist').mockReturnValue({
  wishlist: { items: [] },
  loading: false,
  error: null,
  isWishlisted: () => false,
  addProduct: vi.fn(),
  removeProduct: vi.fn(),
  refresh: vi.fn(),
} as unknown as ReturnType<typeof WishlistContext.useWishlist>);

const nova: ProductCardDto = {
  slug: 'aurelia-nova',
  name: 'Aurelia Nova',
  brand: { slug: 'aurelia', name: 'Aurelia' },
  category: { slug: 'over-ear', name: 'Over-ear' },
  priceFrom: '19999.00',
  priceTo: '24999.00',
  compareAtPrice: null,
  rating: 4.6,
  reviewCount: 128,
  thumbnail: {
    url: 'https://picsum.photos/seed/aurelia-nova-0/800/800',
    altText: 'Aurelia Nova over-ear headphones in midnight black',
    position: 0,
  },
  inStock: true,
  featured: true,
};

describe('ProductCard', () => {
  it('renders as a link to /p/aurelia-nova', () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <ProductCard product={nova} />
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link')).toHaveAttribute('href', '/p/aurelia-nova');
  });
});

describe('ProductGrid', () => {
  it('renders product cards in a listing region', () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <ProductGrid products={[nova]} />
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(document.getElementById('product-grid')).toBeTruthy();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/p/aurelia-nova');
  });
});
