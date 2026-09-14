import { Prisma } from '@prisma/client';
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

  try {
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
  } catch (err) {
    // The variant was deleted by a concurrent request between the
    // ownership check above and this update — report the same 404 as any
    // other "doesn't exist" case instead of an uncaught 500.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw new NotFoundError('Variant not found');
    }
    throw err;
  }

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

  try {
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
  } catch (err) {
    // The check above is a convenience, not the authoritative guard — sku
    // has a DB-level unique constraint, so a concurrent create racing the
    // same SKU past that check is caught here instead of surfacing as a
    // raw 500. Same pattern reviews.service.ts uses for its own unique
    // constraint (one review per product per user).
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError(`SKU already in use: ${input.sku}`);
    }
    throw err;
  }

  return getProductById(productId);
}

export async function deleteVariant(actorId: string, productId: string, variantId: string): Promise<AdminProductDetailDto> {
  const variant = await prisma.productVariant.findFirst({ where: { id: variantId, productId } });
  if (!variant) throw new NotFoundError('Variant not found');

  try {
    await prisma.$transaction(async (tx) => {
      // SELECT ... FOR UPDATE locks every one of this product's variant rows
      // for the rest of this transaction. A concurrent delete of a SIBLING
      // variant, running the same lock query, blocks here until this
      // transaction commits or rolls back — so two concurrent deletes can
      // never both see "2 variants left" and both proceed, unlike a plain
      // count() read outside a lock would allow. Once unblocked, the second
      // transaction re-evaluates against the now-current state and correctly
      // hits the ConflictError below. (A concurrent delete of the SAME
      // variantId is handled by the catch below instead — P2025 on the
      // actual delete, since the pre-transaction existence check above
      // can't see a deletion that lost this same race.)
      const locked = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "ProductVariant" WHERE "productId" = ${productId} FOR UPDATE`;
      if (locked.length <= 1) {
        throw new ConflictError("Cannot delete a product's last remaining variant — every product needs at least one.");
      }

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
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw new NotFoundError('Variant not found');
    }
    throw err;
  }

  return getProductById(productId);
}
