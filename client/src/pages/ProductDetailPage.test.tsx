import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useSearchParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProductDetailDto } from '@audio-commerce/shared';
import { ApiError, apiFetch } from '../lib/apiClient.js';
import * as AuthContext from '../context/AuthContext.js';
import * as CartContext from '../context/CartContext.js';
import * as WishlistContext from '../context/WishlistContext.js';
import { ToastProvider } from '../context/ToastContext.js';
import { Toast } from '../components/Toast.js';
import ProductDetailPage from './ProductDetailPage.js';

vi.mock('../lib/apiClient.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/apiClient.js')>();
  return { ...actual, apiFetch: vi.fn() };
});

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

const helix: ProductDetailDto = {
  slug: 'helix-lineage',
  name: 'Helix Lineage',
  description: 'A planar over-ear with interchangeable pads.',
  seoTitle: 'Helix Lineage planar headphones',
  seoDescription: 'A planar over-ear with interchangeable pads.',
  brand: { slug: 'helix', name: 'Helix', logoUrl: null },
  category: { slug: 'over-ear', name: 'Over-ear' },
  featured: false,
  inStock: true,
  images: [
    {
      url: 'https://picsum.photos/seed/helix-lineage-0/800/800',
      altText: 'Helix Lineage planar headphones in midnight',
      position: 0,
    },
  ],
  variants: [
    {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      sku: 'HEL-BLK-01',
      attributes: { color: 'Midnight' },
      price: '52990.00',
      compareAtPrice: null,
      inStock: true,
      availableQty: 5,
    },
    {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      sku: 'HEL-OOS-01',
      attributes: { color: 'Ivory' },
      price: '54990.00',
      compareAtPrice: null,
      inStock: false,
      availableQty: 0,
    },
  ],
  priceFrom: '52990.00',
  priceTo: '54990.00',
  compareAtPrice: null,
  rating: 4.4,
  reviewCount: 21,
  specs: { Driver: 'Planar magnetic', Weight: '380g' },
  reviews: [
    {
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      rating: 5,
      body: 'Fantastic clarity.',
      authorName: 'Priya Sharma',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  relatedProducts: [],
};

function SearchParamsProbe() {
  const [params] = useSearchParams();
  return <pre data-testid="search-params">{params.toString()}</pre>;
}

const mockAddItem = vi.fn().mockResolvedValue(undefined);

function mockAuth(user: { id: string; email: string; name: string; role: 'CUSTOMER' | 'ADMIN' } | null) {
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
    user,
    status: user ? 'authenticated' : 'unauthenticated',
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  } as unknown as ReturnType<typeof AuthContext.useAuth>);
}

function mockCart() {
  vi.spyOn(CartContext, 'useCart').mockReturnValue({
    cart: { items: [], itemCount: 0, subtotal: '0.00' },
    loading: false,
    addItem: mockAddItem,
    updateItemQty: vi.fn(),
    removeItem: vi.fn(),
    clearCart: vi.fn(),
    refresh: vi.fn(),
  } as unknown as ReturnType<typeof CartContext.useCart>);
}

function mockWishlist() {
  vi.spyOn(WishlistContext, 'useWishlist').mockReturnValue({
    wishlist: { items: [] },
    loading: false,
    error: null,
    isWishlisted: () => false,
    addProduct: vi.fn(),
    removeProduct: vi.fn(),
    refresh: vi.fn(),
  } as unknown as ReturnType<typeof WishlistContext.useWishlist>);
}

