import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { addCartItemSchema, updateCartItemSchema } from '@audio-commerce/shared';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import * as controller from './cart.controller.js';

const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

const itemParamsSchema = z.object({ itemId: z.string().uuid() }).strict();

export const cartRouter = Router();

cartRouter.use(requireAuth);
cartRouter.get('/', asyncHandler(controller.getCartHandler));
cartRouter.post('/items', validate(addCartItemSchema), asyncHandler(controller.addItemHandler));
cartRouter.patch(
  '/items/:itemId',
  validate(itemParamsSchema, 'params'),
  validate(updateCartItemSchema),
  asyncHandler(controller.updateItemHandler),
);
cartRouter.delete(
  '/items/:itemId',
  validate(itemParamsSchema, 'params'),
  asyncHandler(controller.removeItemHandler),
);
cartRouter.delete('/', asyncHandler(controller.clearCartHandler));
