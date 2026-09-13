import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useSearchParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CategoryDetailDto, ProductListResponse } from '@audio-commerce/shared';
import { ApiError, apiFetch } from '../lib/apiClient.js';
import ProductListPage from './ProductListPage.js';

vi.mock('../lib/apiClient.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/apiClient.js')>();
  return { ...actual, apiFetch: vi.fn() };
});

const novaCard = {
  slug: 'aurelia-nova',
  name: 'Nova',
  brand: { slug: 'aurelia', name: 'Aurelia' },
  category: { slug: 'over-ear', name: 'Over-ear' },
  priceFrom: '19999.00',
  priceTo: '24999.00',
  compareAtPrice: null,
  rating: 4.6,
  reviewCount: 42,
  thumbnail: null,
  inStock: true,
  featured: true,
};

const brandsPayload = {
  brands: [{ slug: 'aurelia', name: 'Aurelia', logoUrl: null }],
};

function listPayload(overrides: Partial<ProductListResponse> = {}): ProductListResponse {
  return {
    items: [novaCard],
    meta: { page: 1, pageSize: 24, total: 1, totalPages: 1 },
    ...overrides,
  };
}

function SearchParamsProbe() {
  const [params] = useSearchParams();
  return <pre data-testid="search-params">{params.toString()}</pre>;
}

