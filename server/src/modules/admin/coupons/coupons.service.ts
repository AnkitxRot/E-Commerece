import type { Coupon, Prisma } from '@prisma/client';
import type { AdminCouponDto, AdminCouponListResponse, CreateCouponInput, UpdateCouponInput } from '@audio-commerce/shared';
import { prisma } from '../../../lib/prisma.js';
import { ConflictError, NotFoundError } from '../../../errors/AppError.js';
import { recordAudit } from '../audit.js';
import { toMoney } from '../../catalog/money.js';

function toDto(row: Coupon): AdminCouponDto {
  return {
    id: row.id,
    code: row.code,
    type: row.type as AdminCouponDto['type'],
    value: toMoney(row.value),
    expiresAt: row.expiresAt.toISOString(),
    usageLimit: row.usageLimit,
    timesUsed: row.timesUsed,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listCoupons(): Promise<AdminCouponListResponse> {
  const rows = await prisma.coupon.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] });
  return { coupons: rows.map(toDto) };
}

async function assertUniqueCode(code: string): Promise<void> {
  const existing = await prisma.coupon.findUnique({ where: { code } });
  if (existing) throw new ConflictError('A coupon with this code already exists');
}

export async function createCoupon(actorId: string, input: CreateCouponInput): Promise<AdminCouponDto> {
  await assertUniqueCode(input.code);

  const created = await prisma.$transaction(async (tx) => {
    const coupon = await tx.coupon.create({
      data: {
        code: input.code,
        type: input.type,
        value: input.value,
        expiresAt: new Date(input.expiresAt),
        usageLimit: input.usageLimit,
        active: input.active ?? true,
      },
    });
    await recordAudit(
      actorId,
      'coupon.create',
      'Coupon',
      coupon.id,
      { code: coupon.code, type: coupon.type, value: input.value },
      tx,
    );
    return coupon;
  });

  return toDto(created);
}

export async function updateCoupon(actorId: string, id: string, input: UpdateCouponInput): Promise<AdminCouponDto> {
  const existing = await prisma.coupon.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Coupon not found');

  const updated = await prisma.$transaction(async (tx) => {
    const coupon = await tx.coupon.update({
      where: { id },
      data: {
        value: input.value,
        expiresAt: input.expiresAt !== undefined ? new Date(input.expiresAt) : undefined,
        usageLimit: input.usageLimit,
        active: input.active,
      },
    });
    await recordAudit(actorId, 'coupon.update', 'Coupon', id, input as Prisma.InputJsonValue, tx);
    return coupon;
  });

  return toDto(updated);
}

export async function deleteCoupon(actorId: string, id: string): Promise<void> {
  const existing = await prisma.coupon.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Coupon not found');
  if (existing.timesUsed > 0) {
    throw new ConflictError('Cannot delete a coupon that has already been used on an order — deactivate it instead');
  }

  await prisma.$transaction(async (tx) => {
    await tx.coupon.delete({ where: { id } });
    await recordAudit(actorId, 'coupon.delete', 'Coupon', id, { code: existing.code }, tx);
  });
}
