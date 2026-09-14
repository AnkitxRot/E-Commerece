import { z } from 'zod';
import { moneySchema } from './catalog.js';
import { CouponType } from '../enums.js';

export const couponCodeSchema = z
  .string()
  .trim()
  .min(3, 'Coupon code must be at least 3 characters')
  .max(30, 'Coupon code must be at most 30 characters')
  .regex(/^[A-Za-z0-9_-]+$/, 'Use only letters, numbers, hyphens, and underscores')
  .transform((value) => value.toUpperCase());

// ---- Customer-facing: validate a coupon against the current cart ----

export const validateCouponInputSchema = z.object({ code: couponCodeSchema }).strict();
export type ValidateCouponInput = z.infer<typeof validateCouponInputSchema>;

export const couponPreviewDtoSchema = z
  .object({
    code: z.string(),
    type: z.nativeEnum(CouponType),
    value: moneySchema,
    discountAmount: moneySchema,
  })
  .strict();
export type CouponPreviewDto = z.infer<typeof couponPreviewDtoSchema>;

export const couponPreviewResponseSchema = z.object({ coupon: couponPreviewDtoSchema }).strict();
export type CouponPreviewResponse = z.infer<typeof couponPreviewResponseSchema>;

// ---- Admin: coupon management ----

/** Shared by createCouponInputSchema's superRefine and the admin update
 * service (which re-checks this against the coupon's existing `type`,
 * since `type` itself is immutable and not part of the update payload). */
export function couponValueError(type: CouponType, value: string): string | null {
  const numeric = Number(value);
  if (type === CouponType.PERCENT && (numeric <= 0 || numeric > 100)) {
    return 'A percent coupon must have a value between 0.01 and 100';
  }
  if (type === CouponType.FIXED && numeric <= 0) {
    return 'A fixed coupon must have a value greater than 0';
  }
  return null;
}

export const createCouponInputSchema = z
  .object({
    code: couponCodeSchema,
    type: z.nativeEnum(CouponType),
    value: moneySchema,
    expiresAt: z.string().datetime(),
    usageLimit: z.number().int().min(1).nullable(),
    active: z.boolean().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const message = couponValueError(data.type, data.value);
    if (message) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['value'], message });
  });
export type CreateCouponInput = z.infer<typeof createCouponInputSchema>;

// Code is intentionally immutable after creation: Order.couponCode is a
// point-in-time snapshot on historical orders, and renaming a live coupon
// out from under existing orders would make that history confusing to read.
export const updateCouponInputSchema = z
  .object({
    value: moneySchema.optional(),
    expiresAt: z.string().datetime().optional(),
    usageLimit: z.number().int().min(1).nullable().optional(),
    active: z.boolean().optional(),
  })
  .strict();
export type UpdateCouponInput = z.infer<typeof updateCouponInputSchema>;

export const adminCouponDtoSchema = z
  .object({
    id: z.string().uuid(),
    code: z.string(),
    type: z.nativeEnum(CouponType),
    value: moneySchema,
    expiresAt: z.string(),
    usageLimit: z.number().int().nullable(),
    timesUsed: z.number().int(),
    active: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();
export type AdminCouponDto = z.infer<typeof adminCouponDtoSchema>;

export const adminCouponListResponseSchema = z.object({ coupons: z.array(adminCouponDtoSchema) }).strict();
export type AdminCouponListResponse = z.infer<typeof adminCouponListResponseSchema>;

export const adminCouponResponseSchema = z.object({ coupon: adminCouponDtoSchema }).strict();
export type AdminCouponResponse = z.infer<typeof adminCouponResponseSchema>;
