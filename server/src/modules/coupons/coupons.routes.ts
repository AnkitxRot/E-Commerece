import { Router, type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { validateCouponInputSchema } from '@audio-commerce/shared';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { env } from '../../config/env.js';
import * as controller from './coupons.controller.js';

const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

// Without this, an authenticated user could brute-force guessable codes
// (SAVE10, WELCOME20, ...) — this never touches usage state, only reveals
// whether a code is currently valid, but that's still worth rate-limiting.
const validateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'production' ? 30 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
});

export const couponsRouter = Router();

couponsRouter.use(requireAuth);
couponsRouter.post(
  '/validate',
  validateLimiter,
  validate(validateCouponInputSchema),
  asyncHandler(controller.validateCouponHandler),
);
