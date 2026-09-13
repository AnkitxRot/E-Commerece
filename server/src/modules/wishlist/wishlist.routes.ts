import { Router, type NextFunction, type Request, type Response } from 'express';
import { addWishlistItemSchema, wishlistSlugParamSchema } from '@audio-commerce/shared';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import * as controller from './wishlist.controller.js';

const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

export const wishlistRouter = Router();

wishlistRouter.use(requireAuth);
wishlistRouter.get('/', asyncHandler(controller.getWishlistHandler));
wishlistRouter.post(
  '/items',
  validate(addWishlistItemSchema),
  asyncHandler(controller.addItemHandler),
);
wishlistRouter.delete(
  '/items/:slug',
  validate(wishlistSlugParamSchema, 'params'),
  asyncHandler(controller.removeItemHandler),
);
