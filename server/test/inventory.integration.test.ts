import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { decrementStock } from '../src/modules/inventory/inventory.service.js';
import { ConflictError } from '../src/errors/AppError.js';
import { resetDb, createTestVariant } from './setup.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('decrementStock', () => {
  it('decrements stock when enough is available', async () => {
    const variant = await createTestVariant(10);
    await prisma.$transaction((tx) => decrementStock(variant.id, 3, tx));
    const updated = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(updated.stockQty).toBe(7);
  });

  it('throws ConflictError and does not go negative when stock is insufficient', async () => {
    const variant = await createTestVariant(2);
    await expect(prisma.$transaction((tx) => decrementStock(variant.id, 5, tx))).rejects.toThrow(ConflictError);
    const updated = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(updated.stockQty).toBe(2);
  });

  it('allows exactly one of two concurrent requests for the last unit to succeed', async () => {
    const variant = await createTestVariant(1);

    const attempt = () => prisma.$transaction((tx) => decrementStock(variant.id, 1, tx));
    const results = await Promise.allSettled([attempt(), attempt()]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);

    const updated = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(updated.stockQty).toBe(0);
  });

  it('rejects a negative stockQty at the database level even bypassing the service (check constraint)', async () => {
    const variant = await createTestVariant(5);
    // Deliberately bypasses decrementStock to prove the DB constraint itself
    // is the backstop, not just the application-layer guard above.
    await expect(
      prisma.productVariant.update({ where: { id: variant.id }, data: { stockQty: -1 } }),
    ).rejects.toThrow();
    const unchanged = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(unchanged.stockQty).toBe(5);
  });
});
