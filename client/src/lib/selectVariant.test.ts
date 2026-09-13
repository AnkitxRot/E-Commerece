import { describe, expect, it } from 'vitest';
import type { ProductDetailDto, VariantDto } from '@audio-commerce/shared';
import { selectVariantSku } from './selectVariant.js';

function variant(partial: Pick<VariantDto, 'sku' | 'inStock'> & Partial<VariantDto>): VariantDto {
  return {
    id: `id-${partial.sku}`,
    attributes: { color: 'Midnight' },
    price: '52990.00',
    compareAtPrice: null,
    availableQty: partial.inStock ? 5 : 0,
    ...partial,
  };
}

function product(variants: VariantDto[]): ProductDetailDto {
  return {
    slug: 'helix-lineage',
    name: 'Helix Lineage',
    description: 'A planar over-ear with interchangeable pads.',
    seoTitle: null,
    seoDescription: null,
    brand: { slug: 'helix', name: 'Helix', logoUrl: null },
    category: { slug: 'over-ear', name: 'Over-ear' },
    featured: false,
    inStock: variants.some((row) => row.inStock),
    images: [],
    variants,
    priceFrom: '52990.00',
    priceTo: '52990.00',
    compareAtPrice: null,
    rating: 4.5,
    reviewCount: 10,
    specs: {},
    reviews: [],
    relatedProducts: [],
  };
}

const helix = product([
  variant({ sku: 'HEL-BLK-01', inStock: true, attributes: { color: 'Midnight' } }),
  variant({ sku: 'HEL-SLV-01', inStock: true, attributes: { color: 'Silver' } }),
]);

describe('selectVariantSku', () => {
  it('keeps a SKU that belongs to the product', () => {
    expect(selectVariantSku(helix, 'HEL-SLV-01')).toBe('HEL-SLV-01');
  });

  it('ignores foreign SKU NOV-BLK-00 when the product only has Helix variants', () => {
    expect(selectVariantSku(helix, 'NOV-BLK-00')).toBe('HEL-BLK-01');
  });

  it('falls back to the first inStock variant then the first variant', () => {
    const mixed = product([
      variant({ sku: 'HEL-OOS-01', inStock: false, attributes: { color: 'Ivory' } }),
      variant({ sku: 'HEL-BLK-01', inStock: true, attributes: { color: 'Midnight' } }),
    ]);
    expect(selectVariantSku(mixed, null)).toBe('HEL-BLK-01');

    const allOut = product([
      variant({ sku: 'HEL-OOS-01', inStock: false, attributes: { color: 'Ivory' } }),
      variant({ sku: 'HEL-OOS-02', inStock: false, attributes: { color: 'Gold' } }),
    ]);
    expect(selectVariantSku(allOut, null)).toBe('HEL-OOS-01');

    expect(selectVariantSku(product([]), 'NOV-BLK-00')).toBeNull();
  });
});
