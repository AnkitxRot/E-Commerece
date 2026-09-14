import type { Prisma } from '@prisma/client';
import type { Decimal } from '@prisma/client/runtime/library';
import type {
  AdminProductDetailDto,
  AdminProductListQuery,
  AdminProductListResponse,
  AdminProductSummaryDto,
  AdminVariantInput,
  CreateProductInput,
  UpdateProductInput,
  UpdateVariantInput,
} from '@audio-commerce/shared';
import { prisma } from '../../lib/prisma.js';
import { ConflictError, NotFoundError, ValidationError } from '../../errors/AppError.js';
import { toMoney, toMoneyNullable } from '../catalog/money.js';
import { recordAudit } from './audit.js';

type ProductSummaryRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  basePrice: Decimal;
  createdAt: Date;
  category: { id: string; name: string };
  brand: { id: string; name: string } | null;
  variants: { stockQty: number; reservedQty: number; lowStockThreshold: number }[];
};

function toSummary(product: ProductSummaryRow): AdminProductSummaryDto {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    status: product.status as AdminProductSummaryDto['status'],
    basePrice: toMoney(product.basePrice),
    category: product.category,
    brand: product.brand,
    totalStock: product.variants.reduce((sum, v) => sum + v.stockQty, 0),
    lowStock: product.variants.some((v) => v.stockQty - v.reservedQty <= v.lowStockThreshold),
    createdAt: product.createdAt.toISOString(),
  };
}

type ProductDetailRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: string;
  basePrice: Decimal;
  categoryId: string;
  brandId: string | null;
  featured: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  specs: Prisma.JsonValue;
  createdAt: Date;
  variants: {
    id: string;
    sku: string;
    attributes: Prisma.JsonValue;
    stockQty: number;
    reservedQty: number;
    lowStockThreshold: number;
    priceOverride: Decimal | null;
    compareAtPrice: Decimal | null;
  }[];
};

function toDetail(product: ProductDetailRow): AdminProductDetailDto {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    status: product.status as AdminProductDetailDto['status'],
    basePrice: toMoney(product.basePrice),
    categoryId: product.categoryId,
    brandId: product.brandId,
    featured: product.featured,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    specs: (product.specs as Record<string, string>) ?? {},
    createdAt: product.createdAt.toISOString(),
    variants: product.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      attributes: variant.attributes as Record<string, string>,
      stockQty: variant.stockQty,
      reservedQty: variant.reservedQty,
      lowStockThreshold: variant.lowStockThreshold,
      priceOverride: toMoneyNullable(variant.priceOverride),
      compareAtPrice: toMoneyNullable(variant.compareAtPrice),
    })),
  };
}

const summaryInclude = {
  category: { select: { id: true, name: true } },
  brand: { select: { id: true, name: true } },
  variants: { select: { stockQty: true, reservedQty: true, lowStockThreshold: true } },
};

const detailInclude = { variants: { orderBy: [{ createdAt: 'asc' as const }] } };

export async function listProducts(query: AdminProductListQuery): Promise<AdminProductListResponse> {
  const where: Prisma.ProductWhereInput = {};
  if (query.status) where.status = query.status;
  if (query.q) {
    where.OR = [
      { name: { contains: query.q, mode: 'insensitive' } },
      { variants: { some: { sku: { contains: query.q, mode: 'insensitive' } } } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: summaryInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return {
    items: rows.map(toSummary),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
    },
  };
}

export async function getProductById(id: string): Promise<AdminProductDetailDto> {
  const product = await prisma.product.findUnique({ where: { id }, include: detailInclude });
  if (!product) throw new NotFoundError('Product not found');
  return toDetail(product);
}

/** Only ever called for a category/brand the caller is actively assigning — never for an
 *  untouched existing reference, so deactivating a category/brand never retroactively
 *  breaks unrelated edits to products already classified under it. */
async function assertCategoryExists(categoryId: string): Promise<void> {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) throw new ValidationError('Category not found');
  if (!category.isActive) throw new ValidationError('Category is inactive');
}

async function assertBrandExists(brandId: string): Promise<void> {
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) throw new ValidationError('Brand not found');
  if (!brand.isActive) throw new ValidationError('Brand is inactive');
}

export async function createProduct(actorId: string, input: CreateProductInput): Promise<AdminProductDetailDto> {
  await assertCategoryExists(input.categoryId);
  if (input.brandId) await assertBrandExists(input.brandId);

  const existingSlug = await prisma.product.findUnique({ where: { slug: input.slug } });
  if (existingSlug) throw new ConflictError('A product with this slug already exists');

  const skus = input.variants.map((v) => v.sku);
  if (new Set(skus).size !== skus.length) throw new ValidationError('Variant SKUs must be unique');
  const clashingSkus = await prisma.productVariant.findMany({
    where: { sku: { in: skus } },
    select: { sku: true },
  });
  if (clashingSkus.length > 0) {
    throw new ConflictError(`SKU already in use: ${clashingSkus.map((v) => v.sku).join(', ')}`);
  }

  const created = await prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        slug: input.slug,
        name: input.name,
        description: input.description,
        categoryId: input.categoryId,
        brandId: input.brandId ?? null,
        basePrice: input.basePrice,
        status: input.status,
        featured: input.featured,
        seoTitle: input.seoTitle ?? null,
        seoDescription: input.seoDescription ?? null,
        specs: input.specs,
        variants: {
          create: input.variants.map((variant) => ({
            sku: variant.sku,
            attributes: variant.attributes,
            stockQty: variant.stockQty,
            lowStockThreshold: variant.lowStockThreshold,
            priceOverride: variant.priceOverride ?? null,
            compareAtPrice: variant.compareAtPrice ?? null,
          })),
        },
      },
      include: detailInclude,
    });
    await recordAudit(
      actorId,
      'product.create',
      'Product',
      product.id,
      { slug: product.slug, name: product.name, status: product.status },
      tx,
    );
    return product;
  });

  return toDetail(created);
}

