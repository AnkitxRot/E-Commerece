import type { Request, Response } from 'express';
import type { CreateCouponInput, UpdateCouponInput } from '@audio-commerce/shared';
import * as couponsService from './coupons.service.js';

export async function listCouponsHandler(_req: Request, res: Response) {
  res.status(200).json(await couponsService.listCoupons());
}

export async function createCouponHandler(req: Request, res: Response) {
  const coupon = await couponsService.createCoupon(req.user!.id, req.body as CreateCouponInput);
  res.status(201).json({ coupon });
}

export async function updateCouponHandler(req: Request, res: Response) {
  const coupon = await couponsService.updateCoupon(req.user!.id, req.params.id, req.body as UpdateCouponInput);
  res.status(200).json({ coupon });
}

export async function deleteCouponHandler(req: Request, res: Response) {
  await couponsService.deleteCoupon(req.user!.id, req.params.id);
  res.status(204).send();
}
