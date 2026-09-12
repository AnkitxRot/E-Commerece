import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useSearchParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProductDetailDto } from '@audio-commerce/shared';
import { ApiError, apiFetch } from '../lib/apiClient.js';
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
      sku: 'HEL-BLK-01',
      attributes: { color: 'Midnight' },
      price: '52990.00',
      inStock: true,
      availableQty: 5,
    },
    {
      sku: 'HEL-OOS-01',
      attributes: { color: 'Ivory' },
      price: '54990.00',
      inStock: false,
      availableQty: 0,
    },
  ],
  priceFrom: '52990.00',
  priceTo: '54990.00',
};

function SearchParamsProbe() {
  const [params] = useSearchParams();
  return <pre data-testid="search-params">{params.toString()}</pre>;
}

function renderPdp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
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
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProductDetailPage', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    document.title = '';
    document.querySelector('meta[name="description"]')?.remove();
    vi.mocked(apiFetch).mockResolvedValue({ product: helix });
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

  it('does not render a button matching cart, buy, or checkout', async () => {
    renderPdp('/p/helix-lineage');

    await screen.findByText('HEL-BLK-01');
    expect(screen.queryAllByRole('button', { name: /cart|buy|checkout/i })).toHaveLength(0);
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
});
