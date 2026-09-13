import type { Prisma } from '@prisma/client';
import type { Decimal } from '@prisma/client/runtime/library';
import type {
  AdminOrderDetailDto,
  AdminOrderItemDto,
  AdminOrderListQuery,
  AdminOrderListResponse,
  AdminOrderSummaryDto,
} from '@audio-commerce/shared';
import { prisma } from '../../../lib/prisma.js';
import { ConflictError, NotFoundError } from '../../../errors/AppError.js';
import { toMoney } from '../../catalog/money.js';
import { recordAudit } from '../audit.js';

/** Valid order status transitions — never allows an arbitrary jump (e.g. PENDING -> DELIVERED). */
const ORDER_STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
};

type OrderSummaryRow = {
  id: string;
  status: string;
  currency: string;
  grandTotal: Decimal;
  createdAt: Date;
  user: { email: string };
  items: { qty: number }[];
};

function toSummary(order: OrderSummaryRow): AdminOrderSummaryDto {
  return {
    id: order.id,
    status: order.status as AdminOrderSummaryDto['status'],
    currency: order.currency,
    grandTotal: toMoney(order.grandTotal),
    customerEmail: order.user.email,
    itemCount: order.items.reduce((sum, item) => sum + item.qty, 0),
    createdAt: order.createdAt.toISOString(),
  };
}

const summaryInclude = { user: { select: { email: true } }, items: { select: { qty: true } } };

export async function listOrders(query: AdminOrderListQuery): Promise<AdminOrderListResponse> {
  const where: Prisma.OrderWhereInput = query.status ? { status: query.status } : {};
  const [total, rows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
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

const detailInclude = {
  user: { select: { id: true, email: true, name: true } },
  items: { include: { product: { select: { slug: true } } }, orderBy: [{ createdAt: 'asc' as const }] },
};

type OrderDetailRow = {
  id: string;
  status: string;
  currency: string;
  subtotal: Decimal;
  discountTotal: Decimal;
  shippingTotal: Decimal;
  taxTotal: Decimal;
  grandTotal: Decimal;
  shippingAddress: Prisma.JsonValue;
  createdAt: Date;
  user: { id: string; email: string; name: string };
  items: {
    id: string;
    product: { slug: string } | null;
    productName: string;
    variantSku: string;
    variantAttributes: Prisma.JsonValue;
    unitPrice: Decimal;
    qty: number;
    lineTotal: Decimal;
  }[];
};

function toDetail(order: OrderDetailRow): AdminOrderDetailDto {
  const items: AdminOrderItemDto[] = order.items.map((item) => ({
    id: item.id,
    productSlug: item.product?.slug ?? null,
    productName: item.productName,
    variantSku: item.variantSku,
    variantAttributes: item.variantAttributes as Record<string, string>,
    unitPrice: toMoney(item.unitPrice),
    qty: item.qty,
    lineTotal: toMoney(item.lineTotal),
  }));

  return {
    id: order.id,
    status: order.status as AdminOrderDetailDto['status'],
    currency: order.currency,
    subtotal: toMoney(order.subtotal),
    discountTotal: toMoney(order.discountTotal),
    shippingTotal: toMoney(order.shippingTotal),
    taxTotal: toMoney(order.taxTotal),
    grandTotal: toMoney(order.grandTotal),
    shippingAddress: order.shippingAddress as AdminOrderDetailDto['shippingAddress'],
    customer: order.user,
    items,
    createdAt: order.createdAt.toISOString(),
  };
}

export async function getOrderById(id: string): Promise<AdminOrderDetailDto> {
  const order = await prisma.order.findUnique({ where: { id }, include: detailInclude });
  if (!order) throw new NotFoundError('Order not found');
  return toDetail(order);
}

export async function updateOrderStatus(
  actorId: string,
  id: string,
  nextStatus: string,
): Promise<AdminOrderDetailDto> {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw new NotFoundError('Order not found');

  const allowed = ORDER_STATUS_TRANSITIONS[order.status] ?? [];
  if (!allowed.includes(nextStatus)) {
    throw new ConflictError(`Cannot move an order from ${order.status} to ${nextStatus}`);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.order.update({
      where: { id },
      data: { status: nextStatus as Prisma.OrderUpdateInput['status'] },
      include: detailInclude,
    });
    await recordAudit(actorId, 'order.status.update', 'Order', id, { from: order.status, to: nextStatus }, tx);
    return result;
  });

  return toDetail(updated);
}
