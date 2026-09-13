import { z } from 'zod';
import { ReviewStatus } from '../enums.js';
import { paginationMetaSchema, paginationQuerySchema } from './admin.js';
import { slugSchema } from './catalog.js';

export const createReviewInputSchema = z
  .object({
    rating: z.number().int().min(1).max(5),
    body: z.string().trim().min(1).max(2000),
  })
  .strict();
export type CreateReviewInput = z.infer<typeof createReviewInputSchema>;

export const reviewSlugParamSchema = z.object({ slug: slugSchema }).strict();

export const adminReviewSummaryDtoSchema = z
  .object({
    id: z.string().uuid(),
    rating: z.number().int().min(1).max(5),
    body: z.string(),
    status: z.nativeEnum(ReviewStatus),
    createdAt: z.string(),
    product: z.object({ slug: slugSchema, name: z.string() }).strict(),
    reviewer: z.object({ name: z.string(), email: z.string().email() }).strict(),
  })
  .strict();
export type AdminReviewSummaryDto = z.infer<typeof adminReviewSummaryDtoSchema>;

export const adminReviewListQuerySchema = paginationQuerySchema
  .extend({ status: z.nativeEnum(ReviewStatus).optional() })
  .strict();
export type AdminReviewListQuery = z.infer<typeof adminReviewListQuerySchema>;

export const adminReviewListResponseSchema = z
  .object({ items: z.array(adminReviewSummaryDtoSchema), meta: paginationMetaSchema })
  .strict();
export type AdminReviewListResponse = z.infer<typeof adminReviewListResponseSchema>;

export const updateReviewStatusInputSchema = z
  .object({ status: z.enum([ReviewStatus.APPROVED, ReviewStatus.REJECTED]) })
  .strict();
export type UpdateReviewStatusInput = z.infer<typeof updateReviewStatusInputSchema>;

export const adminReviewResponseSchema = z.object({ review: adminReviewSummaryDtoSchema }).strict();
export type AdminReviewResponse = z.infer<typeof adminReviewResponseSchema>;

export const reviewResponseSchema = z.object({
  review: z.object({
    id: z.string().uuid(),
    rating: z.number().int().min(1).max(5),
    body: z.string(),
    status: z.nativeEnum(ReviewStatus),
    createdAt: z.string(),
  }).strict(),
}).strict();
export type ReviewResponse = z.infer<typeof reviewResponseSchema>;
