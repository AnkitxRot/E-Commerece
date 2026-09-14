import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { createContentBlockInputSchema, updateContentBlockInputSchema } from '@audio-commerce/shared';
import { validate } from '../../../middleware/validate.js';
import * as controller from './content-blocks.controller.js';

const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

const idParamsSchema = z.object({ id: z.string().uuid() }).strict();

export const adminContentBlocksRouter = Router();

adminContentBlocksRouter.get('/', asyncHandler(controller.listContentBlocksHandler));
adminContentBlocksRouter.post(
  '/',
  validate(createContentBlockInputSchema),
  asyncHandler(controller.createContentBlockHandler),
);
adminContentBlocksRouter.patch(
  '/:id',
  validate(idParamsSchema, 'params'),
  validate(updateContentBlockInputSchema),
  asyncHandler(controller.updateContentBlockHandler),
);
adminContentBlocksRouter.delete(
  '/:id',
  validate(idParamsSchema, 'params'),
  asyncHandler(controller.deleteContentBlockHandler),
);
