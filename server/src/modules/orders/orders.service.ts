import type { OrderDto, ShippingAddressInput } from '@audio-commerce/shared';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { createHash } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../errors/AppError.js';
import { decrementStock } from '../inventory/inventory.service.js';
import { toMoney } from '../catalog/money.js';
import { calculateDiscount } from '../coupons/coupons.service.js';

const FREE_SHIPPING_THRESHOLD = new Decimal('999.00');
const FLAT_SHIPPING_FEE = new Decimal('79.00');
const CURRENCY = 'INR';

type OrderRow = {
  id: string;
  status: string;
  currency: string;
  subtotal: Prisma.Decimal;
  discountTotal: Prisma.Decimal;
  shippingTotal: Prisma.Decimal;
  taxTotal: Prisma.Decimal;
  grandTotal: Prisma.Decimal;
  couponCode: string | null;
  shippingAddress: Prisma.JsonValue;
  createdAt: Date;
  items: {
    id: string;
    productId: string | null;
    product: { slug: string } | null;
    productName: string;
    variantSku: string;
    variantAttributes: Prisma.JsonValue;
    unitPrice: Prisma.Decimal;
    qty: number;
    lineTotal: Prisma.Decimal;
  }[];
};

function toOrderDto(order: OrderRow): OrderDto {
  return {
    id: order.id,
    status: order.status as OrderDto['status'],
    currency: order.currency,
    subtotal: toMoney(order.subtotal),
    discountTotal: toMoney(order.discountTotal),
    shippingTotal: toMoney(order.shippingTotal),
    taxTotal: toMoney(order.taxTotal),
    grandTotal: toMoney(order.grandTotal),
    couponCode: order.couponCode,
    shippingAddress: order.shippingAddress as ShippingAddressInput,
    items: order.items.map((item) => ({
      id: item.id,
      productSlug: item.product?.slug ?? null,
      productName: item.productName,
      variantSku: item.variantSku,
      variantAttributes: item.variantAttributes as Record<string, string>,
      unitPrice: toMoney(item.unitPrice),
      qty: item.qty,
      lineTotal: toMoney(item.lineTotal),
    })),
    createdAt: order.createdAt.toISOString(),
  };
}

const orderInclude = {
  items: { include: { product: { select: { slug: true } } }, orderBy: [{ createdAt: 'asc' as const }] },
};

/** Deterministic regardless of key insertion order, so the same logical
 * request always hashes the same way. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

function hashOrderRequest(shippingAddress: ShippingAddressInput, couponCode: string | undefined): string {
  return createHash('sha256')
    .update(stableStringify({ shippingAddress, couponCode: couponCode ?? null }))
    .digest('hex');
}

/** A durably created order is the only thing that counts as "already done" —
 * a prior attempt that failed before tx.order.create (e.g. empty cart, out
 * of stock, invalid coupon) never wrote a row, so a retry with the same key
 * correctly falls through and tries again from scratch. Throws if the key
 * was already used for a request whose hash doesn't match this one. */
async function findIdempotentReplay(
  userId: string,
  idempotencyKey: string,
  shippingAddress: ShippingAddressInput,
  couponCode: string | undefined,
): Promise<OrderDto | null> {
  const existing = await prisma.order.findUnique({
    where: { userId_idempotencyKey: { userId, idempotencyKey } },
    include: orderInclude,
  });
  if (!existing) return null;
  if (existing.idempotencyRequestHash !== hashOrderRequest(shippingAddress, couponCode)) {
    throw new ConflictError('This idempotency key was already used for a different request.');
  }
  return toOrderDto(existing);
}

