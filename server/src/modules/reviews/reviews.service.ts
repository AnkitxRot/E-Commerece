import { Prisma } from '@prisma/client';
import type { CreateReviewInput, ReviewResponse } from '@audio-commerce/shared';
import { prisma } from '../../lib/prisma.js';
import { ConflictError, NotFoundError } from '../../errors/AppError.js';

async function findActiveProductBySlug(slug: string) {
  const product = await prisma.product.findFirst({ where: { slug, status: 'ACTIVE' }, select: { id: true } });
  if (!product) throw new NotFoundError('Product not found');
  return product;
}

export async function createReview(
  userId: string,
  slug: string,
  input: CreateReviewInput,
): Promise<ReviewResponse['review']> {
  const product = await findActiveProductBySlug(slug);

  const existing = await prisma.review.findUnique({
    where: { productId_userId: { productId: product.id, userId } },
    select: { id: true },
  });
  if (existing) throw new ConflictError('You have already reviewed this product');

  // The findUnique check above closes the common case; this catch closes the
  // race where two requests from the same user pass it concurrently — the DB
  // unique constraint is the actual source of truth, this just maps its
  // violation to the same 409 instead of leaking a raw Prisma error.
  let review;
  try {
    review = await prisma.review.create({
      data: { productId: product.id, userId, rating: input.rating, body: input.body },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('You have already reviewed this product');
    }
    throw err;
  }

  return {
    id: review.id,
    rating: review.rating,
    body: review.body,
    status: review.status as ReviewResponse['review']['status'],
    createdAt: review.createdAt.toISOString(),
  };
}
