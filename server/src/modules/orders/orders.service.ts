import type { OrderDto, ShippingAddressInput } from '@audio-commerce/shared';
import type { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../lib/prisma.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../errors/AppError.js';
import { decrementStock } from '../inventory/inventory.service.js';
import { toMoney } from '../catalog/money.js';

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

export async function createOrder(userId: string, shippingAddress: ShippingAddressInput): Promise<OrderDto> {
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

    const shippingTotal = subtotal.gte(FREE_SHIPPING_THRESHOLD) || subtotal.eq(0) ? new Decimal(0) : FLAT_SHIPPING_FEE;
    const taxTotal = new Decimal(0);
    const discountTotal = new Decimal(0);
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
        shippingAddress: shippingAddress as unknown as Prisma.InputJsonValue,
        items: { create: itemsData },
      },
      include: orderInclude,
    });

    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

    return created;
  });

  return toOrderDto(order);
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
