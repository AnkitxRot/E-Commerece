import { describe, expect, it } from 'vitest';
import { ReviewStatus } from '../enums.js';
import { createReviewInputSchema, updateReviewStatusInputSchema } from './reviews.js';

describe('createReviewInputSchema', () => {
  it('accepts a valid review', () => {
    expect(createReviewInputSchema.safeParse({ rating: 5, body: 'Great sound quality.' }).success).toBe(true);
  });

  it('rejects a rating of 0', () => {
    expect(createReviewInputSchema.safeParse({ rating: 0, body: 'Fine.' }).success).toBe(false);
  });

  it('rejects a rating of 6', () => {
    expect(createReviewInputSchema.safeParse({ rating: 6, body: 'Fine.' }).success).toBe(false);
  });

  it('rejects a non-integer rating', () => {
    expect(createReviewInputSchema.safeParse({ rating: 3.5, body: 'Fine.' }).success).toBe(false);
  });

  it('rejects an empty body', () => {
    expect(createReviewInputSchema.safeParse({ rating: 4, body: '' }).success).toBe(false);
  });

  it('rejects a body over 2000 characters', () => {
    expect(createReviewInputSchema.safeParse({ rating: 4, body: 'a'.repeat(2001) }).success).toBe(false);
  });

  it('rejects a missing rating', () => {
    expect(createReviewInputSchema.safeParse({ body: 'Fine.' }).success).toBe(false);
  });

  it('rejects unknown extra fields', () => {
    expect(createReviewInputSchema.safeParse({ rating: 4, body: 'Fine.', userId: 'x' }).success).toBe(false);
  });
});

describe('updateReviewStatusInputSchema', () => {
  it('accepts APPROVED', () => {
    expect(updateReviewStatusInputSchema.safeParse({ status: ReviewStatus.APPROVED }).success).toBe(true);
  });

  it('accepts REJECTED', () => {
    expect(updateReviewStatusInputSchema.safeParse({ status: ReviewStatus.REJECTED }).success).toBe(true);
  });

  it('rejects PENDING as a target status', () => {
    expect(updateReviewStatusInputSchema.safeParse({ status: ReviewStatus.PENDING }).success).toBe(false);
  });

  it('rejects an unknown status', () => {
    expect(updateReviewStatusInputSchema.safeParse({ status: 'DELETED' }).success).toBe(false);
  });

  it('rejects a missing status', () => {
    expect(updateReviewStatusInputSchema.safeParse({}).success).toBe(false);
  });
});
