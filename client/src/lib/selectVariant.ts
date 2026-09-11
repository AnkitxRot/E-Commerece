import type { ProductDetailDto } from '@audio-commerce/shared';

export function selectVariantSku(product: ProductDetailDto, requested: string | null): string | null {
  const allowed = new Set(product.variants.map((v) => v.sku));
  if (requested && allowed.has(requested)) return requested;
  return product.variants.find((v) => v.inStock)?.sku ?? product.variants[0]?.sku ?? null;
}
