import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { adminReviewListQuerySchema, updateReviewStatusInputSchema } from '@audio-commerce/shared';
import { validate } from '../../../middleware/validate.js';
import * as controller from './reviews.controller.js';

const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

const idParamsSchema = z.object({ id: z.string().uuid() }).strict();

export const adminReviewsRouter = Router();

adminReviewsRouter.get('/', validate(adminReviewListQuerySchema, 'query'), asyncHandler(controller.listReviewsHandler));
adminReviewsRouter.patch(
  '/:id/status',
  validate(idParamsSchema, 'params'),
  validate(updateReviewStatusInputSchema),
  asyncHandler(controller.updateReviewStatusHandler),
);
