import type { ProductCardDto, ProductDetailDto, ReviewSummaryDto, VariantDto } from '@audio-commerce/shared';
import type { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { availableQty, productInStock, variantInStock } from './availability.js';
import { toMoney, toMoneyNullable } from './money.js';

type PriceSource = {
  basePrice: Decimal;
  variants: { priceOverride: Decimal | null; compareAtPrice: Decimal | null }[];
};

type CardSource = {
  slug: string;
  name: string;
  featured: boolean;
  basePrice: Decimal;
  ratingAvg: Decimal;
  reviewCount: number;
  brand: { slug: string; name: string } | null;
  category: { slug: string; name: string };
  variants: {
    priceOverride: Decimal | null;
    compareAtPrice: Decimal | null;
    stockQty: number;
    reservedQty: number;
  }[];
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
  ratingAvg: Decimal;
  reviewCount: number;
  specs: Prisma.JsonValue;
  brand: { slug: string; name: string; logoUrl: string | null } | null;
  category: { slug: string; name: string };
  variants: {
    id: string;
    sku: string;
    attributes: Prisma.JsonValue;
    priceOverride: Decimal | null;
    compareAtPrice: Decimal | null;
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

/** The compare-at price shown alongside the lowest-priced variant, if it represents a real discount. */
function representativeCompareAtPrice(
  product: PriceSource,
): Decimal | null {
  if (product.variants.length === 0) return null;
  let cheapest = product.variants[0];
  for (const variant of product.variants) {
    const price = variant.priceOverride ?? product.basePrice;
    const cheapestPrice = cheapest.priceOverride ?? product.basePrice;
    if (new Decimal(price).lt(cheapestPrice)) cheapest = variant;
  }
  const price = cheapest.priceOverride ?? product.basePrice;
  if (cheapest.compareAtPrice && new Decimal(cheapest.compareAtPrice).gt(price)) {
    return cheapest.compareAtPrice;
  }
  return null;
}

function toRatingNumber(value: Decimal): number {
  return Math.round(new Decimal(value).toNumber() * 10) / 10;
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
    compareAtPrice: toMoneyNullable(representativeCompareAtPrice(product)),
    rating: toRatingNumber(product.ratingAvg),
    reviewCount: product.reviewCount,
    thumbnail: thumb ? { url: thumb.url, altText: thumb.altText, position: thumb.position } : null,
    inStock: productInStock(product.variants),
    featured: product.featured,
  };
}

export function toDetail(
  product: DetailSource,
  reviews: ReviewSummaryDto[],
  relatedProducts: ProductCardDto[],
): ProductDetailDto {
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
      const price = variant.priceOverride ?? product.basePrice;
      const showCompareAt = variant.compareAtPrice && new Decimal(variant.compareAtPrice).gt(price);
      return {
        id: variant.id,
        sku: variant.sku,
        attributes: variant.attributes as VariantDto['attributes'],
        price: toMoney(price),
        compareAtPrice: showCompareAt ? toMoney(variant.compareAtPrice as Decimal) : null,
        inStock: variantInStock(variant.stockQty, variant.reservedQty),
        availableQty: qty,
      };
    }),
    priceFrom: toMoney(min),
    priceTo: toMoney(max),
    compareAtPrice: toMoneyNullable(representativeCompareAtPrice(product)),
    rating: toRatingNumber(product.ratingAvg),
    reviewCount: product.reviewCount,
    specs: (product.specs as Record<string, string>) ?? {},
    reviews,
    relatedProducts,
  };
}
