import type { Decimal } from '@prisma/client/runtime/library';
import type { AdminDashboardDto, AdminOrderSummaryDto } from '@audio-commerce/shared';
import { prisma } from '../../lib/prisma.js';
import { toMoney } from '../catalog/money.js';

const RECENT_ORDERS_LIMIT = 5;
// Recognized revenue excludes PENDING (not yet confirmed), CANCELLED, and REFUNDED orders.
const REVENUE_STATUSES = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] as const;

type OrderSummaryRow = {
  id: string;
  status: string;
  currency: string;
  grandTotal: Decimal;
  createdAt: Date;
  user: { email: string };
  items: { qty: number }[];
};

function toOrderSummary(order: OrderSummaryRow): AdminOrderSummaryDto {
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

export async function getDashboard(): Promise<AdminDashboardDto> {
  const [productCount, activeProductCount, orderCount, revenue, lowStockRows, recentOrders] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { status: 'ACTIVE' } }),
    prisma.order.count(),
    prisma.order.aggregate({
      where: { status: { in: [...REVENUE_STATUSES] } },
      _sum: { grandTotal: true },
    }),
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count FROM "ProductVariant"
      WHERE ("stockQty" - "reservedQty") <= "lowStockThreshold"
    `,
    prisma.order.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: RECENT_ORDERS_LIMIT,
      include: { user: { select: { email: true } }, items: { select: { qty: true } } },
    }),
  ]);

  return {
    productCount,
    activeProductCount,
    orderCount,
    revenueTotal: toMoney(revenue._sum.grandTotal ?? 0),
    lowStockCount: Number(lowStockRows[0]?.count ?? 0),
    recentOrders: recentOrders.map(toOrderSummary),
  };
}
