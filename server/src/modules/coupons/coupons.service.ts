import { Decimal } from '@prisma/client/runtime/library';
import type { Coupon } from '@prisma/client';
import type { CouponPreviewDto } from '@audio-commerce/shared';
import { prisma } from '../../lib/prisma.js';
import { NotFoundError, ValidationError } from '../../errors/AppError.js';
import { toMoney } from '../catalog/money.js';
import { getCart } from '../cart/cart.service.js';

/** Server is authoritative: discount is always computed here from the
 * coupon's type/value and the current subtotal — never trusted from a
 * client. Clamped so a coupon can never discount an order below zero. */
export function calculateDiscount(subtotal: Decimal, coupon: Pick<Coupon, 'type' | 'value'>): Decimal {
  const raw = coupon.type === 'PERCENT' ? subtotal.times(coupon.value).dividedBy(100) : new Decimal(coupon.value);
  return Decimal.min(raw, subtotal).toDecimalPlaces(2);
}

/**
 * Throws if the coupon doesn't exist, is inactive, or is expired. The
 * usage-limit check here is a best-effort, non-authoritative read used only
 * to give fast feedback during preview — the only place usage limits are
 * actually enforced is the atomic conditional update inside the
 * order-creation transaction (orders.service.ts), which re-reads this same
 * state under the transaction and can never be bypassed by racing this
 * check.
 */
export async function findApplicableCoupon(code: string): Promise<Coupon> {
  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon || !coupon.active) throw new NotFoundError('This coupon code is not valid.');
  if (coupon.expiresAt.getTime() <= Date.now()) throw new ValidationError('This coupon has expired.');
  if (coupon.usageLimit !== null && coupon.timesUsed >= coupon.usageLimit) {
    throw new ValidationError('This coupon has reached its usage limit.');
  }
  return coupon;
}

export async function previewCoupon(userId: string, code: string): Promise<CouponPreviewDto> {
  const coupon = await findApplicableCoupon(code);
  const cart = await getCart(userId);
  if (cart.items.length === 0) throw new ValidationError('Your cart is empty.');

  const discountAmount = calculateDiscount(new Decimal(cart.subtotal), coupon);
  return {
    code: coupon.code,
    type: coupon.type as CouponPreviewDto['type'],
    value: toMoney(coupon.value),
    discountAmount: toMoney(discountAmount),
  };
}
