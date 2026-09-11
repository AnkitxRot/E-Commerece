import { describe, expect, it } from 'vitest';
import {
  catalogSlugParamSchema,
  homeResponseSchema,
  internalPathSchema,
  moneySchema,
  normalizeSearchQuery,
  productCardDtoSchema,
  productDetailDtoSchema,
  productListQuerySchema,
  productListResponseSchema,
} from './catalog.js';

describe('normalizeSearchQuery', () => {
  it('trims and collapses internal whitespace', () => {
    expect(normalizeSearchQuery('  nova   black  ')).toBe('nova black');
  });
});

describe('productListQuerySchema', () => {
  it('applies defaults', () => {
    const q = productListQuerySchema.parse({});
    expect(q.sort).toBe('newest');
    expect(q.page).toBe(1);
    expect(q.pageSize).toBe(24);
    expect(q.q).toBeUndefined();
  });

  it('normalizes q and rejects length 1', () => {
    expect(productListQuerySchema.parse({ q: '  nova  ' }).q).toBe('nova');
    expect(productListQuerySchema.safeParse({ q: 'a' }).success).toBe(false);
    expect(productListQuerySchema.safeParse({ q: 'x'.repeat(81) }).success).toBe(false);
  });

  it('rejects repeated query keys represented as arrays', () => {
    expect(productListQuerySchema.safeParse({ sort: ['newest', 'name_asc'] }).success).toBe(false);
  });

  it('accepts only exact true/false for inStock', () => {
    expect(productListQuerySchema.parse({ inStock: 'true' }).inStock).toBe(true);
    expect(productListQuerySchema.parse({ inStock: 'false' }).inStock).toBe(false);
    expect(productListQuerySchema.safeParse({ inStock: 'TRUE' }).success).toBe(false);
    expect(productListQuerySchema.safeParse({ inStock: '1' }).success).toBe(false);
    expect(productListQuerySchema.safeParse({ inStock: 'yes' }).success).toBe(false);
  });

  it('bounds prices and requires min <= max', () => {
    expect(productListQuerySchema.parse({ minPrice: '10.5' }).minPrice).toBe(10.5);
    expect(productListQuerySchema.safeParse({ minPrice: 'abc' }).success).toBe(false);
    expect(productListQuerySchema.safeParse({ minPrice: '-1' }).success).toBe(false);
    expect(productListQuerySchema.safeParse({ minPrice: '20', maxPrice: '10' }).success).toBe(false);
    expect(productListQuerySchema.parse({ minPrice: '10', maxPrice: '20' }).maxPrice).toBe(20);
  });

  it('bounds page and pageSize and rejects unknown sort', () => {
    expect(productListQuerySchema.safeParse({ page: '1.5' }).success).toBe(false);
    expect(productListQuerySchema.safeParse({ page: '-1' }).success).toBe(false);
    expect(productListQuerySchema.safeParse({ pageSize: '49' }).success).toBe(false);
    expect(productListQuerySchema.safeParse({ sort: 'popular' }).success).toBe(false);
    expect(productListQuerySchema.parse({ sort: 'price_asc' }).sort).toBe('price_asc');
  });

  it('rejects unknown query keys', () => {
    expect(productListQuerySchema.safeParse({ foo: '1' }).success).toBe(false);
  });
});

describe('internalPathSchema', () => {
  it('allows root-relative paths and rejects open redirects', () => {
    expect(internalPathSchema.parse('/products')).toBe('/products');
    expect(internalPathSchema.safeParse('https://evil.example').success).toBe(false);
    expect(internalPathSchema.safeParse('//evil.example').success).toBe(false);
  });
});

describe('money and list response', () => {
  it('rejects non two-decimal money', () => {
    expect(moneySchema.safeParse('10').success).toBe(false);
    expect(moneySchema.parse('10.50')).toBe('10.50');
  });

  it('parses a list envelope and rejects product UUIDs', () => {
    const card = {
      slug: 'aurelia-nova',
      name: 'Nova',
      brand: { slug: 'aurelia', name: 'Aurelia' },
      category: { slug: 'over-ear', name: 'Over-ear' },
      priceFrom: '19999.00',
      priceTo: '24999.00',
      thumbnail: null,
      inStock: true,
      featured: true,
    };
    expect(productCardDtoSchema.parse(card).slug).toBe('aurelia-nova');
    expect(productCardDtoSchema.safeParse({ ...card, id: 'not-allowed' }).success).toBe(false);
    const list = productListResponseSchema.parse({
      items: [card],
      meta: { page: 1, pageSize: 24, total: 1, totalPages: 1 },
    });
    expect(list.meta.total).toBe(1);
  });
});

describe('params and home envelope exist', () => {
  it('parses slug params', () => {
    expect(catalogSlugParamSchema.parse({ slug: 'over-ear' }).slug).toBe('over-ear');
    expect(catalogSlugParamSchema.safeParse({ slug: 'Over Ear' }).success).toBe(false);
  });

  it('exports home and detail envelopes', () => {
    expect(homeResponseSchema).toBeDefined();
    expect(productDetailDtoSchema).toBeDefined();
  });
});
