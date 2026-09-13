import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { adminOrderListQuerySchema, updateOrderStatusInputSchema } from '@audio-commerce/shared';
import { validate } from '../../../middleware/validate.js';
import * as controller from './orders.controller.js';

const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

const idParamsSchema = z.object({ id: z.string().uuid() }).strict();

export const adminOrdersRouter = Router();

adminOrdersRouter.get('/', validate(adminOrderListQuerySchema, 'query'), asyncHandler(controller.listOrdersHandler));
adminOrdersRouter.get('/:id', validate(idParamsSchema, 'params'), asyncHandler(controller.getOrderHandler));
adminOrdersRouter.patch(
  '/:id/status',
  validate(idParamsSchema, 'params'),
  validate(updateOrderStatusInputSchema),
  asyncHandler(controller.updateOrderStatusHandler),
);