export async function updateProduct(
  actorId: string,
  id: string,
  input: UpdateProductInput,
): Promise<AdminProductDetailDto> {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Product not found');
  if (input.categoryId !== undefined) await assertCategoryExists(input.categoryId);
  if (input.brandId !== undefined && input.brandId !== null) await assertBrandExists(input.brandId);

  const updated = await prisma.$transaction(async (tx) => {
    const product = await tx.product.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        categoryId: input.categoryId,
        brandId: input.brandId,
        basePrice: input.basePrice,
        status: input.status,
        featured: input.featured,
        seoTitle: input.seoTitle,
        seoDescription: input.seoDescription,
        specs: input.specs,
      },
      include: detailInclude,
    });
    await recordAudit(actorId, 'product.update', 'Product', product.id, input as Prisma.InputJsonValue, tx);
    return product;
  });

  return toDetail(updated);
}

export async function updateVariant(
  actorId: string,
  productId: string,
  variantId: string,
  input: UpdateVariantInput,
): Promise<AdminProductDetailDto> {
  const variant = await prisma.productVariant.findFirst({ where: { id: variantId, productId } });
  if (!variant) throw new NotFoundError('Variant not found');

  await prisma.$transaction(async (tx) => {
    await tx.productVariant.update({
      where: { id: variantId },
      data: {
        stockQty: input.stockQty,
        lowStockThreshold: input.lowStockThreshold,
        priceOverride: input.priceOverride,
        compareAtPrice: input.compareAtPrice,
      },
    });
    await recordAudit(actorId, 'product.variant.update', 'ProductVariant', variantId, input as Prisma.InputJsonValue, tx);
  });

  return getProductById(productId);
}

export async function createVariant(
  actorId: string,
  productId: string,
  input: AdminVariantInput,
): Promise<AdminProductDetailDto> {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new NotFoundError('Product not found');

  const clashingSku = await prisma.productVariant.findUnique({ where: { sku: input.sku } });
  if (clashingSku) throw new ConflictError(`SKU already in use: ${input.sku}`);

  await prisma.$transaction(async (tx) => {
    const variant = await tx.productVariant.create({
      data: {
        productId,
        sku: input.sku,
        attributes: input.attributes,
        stockQty: input.stockQty,
        lowStockThreshold: input.lowStockThreshold,
        priceOverride: input.priceOverride ?? null,
        compareAtPrice: input.compareAtPrice ?? null,
      },
    });
    await recordAudit(actorId, 'product.variant.create', 'ProductVariant', variant.id, { sku: variant.sku, productId }, tx);
  });

  return getProductById(productId);
}

export async function deleteVariant(actorId: string, productId: string, variantId: string): Promise<AdminProductDetailDto> {
  // Known, accepted narrow race: two concurrent deletes targeting two
  // DIFFERENT variants of the same 2-variant product could both read
  // variantCount=2 here and both proceed, leaving zero variants. Unlike the
  // stock/coupon/default-address guards elsewhere in this codebase, this
  // isn't backed by a DB-level constraint (Postgres has no simple way to
  // express "at least one child row per parent" short of a trigger, which
  // has no precedent in this schema). Accepted because it requires an
  // admin to deliberately click delete on two different rows within
  // milliseconds of each other, and the worst outcome is a data-quality
  // issue (an admin adding a variant back), never a security or financial
  // one — unlike the invariants that DO have DB-level backstops.
  const [variant, variantCount] = await Promise.all([
    prisma.productVariant.findFirst({ where: { id: variantId, productId } }),
    prisma.productVariant.count({ where: { productId } }),
  ]);
  if (!variant) throw new NotFoundError('Variant not found');
  if (variantCount <= 1) {
    throw new ConflictError("Cannot delete a product's last remaining variant — every product needs at least one.");
  }

  await prisma.$transaction(async (tx) => {
    // Discontinuing a variant removes it from any customer's in-progress
    // cart too (CartItem.variantId is ON DELETE RESTRICT, so this delete
    // would otherwise fail outright while anyone has it in their cart). A
    // cart is ephemeral customer state, not a durable record the way an
    // order is: OrderItem snapshots variantSku/variantAttributes as plain
    // values, never a live reference, so past orders are never touched by
    // this — see orders.service.ts's itemsData mapping.
    await tx.cartItem.deleteMany({ where: { variantId } });
    await tx.productVariant.delete({ where: { id: variantId } });
    await recordAudit(actorId, 'product.variant.delete', 'ProductVariant', variantId, { sku: variant.sku, productId }, tx);
  });

  return getProductById(productId);
}
