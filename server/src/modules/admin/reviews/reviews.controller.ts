import type { Request, Response } from 'express';
import type { AdminReviewListQuery, UpdateReviewStatusInput } from '@audio-commerce/shared';
import * as reviewsService from './reviews.service.js';

export async function listReviewsHandler(req: Request, res: Response) {
  const result = await reviewsService.listReviews(req.query as unknown as AdminReviewListQuery);
  res.status(200).json(result);
}

export async function updateReviewStatusHandler(req: Request, res: Response) {
  const { status } = req.body as UpdateReviewStatusInput;
  const review = await reviewsService.updateReviewStatus(req.user!.id, req.params.id, status);
  res.status(200).json({ review });
}
