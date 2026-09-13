import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  adminProductListQuerySchema,
  createProductInputSchema,
  updateProductInputSchema,
  updateVariantInputSchema,
} from '@audio-commerce/shared';
import { validate } from '../../middleware/validate.js';
import * as controller from './products.controller.js';

const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

const idParamsSchema = z.object({ id: z.string().uuid() }).strict();
const variantParamsSchema = z.object({ id: z.string().uuid(), variantId: z.string().uuid() }).strict();

export const adminProductsRouter = Router();

adminProductsRouter.get('/', validate(adminProductListQuerySchema, 'query'), asyncHandler(controller.listProductsHandler));
adminProductsRouter.post('/', validate(createProductInputSchema), asyncHandler(controller.createProductHandler));
adminProductsRouter.get('/:id', validate(idParamsSchema, 'params'), asyncHandler(controller.getProductHandler));
adminProductsRouter.patch(
  '/:id',
  validate(idParamsSchema, 'params'),
  validate(updateProductInputSchema),
  asyncHandler(controller.updateProductHandler),
);
adminProductsRouter.patch(
  '/:id/variants/:variantId',
  validate(variantParamsSchema, 'params'),
  validate(updateVariantInputSchema),
  asyncHandler(controller.updateVariantHandler),
);
