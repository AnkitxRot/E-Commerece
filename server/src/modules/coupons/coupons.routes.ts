import { Router, type NextFunction, type Request, type Response } from 'express';
import { validateCouponInputSchema } from '@audio-commerce/shared';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import * as controller from './coupons.controller.js';

const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

export const couponsRouter = Router();

couponsRouter.use(requireAuth);
couponsRouter.post('/validate', validate(validateCouponInputSchema), asyncHandler(controller.validateCouponHandler));
