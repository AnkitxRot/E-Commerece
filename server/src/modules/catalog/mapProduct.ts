import type { ProductCardDto, ProductDetailDto, VariantDto } from '@audio-commerce/shared';
import type { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { availableQty, productInStock, variantInStock } from './availability.js';
import { toMoney } from './money.js';

type PriceSource = {
  basePrice: Decimal;
  variants: { priceOverride: Decimal | null }[];
};

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

type DetailSource = {
  slug: string;
  name: string;
  description: string;
  seoTitle: string | null;
  seoDescription: string | null;
  featured: boolean;
  basePrice: Decimal;
  brand: { slug: string; name: string; logoUrl: string | null } | null;
  category: { slug: string; name: string };
  variants: {
    sku: string;
    attributes: Prisma.JsonValue;
    priceOverride: Decimal | null;
    stockQty: number;
    reservedQty: number;
  }[];
  images: { url: string; altText: string; position: number }[];
};

function priceRange(product: PriceSource): { min: Decimal; max: Decimal } {
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
  return { min, max };
}

export function toCard(product: CardSource): ProductCardDto {
  const { min, max } = priceRange(product);
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

export function toDetail(product: DetailSource): ProductDetailDto {
  const { min, max } = priceRange(product);
  return {
    slug: product.slug,
    name: product.name,
    description: product.description,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    brand: product.brand
      ? { slug: product.brand.slug, name: product.brand.name, logoUrl: product.brand.logoUrl }
      : null,
    category: { slug: product.category.slug, name: product.category.name },
    featured: product.featured,
    inStock: productInStock(product.variants),
    images: product.images.map((img) => ({ url: img.url, altText: img.altText, position: img.position })),
    variants: product.variants.map((variant) => {
      const qty = Math.max(0, availableQty(variant.stockQty, variant.reservedQty));
      return {
        sku: variant.sku,
        attributes: variant.attributes as VariantDto['attributes'],
        price: toMoney(variant.priceOverride ?? product.basePrice),
        inStock: variantInStock(variant.stockQty, variant.reservedQty),
        availableQty: qty,
      };
    }),
    priceFrom: toMoney(min),
    priceTo: toMoney(max),
  };
}
