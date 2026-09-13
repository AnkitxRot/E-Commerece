import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../lib/apiClient.js';
import AdminProductFormPage from './AdminProductFormPage.js';

vi.mock('../lib/apiClient.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/apiClient.js')>();
  return { ...actual, apiFetch: vi.fn() };
});

const CATEGORY_ID = '11111111-1111-4111-8111-111111111111';
const BRAND_ID = '22222222-2222-4222-8222-222222222222';
const CATEGORIES = { categories: [{ id: CATEGORY_ID, name: 'Headphones' }] };
const BRANDS = { brands: [{ id: BRAND_ID, name: 'Aurelia' }] };

function renderNew() {
  return render(
    <MemoryRouter initialEntries={['/admin/products/new']}>
      <Routes>
        <Route path="/admin/products/new" element={<AdminProductFormPage />} />
        <Route path="/admin/products" element={<div>products-list-page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminProductFormPage (create)', () => {
  it('creates a product and navigates back to the list', async () => {
    const postSpy = vi.fn().mockResolvedValue({ product: { id: '77777777-7777-4777-8777-777777777777' } });
    vi.mocked(apiFetch).mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === '/api/admin/categories') return CATEGORIES;
      if (path === '/api/admin/brands') return BRANDS;
      if (path === '/api/admin/products' && options?.method === 'POST') return postSpy(path, options);
      throw new Error(`Unexpected fetch: ${path}`);
    });

    renderNew();
    await screen.findByLabelText('Category');

    await userEvent.type(screen.getByLabelText('Name', { exact: true }), 'Test Speaker');
    await userEvent.type(screen.getByLabelText('Description'), 'A speaker for testing.');
    await userEvent.selectOptions(screen.getByLabelText('Category'), CATEGORY_ID);
    await userEvent.type(screen.getByLabelText('Base price (₹)'), '1999.00');
    await userEvent.type(screen.getByLabelText('SKU'), 'TEST-SKU-1');
    await userEvent.type(screen.getByLabelText('Attribute value'), 'Black');
    await userEvent.click(screen.getByRole('button', { name: 'Create product' }));

    await waitFor(() => expect(postSpy).toHaveBeenCalled());
    const [, options] = postSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body).toMatchObject({
      slug: 'test-speaker',
      name: 'Test Speaker',
      categoryId: CATEGORY_ID,
      basePrice: '1999.00',
      variants: [{ sku: 'TEST-SKU-1', attributes: { Color: 'Black' }, stockQty: 0, lowStockThreshold: 5 }],
    });
    expect(await screen.findByText('products-list-page')).toBeInTheDocument();
  });

  it('shows a validation error when required fields are missing', async () => {
    vi.mocked(apiFetch).mockImplementation(async (path: string) => {
      if (path === '/api/admin/categories') return CATEGORIES;
      if (path === '/api/admin/brands') return BRANDS;
      throw new Error(`Unexpected fetch: ${path}`);
    });

    renderNew();
    await screen.findByLabelText('Category');
    await userEvent.click(screen.getByRole('button', { name: 'Create product' }));
    expect((await screen.findAllByText(/must/i)).length).toBeGreaterThan(0);
  });
});

describe('AdminProductFormPage (edit)', () => {
  it('loads an existing product and updates a variant\'s stock', async () => {
    const productId = '88888888-8888-4888-8888-888888888888';
    const variantId = '99999999-9999-4999-8999-999999999999';
    const productDetail = {
      product: {
        id: productId,
        slug: 'test-speaker',
        name: 'Test Speaker',
        description: 'desc',
        status: 'ACTIVE',
        basePrice: '1999.00',
        categoryId: CATEGORY_ID,
        brandId: null,
        featured: false,
        seoTitle: null,
        seoDescription: null,
        specs: {},
        createdAt: '2026-01-01T00:00:00.000Z',
        variants: [
          {
            id: variantId,
            sku: 'TEST-SKU-1',
            attributes: { Color: 'Black' },
            stockQty: 10,
            reservedQty: 0,
            lowStockThreshold: 5,
            priceOverride: null,
            compareAtPrice: null,
          },
        ],
      },
    };
    const updatedDetail = {
      product: { ...productDetail.product, variants: [{ ...productDetail.product.variants[0], stockQty: 3 }] },
    };

    vi.mocked(apiFetch).mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === '/api/admin/categories') return CATEGORIES;
      if (path === '/api/admin/brands') return BRANDS;
      if (path === `/api/admin/products/${productId}`) return productDetail;
      if (path === `/api/admin/products/${productId}/variants/${variantId}` && options?.method === 'PATCH')
        return updatedDetail;
      throw new Error(`Unexpected fetch: ${path} ${options?.method}`);
    });

    render(
      <MemoryRouter initialEntries={[`/admin/products/${productId}`]}>
        <Routes>
          <Route path="/admin/products/:id" element={<AdminProductFormPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Edit Test Speaker')).toBeInTheDocument();
    const stockInput = screen.getByLabelText('Stock for TEST-SKU-1');
    await userEvent.clear(stockInput);
    await userEvent.type(stockInput, '3');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getByLabelText('Stock for TEST-SKU-1')).toHaveValue(3));
  });
});
