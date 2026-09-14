import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { createCouponInputSchema, updateCouponInputSchema } from '@audio-commerce/shared';
import { validate } from '../../../middleware/validate.js';
import * as controller from './coupons.controller.js';

const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

const idParamsSchema = z.object({ id: z.string().uuid() }).strict();

export const adminCouponsRouter = Router();

adminCouponsRouter.get('/', asyncHandler(controller.listCouponsHandler));
adminCouponsRouter.post('/', validate(createCouponInputSchema), asyncHandler(controller.createCouponHandler));
adminCouponsRouter.patch(
  '/:id',
  validate(idParamsSchema, 'params'),
  validate(updateCouponInputSchema),
  asyncHandler(controller.updateCouponHandler),
);
adminCouponsRouter.delete('/:id', validate(idParamsSchema, 'params'), asyncHandler(controller.deleteCouponHandler));
