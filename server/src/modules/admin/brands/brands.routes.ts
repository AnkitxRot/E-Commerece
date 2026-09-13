import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { createBrandInputSchema, updateBrandInputSchema } from '@audio-commerce/shared';
import { validate } from '../../../middleware/validate.js';
import * as controller from './brands.controller.js';

const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

const idParamsSchema = z.object({ id: z.string().uuid() }).strict();

export const adminBrandsRouter = Router();

adminBrandsRouter.get('/', asyncHandler(controller.listBrandsHandler));
adminBrandsRouter.post('/', validate(createBrandInputSchema), asyncHandler(controller.createBrandHandler));
adminBrandsRouter.patch(
  '/:id',
  validate(idParamsSchema, 'params'),
  validate(updateBrandInputSchema),
  asyncHandler(controller.updateBrandHandler),
);
adminBrandsRouter.delete('/:id', validate(idParamsSchema, 'params'), asyncHandler(controller.deleteBrandHandler));