export async function createOrder(
  userId: string,
  shippingAddress: ShippingAddressInput,
  couponCode?: string,
  idempotencyKey?: string,
): Promise<OrderDto> {
  if (idempotencyKey) {
    const replay = await findIdempotentReplay(userId, idempotencyKey, shippingAddress, couponCode);
    if (replay) return replay;
  }

  try {
    const order = await prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findUnique({
        where: { userId },
        include: {
          items: {
            include: { variant: { include: { product: true } } },
            orderBy: [{ createdAt: 'asc' }],
          },
        },
      });

      if (!cart || cart.items.length === 0) {
        throw new ValidationError('Your cart is empty.');
      }

      for (const item of cart.items) {
        if (item.variant.product.status !== 'ACTIVE') {
          throw new ConflictError(`${item.variant.product.name} is no longer available.`);
        }
      }

      // Reserve stock atomically per line item — never read-then-write.
      for (const item of cart.items) {
        await decrementStock(item.variantId, item.qty, tx);
      }

      let subtotal = new Decimal(0);
      const itemsData = cart.items.map((item) => {
        const unitPrice = item.variant.priceOverride ?? item.variant.product.basePrice;
        const lineTotal = new Decimal(unitPrice).times(item.qty);
        subtotal = subtotal.plus(lineTotal);
        return {
          productId: item.variant.product.id,
          productName: item.variant.product.name,
          variantSku: item.variant.sku,
          variantAttributes: item.variant.attributes as Prisma.InputJsonValue,
          unitPrice,
          qty: item.qty,
          lineTotal,
        };
      });

      const shippingTotal =
        subtotal.gte(FREE_SHIPPING_THRESHOLD) || subtotal.eq(0) ? new Decimal(0) : FLAT_SHIPPING_FEE;
      const taxTotal = new Decimal(0);

      // Re-validate and apply the coupon from scratch here, inside the same
      // transaction as the stock reservation above — never trust a client's
      // discount amount, and never trust an earlier preview call, since the
      // coupon's state (or the cart) may have changed since then. The
      // usage-limit check is an atomic conditional update, the same pattern
      // decrementStock uses for stock: it re-reads timesUsed under the row
      // lock, so a concurrent request racing the same coupon toward its limit
      // can never both succeed.
      let discountTotal = new Decimal(0);
      let appliedCouponCode: string | null = null;
      if (couponCode) {
        const coupon = await tx.coupon.findUnique({ where: { code: couponCode } });
        if (!coupon || !coupon.active) throw new ValidationError('This coupon code is not valid.');
        if (coupon.expiresAt.getTime() <= Date.now()) throw new ValidationError('This coupon has expired.');

        const usageGuard =
          coupon.usageLimit === null ? { id: coupon.id } : { id: coupon.id, timesUsed: { lt: coupon.usageLimit } };
        const result = await tx.coupon.updateMany({ where: usageGuard, data: { timesUsed: { increment: 1 } } });
        if (result.count === 0) throw new ConflictError('This coupon has reached its usage limit.');

        discountTotal = calculateDiscount(subtotal, coupon);
        appliedCouponCode = coupon.code;
      }

      const grandTotal = subtotal.plus(shippingTotal).plus(taxTotal).minus(discountTotal);

      const created = await tx.order.create({
        data: {
          userId,
          status: 'CONFIRMED',
          currency: CURRENCY,
          subtotal,
          discountTotal,
          shippingTotal,
          taxTotal,
          grandTotal,
          couponCode: appliedCouponCode,
          idempotencyKey: idempotencyKey ?? null,
          idempotencyRequestHash: idempotencyKey ? hashOrderRequest(shippingAddress, couponCode) : null,
          shippingAddress: shippingAddress as unknown as Prisma.InputJsonValue,
          items: { create: itemsData },
        },
        include: orderInclude,
      });

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return created;
    });

    return toOrderDto(order);
  } catch (err) {
    // A concurrent duplicate request racing the same (userId, idempotencyKey)
    // can make THIS attempt fail in more than one way — not only the DB's
    // unique-constraint violation on a simultaneous INSERT, but also e.g.
    // "cart is empty" if the other request's transaction fully committed
    // (including clearing the cart) before this one even read it. Either way
    // our own stock reservation/coupon usage rolled back with the rest of
    // this transaction, and the other request's is the one that actually
    // happened — so on ANY failure, re-check for that outcome before
    // surfacing an error to what may just be a legitimate retry. This only
    // ever changes the response when a matching order genuinely now exists;
    // an unrelated failure (e.g. a real DB error) finds nothing and rethrows.
    if (idempotencyKey) {
      const replay = await findIdempotentReplay(userId, idempotencyKey, shippingAddress, couponCode);
      if (replay) return replay;
    }
    throw err;
  }
}

export async function listOrdersForUser(userId: string): Promise<OrderDto[]> {
  const orders = await prisma.order.findMany({
    where: { userId },
    orderBy: [{ createdAt: 'desc' }],
    include: orderInclude,
  });
  return orders.map(toOrderDto);
}

export async function getOrderById(userId: string, role: string, orderId: string): Promise<OrderDto> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: orderInclude });
  if (!order) throw new NotFoundError('Order not found');
  if (order.userId !== userId && role !== 'ADMIN') throw new ForbiddenError();
  return toOrderDto(order);
}
