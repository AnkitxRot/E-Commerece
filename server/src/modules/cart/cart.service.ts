import type { CartDto, CartItemDto } from '@audio-commerce/shared';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../lib/prisma.js';
import { ConflictError, NotFoundError } from '../../errors/AppError.js';
import { availableQty, variantInStock } from '../catalog/availability.js';
import { toMoney, toMoneyNullable } from '../catalog/money.js';

const cartItemInclude = {
  variant: {
    include: {
      product: {
        include: {
          images: { orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }], take: 1 },
        },
      },
    },
  },
};

type CartItemRow = {
  id: string;
  qty: number;
  variant: {
    id: string;
    sku: string;
    attributes: unknown;
    priceOverride: Decimal | null;
    compareAtPrice: Decimal | null;
    stockQty: number;
    reservedQty: number;
    product: {
      slug: string;
      name: string;
      basePrice: Decimal;
      status: string;
      images: { url: string; altText: string; position: number }[];
    };
  };
};

function toItemDto(row: CartItemRow): CartItemDto {
  const price = row.variant.priceOverride ?? row.variant.product.basePrice;
  const available = Math.max(0, availableQty(row.variant.stockQty, row.variant.reservedQty));
  const thumb = row.variant.product.images[0];
  const showCompareAt = row.variant.compareAtPrice && new Decimal(row.variant.compareAtPrice).gt(price);
  return {
    id: row.id,
    variantId: row.variant.id,
    sku: row.variant.sku,
    productSlug: row.variant.product.slug,
    productName: row.variant.product.name,
    attributes: row.variant.attributes as Record<string, string>,
    thumbnail: thumb ? { url: thumb.url, altText: thumb.altText, position: thumb.position } : null,
    unitPrice: toMoney(price),
    compareAtPrice: showCompareAt ? toMoneyNullable(row.variant.compareAtPrice) : null,
    qty: row.qty,
    availableQty: available,
    inStock: variantInStock(row.variant.stockQty, row.variant.reservedQty),
    lineTotal: toMoney(new Decimal(price).times(row.qty)),
  };
}

async function getOrCreateCartId(userId: string): Promise<string> {
  const existing = await prisma.cart.findUnique({ where: { userId } });
  if (existing) return existing.id;
  const created = await prisma.cart.create({ data: { userId } });
  return created.id;
}

function toCartDto(items: CartItemDto[]): CartDto {
  const itemCount = items.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = items.reduce((sum, item) => sum.plus(item.lineTotal), new Decimal(0));
  return { items, itemCount, subtotal: toMoney(subtotal) };
}

export async function getCart(userId: string): Promise<CartDto> {
  const cartId = await getOrCreateCartId(userId);
  const rows = await prisma.cartItem.findMany({
    where: { cartId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    include: cartItemInclude,
  });
  return toCartDto(rows.map(toItemDto));
}

async function assertVariantPurchasable(variantId: string, requestedQty: number) {
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: { product: { select: { status: true } } },
  });
  if (!variant || variant.product.status !== 'ACTIVE') {
    throw new NotFoundError('Product variant not found');
  }
  const available = availableQty(variant.stockQty, variant.reservedQty);
  if (available < requestedQty) {
    throw new ConflictError(
      available <= 0
        ? 'This item is currently out of stock.'
        : `Only ${available} left in stock — reduce the quantity and try again.`,
    );
  }
}

export async function addItem(userId: string, variantId: string, qty: number): Promise<CartDto> {
  const cartId = await getOrCreateCartId(userId);
  const existing = await prisma.cartItem.findUnique({
    where: { cartId_variantId: { cartId, variantId } },
  });
  const nextQty = (existing?.qty ?? 0) + qty;
  await assertVariantPurchasable(variantId, nextQty);

  if (existing) {
    await prisma.cartItem.update({ where: { id: existing.id }, data: { qty: nextQty } });
  } else {
    await prisma.cartItem.create({ data: { cartId, variantId, qty } });
  }
  return getCart(userId);
}

export async function updateItemQty(userId: string, itemId: string, qty: number): Promise<CartDto> {
  const cartId = await getOrCreateCartId(userId);
  const item = await prisma.cartItem.findFirst({ where: { id: itemId, cartId } });
  if (!item) throw new NotFoundError('Cart item not found');
  await assertVariantPurchasable(item.variantId, qty);
  await prisma.cartItem.update({ where: { id: itemId }, data: { qty } });
  return getCart(userId);
}

export async function removeItem(userId: string, itemId: string): Promise<CartDto> {
  const cartId = await getOrCreateCartId(userId);
  await prisma.cartItem.deleteMany({ where: { id: itemId, cartId } });
  return getCart(userId);
}

export async function clearCart(userId: string): Promise<CartDto> {
  const cartId = await getOrCreateCartId(userId);
  await prisma.cartItem.deleteMany({ where: { cartId } });
  return getCart(userId);
}