function renderPdp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <Routes>
          <Route
            path="/p/:productSlug"
            element={
              <>
                <SearchParamsProbe />
                <ProductDetailPage />
              </>
            }
          />
          <Route path="/login" element={<div>login-page</div>} />
          <Route path="/checkout" element={<div>checkout-page</div>} />
        </Routes>
        <Toast />
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('ProductDetailPage', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    mockAddItem.mockClear().mockResolvedValue(undefined);
    document.title = '';
    document.querySelector('meta[name="description"]')?.remove();
    vi.mocked(apiFetch).mockResolvedValue({ product: helix });
    mockAuth({ id: 'u1', email: 'a@b.com', name: 'A', role: 'CUSTOMER' });
    mockCart();
    mockWishlist();
  });

  it('ignores foreign SKU NOV-BLK-00 and selects HEL-BLK-01 with that variant price', async () => {
    renderPdp('/p/helix-lineage?variant=NOV-BLK-00');

    expect(await screen.findByText('HEL-BLK-01')).toBeInTheDocument();
    expect(screen.queryByText('NOV-BLK-00')).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Midnight' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText(inr.format(52990))).toBeInTheDocument();
    expect(screen.queryByText(`${inr.format(52990)} – ${inr.format(54990)}`)).not.toBeInTheDocument();

    await waitFor(() => {
      const qs = new URLSearchParams(screen.getByTestId('search-params').textContent ?? '');
      expect(qs.get('variant')).toBe('HEL-BLK-01');
    });
  });

  it('clicking the OOS variant updates the URL to variant=HEL-OOS-01 and shows Out of stock', async () => {
    renderPdp('/p/helix-lineage?variant=HEL-BLK-01');

    await screen.findByText('HEL-BLK-01');
    await userEvent.click(screen.getByRole('radio', { name: 'Ivory' }));

    await waitFor(() => {
      const qs = new URLSearchParams(screen.getByTestId('search-params').textContent ?? '');
      expect(qs.get('variant')).toBe('HEL-OOS-01');
    });
    expect(screen.getByText('HEL-OOS-01')).toBeInTheDocument();
    expect(screen.getByText('Out of stock')).toBeInTheDocument();
    expect(screen.getByText('0 available')).toBeInTheDocument();
  });

  it('adds the selected variant and quantity to the cart', async () => {
    renderPdp('/p/helix-lineage?variant=HEL-BLK-01');
    await screen.findByText('HEL-BLK-01');

    await userEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add to cart' }));

    await waitFor(() => {
      expect(mockAddItem).toHaveBeenCalledWith('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 2);
    });
    expect(await screen.findByText('Added 2 to your cart')).toBeInTheDocument();
  });

  it('buy now adds to cart and navigates to checkout', async () => {
    renderPdp('/p/helix-lineage?variant=HEL-BLK-01');
    await screen.findByText('HEL-BLK-01');

    await userEvent.click(screen.getByRole('button', { name: 'Buy now' }));

    expect(await screen.findByText('checkout-page')).toBeInTheDocument();
    expect(mockAddItem).toHaveBeenCalledWith('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1);
  });

  it('sends a signed-out shopper to login instead of adding to cart', async () => {
    mockAuth(null);
    renderPdp('/p/helix-lineage?variant=HEL-BLK-01');
    await screen.findByText('HEL-BLK-01');

    await userEvent.click(screen.getByRole('button', { name: 'Add to cart' }));

    expect(await screen.findByText('login-page')).toBeInTheDocument();
    expect(mockAddItem).not.toHaveBeenCalled();
  });

  it('does not render cart actions for the out-of-stock variant', async () => {
    renderPdp('/p/helix-lineage?variant=HEL-OOS-01');
    await screen.findByText('HEL-OOS-01');
    expect(screen.queryByRole('button', { name: 'Add to cart' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Buy now' })).not.toBeInTheDocument();
  });

  it('shows Product not found without retry', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'Product not found'));
    renderPdp('/p/missing-product');

    expect(await screen.findByRole('heading', { name: 'Product not found' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /continue browsing/i })).toHaveAttribute('href', '/products');
  });

  it('sets document.title from seoTitle and meta description from seoDescription', async () => {
    renderPdp('/p/helix-lineage');

    await screen.findByRole('heading', { level: 1, name: 'Helix Lineage' });
    expect(document.title).toBe('Helix Lineage planar headphones');
    expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
      'content',
      'A planar over-ear with interchangeable pads.',
    );
    expect(screen.getByRole('link', { name: /continue browsing/i })).toHaveAttribute('href', '/products');
    expect(screen.getByText('5 available')).toBeInTheDocument();
  });

  it('renders specifications and customer reviews', async () => {
    renderPdp('/p/helix-lineage');
    await screen.findByText('HEL-BLK-01');
    expect(screen.getByText('Planar magnetic')).toBeInTheDocument();
    expect(screen.getByText('Fantastic clarity.')).toBeInTheDocument();
  });
});