function renderList(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/products"
          element={
            <>
              <SearchParamsProbe />
              <ProductListPage />
            </>
          }
        />
        <Route
          path="/c/:categorySlug"
          element={
            <>
              <SearchParamsProbe />
              <ProductListPage />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

function desktopSort(): HTMLElement {
  const sort = document.getElementById('filter-desktop-sort');
  expect(sort).not.toBeNull();
  return sort!;
}

function desktopSearch(): HTMLElement {
  const input = document.getElementById('filter-desktop-q');
  expect(input).not.toBeNull();
  return input!;
}

function desktopMinPrice(): HTMLElement {
  const input = document.getElementById('filter-desktop-min-price');
  expect(input).not.toBeNull();
  return input!;
}

const LIST_QUERY_KEYS = new Set([
  'q',
  'brand',
  'minPrice',
  'maxPrice',
  'inStock',
  'sort',
  'page',
  'pageSize',
  'category',
]);

function rejectInvalidListQuery(url: string) {
  const qs = new URLSearchParams(url.split('?')[1] ?? '');
  for (const key of qs.keys()) {
    if (!LIST_QUERY_KEYS.has(key)) {
      throw new ApiError(400, 'VALIDATION', `unknown query key ${key}`);
    }
  }
  const q = qs.get('q');
  if (q !== null && q.trim().replace(/\s+/g, ' ').length === 1) {
    throw new ApiError(400, 'VALIDATION', 'q must be at least 2 characters');
  }
  for (const key of ['minPrice', 'maxPrice']) {
    const value = qs.get(key);
    if (value !== null && value !== '' && !/^\d+(?:\.\d{1,2})?$/.test(value)) {
      throw new ApiError(400, 'VALIDATION', `invalid ${key}`);
    }
  }
}

function mockCatalog({
  list = listPayload(),
  category,
  categoryError,
}: {
  list?: ProductListResponse;
  category?: CategoryDetailDto;
  categoryError?: ApiError;
} = {}) {
  vi.mocked(apiFetch).mockImplementation(async (path: string) => {
    const url = String(path);
    if (url.startsWith('/api/catalog/brands')) return brandsPayload;
    if (url.startsWith('/api/catalog/categories/')) {
      if (categoryError) throw categoryError;
      if (!category) throw new Error(`unexpected category fetch: ${url}`);
      return category;
    }
    if (url === '/api/catalog/products' || url.startsWith('/api/catalog/products?')) {
      rejectInvalidListQuery(url);
      return list;
    }
    throw new Error(`unexpected ${url}`);
  });
}

describe('ProductListPage', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    document.title = '';
  });

  it('changing sort to newest results in search params without page and without sort', async () => {
    mockCatalog({
      list: listPayload({ meta: { page: 3, pageSize: 24, total: 50, totalPages: 3 } }),
    });
    renderList('/products?q=nova&page=3');

    await screen.findByRole('link', { name: /Nova/ });
    await userEvent.selectOptions(desktopSort(), 'newest');

    await waitFor(() => {
      const qs = new URLSearchParams(screen.getByTestId('search-params').textContent ?? '');
      expect(qs.get('page')).toBeNull();
      expect(qs.get('sort')).toBeNull();
    });
  });

  it('clicking pagination page 2 results in page=2 present', async () => {
    mockCatalog({
      list: listPayload({ meta: { page: 1, pageSize: 24, total: 50, totalPages: 3 } }),
    });
    renderList('/products');

    await screen.findByRole('link', { name: /Nova/ });
    await userEvent.click(screen.getByRole('button', { name: '2' }));

    await waitFor(() => {
      const qs = new URLSearchParams(screen.getByTestId('search-params').textContent ?? '');
      expect(qs.get('page')).toBe('2');
    });
  });

  it('shows No matching products and a clear-filters button when the list is empty and q=zzz', async () => {
    mockCatalog({
      list: { items: [], meta: { page: 1, pageSize: 24, total: 0, totalPages: 0 } },
    });
    renderList('/products?q=zzz');

    expect(await screen.findByText('No matching products')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument();
  });

  it('shows Category not found without retry and links to /products', async () => {
    mockCatalog({
      categoryError: new ApiError(404, 'NOT_FOUND', 'Category not found'),
    });
    renderList('/c/missing-category');

    expect(await screen.findByRole('heading', { name: 'Category not found' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /products/i })).toHaveAttribute('href', '/products');
  });

  it('sets document.title, focuses h1, and exposes a skip link to the product grid', async () => {
    mockCatalog();
    renderList('/products');

    await screen.findByRole('link', { name: /Nova/ });
    expect(document.title).toBe('Shop');
    expect(screen.getByRole('heading', { level: 1, name: 'Shop' })).toHaveFocus();
    expect(screen.getByRole('link', { name: 'Skip to products' })).toHaveAttribute('href', '#product-grid');
    expect(screen.getByText('1 products')).toHaveAttribute('aria-live', 'polite');
  });

  it('replaces an out-of-range page with the last page', async () => {
    vi.mocked(apiFetch).mockImplementation(async (path: string) => {
      const url = String(path);
      if (url.startsWith('/api/catalog/brands')) return brandsPayload;
      if (url === '/api/catalog/products' || url.startsWith('/api/catalog/products?')) {
        const page = new URLSearchParams(url.split('?')[1] ?? '').get('page');
        if (page === '9') {
          return { items: [], meta: { page: 9, pageSize: 24, total: 50, totalPages: 3 } };
        }
        return listPayload({ meta: { page: 3, pageSize: 24, total: 50, totalPages: 3 } });
      }
      throw new Error(`unexpected ${url}`);
    });
    renderList('/products?page=9');

    await waitFor(() => {
      const qs = new URLSearchParams(screen.getByTestId('search-params').textContent ?? '');
      expect(qs.get('page')).toBe('3');
    });
  });

  it('does not write a 1-character search to the URL or replace the page with ErrorState', async () => {
    mockCatalog();
    renderList('/products');
    await screen.findByRole('link', { name: /Nova/ });

    await userEvent.type(desktopSearch(), 'z');
    await new Promise((resolve) => setTimeout(resolve, 400));

    const qs = new URLSearchParams(screen.getByTestId('search-params').textContent ?? '');
    expect(qs.get('q')).toBeNull();
    expect(screen.getByRole('form', { name: 'Filter products' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Unable to load products' })).not.toBeInTheDocument();
  });

  it('does not write an incomplete price to the URL or replace the page with ErrorState', async () => {
    mockCatalog();
    renderList('/products');
    await screen.findByRole('link', { name: /Nova/ });

    await userEvent.type(desktopMinPrice(), '12.');

    const qs = new URLSearchParams(screen.getByTestId('search-params').textContent ?? '');
    expect(qs.get('minPrice')).not.toBe('12.');
    expect(screen.getByRole('form', { name: 'Filter products' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Unable to load products' })).not.toBeInTheDocument();
  });

  it('keeps FilterBar mounted when the product list request fails', async () => {
    vi.mocked(apiFetch).mockImplementation(async (path: string) => {
      const url = String(path);
      if (url.startsWith('/api/catalog/brands')) return brandsPayload;
      if (url === '/api/catalog/products' || url.startsWith('/api/catalog/products?')) {
        throw new ApiError(400, 'VALIDATION', 'Invalid query');
      }
      throw new Error(`unexpected ${url}`);
    });
    renderList('/products?q=ab');

    expect(await screen.findByRole('heading', { name: 'Unable to load products' })).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Filter products' })).toBeInTheDocument();
  });

  it('fetches category from the path without putting category in the URL', async () => {
    mockCatalog({
      category: { slug: 'over-ear', name: 'Over-ear', parent: null, children: [] },
    });
    renderList('/c/over-ear');

    await screen.findByRole('heading', { level: 1, name: 'Over-ear' });
    expect(document.title).toBe('Over-ear');
    expect(screen.getByTestId('search-params')).toHaveTextContent('');
    const productCall = vi.mocked(apiFetch).mock.calls.find(([path]) => String(path).startsWith('/api/catalog/products'));
    expect(productCall?.[0]).toContain('category=over-ear');
  });

  it('renders child category sub-nav links on a category page', async () => {
    mockCatalog({
      category: {
        slug: 'headphones',
        name: 'Headphones',
        parent: null,
        children: [
          { slug: 'over-ear', name: 'Over-ear' },
          { slug: 'in-ear', name: 'In-ear' },
        ],
      },
    });
    renderList('/c/headphones');

    await screen.findByRole('heading', { level: 1, name: 'Headphones' });
    expect(screen.getByRole('link', { name: 'Over-ear' })).toHaveAttribute('href', '/c/over-ear');
    expect(screen.getByRole('link', { name: 'In-ear' })).toHaveAttribute('href', '/c/in-ear');
  });

  it('ignores extra query keys like utm_source and variant and still loads products', async () => {
    mockCatalog();
    renderList('/products?q=nova&utm_source=newsletter&variant=A1');

    expect(await screen.findByRole('link', { name: /Nova/ })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Unable to load products' })).not.toBeInTheDocument();
    const productCall = vi.mocked(apiFetch).mock.calls.find(([path]) => String(path).startsWith('/api/catalog/products'));
    expect(String(productCall?.[0])).toContain('q=nova');
    expect(String(productCall?.[0])).not.toContain('utm_source');
    expect(String(productCall?.[0])).not.toMatch(/[?&]variant=/);
  });
});
