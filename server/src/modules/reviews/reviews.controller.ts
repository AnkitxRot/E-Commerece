import type { Request, Response } from 'express';
import type { CreateReviewInput } from '@audio-commerce/shared';
import * as reviewsService from './reviews.service.js';

export async function createReviewHandler(req: Request, res: Response) {
  const review = await reviewsService.createReview(req.user!.id, req.params.slug, req.body as CreateReviewInput);
  res.status(201).json({ review });
}
