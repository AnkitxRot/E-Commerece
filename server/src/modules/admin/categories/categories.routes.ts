import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { createCategoryInputSchema, updateCategoryInputSchema } from '@audio-commerce/shared';
import { validate } from '../../../middleware/validate.js';
import * as controller from './categories.controller.js';

const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

const idParamsSchema = z.object({ id: z.string().uuid() }).strict();

export const adminCategoriesRouter = Router();

adminCategoriesRouter.get('/', asyncHandler(controller.listCategoriesHandler));
adminCategoriesRouter.post('/', validate(createCategoryInputSchema), asyncHandler(controller.createCategoryHandler));
adminCategoriesRouter.patch(
  '/:id',
  validate(idParamsSchema, 'params'),
  validate(updateCategoryInputSchema),
  asyncHandler(controller.updateCategoryHandler),
);
adminCategoriesRouter.delete(
  '/:id',
  validate(idParamsSchema, 'params'),
  asyncHandler(controller.deleteCategoryHandler),
);
