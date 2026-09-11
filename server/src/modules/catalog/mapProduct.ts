import type { ProductCardDto } from '@audio-commerce/shared';
import { Decimal } from '@prisma/client/runtime/library';
import { productInStock } from './availability.js';
import { toMoney } from './money.js';

type CardSource = {
  slug: string;
  name: string;
  featured: boolean;
  basePrice: Decimal;
  brand: { slug: string; name: string } | null;
  category: { slug: string; name: string };
  variants: { priceOverride: Decimal | null; stockQty: number; reservedQty: number }[];
  images: { url: string; altText: string; position: number }[];
};

export function toCard(product: CardSource): ProductCardDto {
  const prices =
    product.variants.length === 0
      ? [product.basePrice]
      : product.variants.map((v) => v.priceOverride ?? product.basePrice);
  let min = prices[0];
  let max = prices[0];
  for (const price of prices) {
    if (new Decimal(price).lt(min)) min = price;
    if (new Decimal(price).gt(max)) max = price;
  }
  const thumb = product.images[0];
  return {
    slug: product.slug,
    name: product.name,
    brand: product.brand ? { slug: product.brand.slug, name: product.brand.name } : null,
    category: { slug: product.category.slug, name: product.category.name },
    priceFrom: toMoney(min),
    priceTo: toMoney(max),
    thumbnail: thumb ? { url: thumb.url, altText: thumb.altText, position: thumb.position } : null,
    inStock: productInStock(product.variants),
    featured: product.featured,
  };
}
