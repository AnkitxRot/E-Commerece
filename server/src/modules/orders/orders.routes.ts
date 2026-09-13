import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { createOrderInputSchema } from '@audio-commerce/shared';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import * as controller from './orders.controller.js';

const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

const orderParamsSchema = z.object({ orderId: z.string().uuid() }).strict();

export const ordersRouter = Router();

ordersRouter.use(requireAuth);
ordersRouter.post('/', validate(createOrderInputSchema), asyncHandler(controller.createOrderHandler));
ordersRouter.get('/', asyncHandler(controller.listOrdersHandler));
ordersRouter.get('/:orderId', validate(orderParamsSchema, 'params'), asyncHandler(controller.getOrderHandler));
