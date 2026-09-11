import type { Prisma } from '@prisma/client';
import { ConflictError } from '../../errors/AppError.js';

export async function decrementStock(
  variantId: string,
  qty: number,
  tx: Prisma.TransactionClient,
): Promise<void> {
  const result = await tx.productVariant.updateMany({
    where: { id: variantId, stockQty: { gte: qty } },
    data: { stockQty: { decrement: qty } },
  });
  if (result.count === 0) {
    throw new ConflictError(`Insufficient stock for variant ${variantId}`);
  }
}
