import { Router, type NextFunction, type Request, type Response } from 'express';
import { createReviewInputSchema, reviewSlugParamSchema } from '@audio-commerce/shared';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import * as controller from './reviews.controller.js';

const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

export const reviewsRouter = Router({ mergeParams: true });

reviewsRouter.post(
  '/',
  requireAuth,
  validate(reviewSlugParamSchema, 'params'),
  validate(createReviewInputSchema),
  asyncHandler(controller.createReviewHandler),
);
