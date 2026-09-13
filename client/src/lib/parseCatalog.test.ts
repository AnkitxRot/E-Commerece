import { describe, expect, it } from 'vitest';
import { productListResponseSchema } from '@audio-commerce/shared';
import { ApiError } from './apiClient.js';
import { parseCatalog } from './parseCatalog.js';

const card = {
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

const envelope = {
  items: [card],
  meta: { page: 1, pageSize: 24, total: 1, totalPages: 1 },
};

describe('parseCatalog', () => {
  it('returns typed data for a valid list envelope', () => {
    const data = parseCatalog(productListResponseSchema, envelope);
    expect(data.items[0].slug).toBe('aurelia-nova');
    expect(data.meta.total).toBe(1);
  });

  it('throws ApiError with status 500 and INVALID_RESPONSE when a card has extra id', () => {
    expect(() =>
      parseCatalog(productListResponseSchema, {
        ...envelope,
        items: [{ ...card, id: 'not-allowed' }],
      }),
    ).toThrow(ApiError);

    try {
      parseCatalog(productListResponseSchema, {
        ...envelope,
        items: [{ ...card, id: 'not-allowed' }],
      });
    } catch (err) {
      expect(err).toMatchObject({ status: 500, code: 'INVALID_RESPONSE' });
    }
  });
});
