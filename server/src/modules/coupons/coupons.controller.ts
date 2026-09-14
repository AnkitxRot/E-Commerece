import type { Request, Response } from 'express';
import type { ValidateCouponInput } from '@audio-commerce/shared';
import * as couponsService from './coupons.service.js';

export async function validateCouponHandler(req: Request, res: Response) {
  const { code } = req.body as ValidateCouponInput;
  const coupon = await couponsService.previewCoupon(req.user!.id, code);
  res.status(200).json({ coupon });
}
