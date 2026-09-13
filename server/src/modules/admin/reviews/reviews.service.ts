import type { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import type { AdminReviewListQuery, AdminReviewListResponse, AdminReviewSummaryDto } from '@audio-commerce/shared';
import { prisma } from '../../../lib/prisma.js';
import { ConflictError, NotFoundError } from '../../../errors/AppError.js';
import { recordAudit } from '../audit.js';

const summaryInclude = {
  product: { select: { slug: true, name: true } },
  user: { select: { name: true, email: true } },
};

type ReviewRow = {
  id: string;
  rating: number;
  body: string;
  status: string;
  createdAt: Date;
  product: { slug: string; name: string };
  user: { name: string; email: string };
};

function toSummary(review: ReviewRow): AdminReviewSummaryDto {
  return {
    id: review.id,
    rating: review.rating,
    body: review.body,
    status: review.status as AdminReviewSummaryDto['status'],
    createdAt: review.createdAt.toISOString(),
    product: review.product,
    reviewer: review.user,
  };
}

export async function listReviews(query: AdminReviewListQuery): Promise<AdminReviewListResponse> {
  const where = query.status ? { status: query.status } : {};
  const [total, rows] = await Promise.all([
    prisma.review.count({ where }),
    prisma.review.findMany({
      where,
      include: summaryInclude,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return {
    items: rows.map(toSummary),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
    },
  };
}

/** Recomputes a product's cached rating aggregate from its currently-APPROVED reviews. */
async function recomputeProductRating(tx: Prisma.TransactionClient, productId: string): Promise<void> {
  const agg = await tx.review.aggregate({
    where: { productId, status: 'APPROVED' },
    _avg: { rating: true },
    _count: true,
  });
  const ratingAvg = agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : 0;
  await tx.product.update({
    where: { id: productId },
    data: { ratingAvg: new Decimal(ratingAvg), reviewCount: agg._count },
  });
}

export async function updateReviewStatus(
  actorId: string,
  id: string,
  nextStatus: 'APPROVED' | 'REJECTED',
): Promise<AdminReviewSummaryDto> {
  const review = await prisma.review.findUnique({ where: { id }, include: summaryInclude });
  if (!review) throw new NotFoundError('Review not found');
  if (review.status !== 'PENDING') {
    throw new ConflictError(`Cannot move a review from ${review.status} to ${nextStatus}`);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.review.update({
      where: { id },
      data: { status: nextStatus },
      include: summaryInclude,
    });
    if (nextStatus === 'APPROVED') {
      await recomputeProductRating(tx, review.productId);
    }
    await recordAudit(
      actorId,
      nextStatus === 'APPROVED' ? 'review.approve' : 'review.reject',
      'Review',
      id,
      { from: review.status, to: nextStatus },
      tx,
    );
    return result;
  });

  return toSummary(updated);
}
