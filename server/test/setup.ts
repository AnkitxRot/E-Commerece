import { prisma } from '../src/lib/prisma.js';
import { env } from '../src/config/env.js';

/**
 * Deletes rows across nearly every table. Only ever safe against the
 * isolated test database — refuses to run otherwise so a misconfigured
 * environment can never wipe development data.
 */
export async function resetDb() {
  if (env.NODE_ENV !== 'test') {
    throw new Error('resetDb() may only run when NODE_ENV=test (isolated test database).');
  }
  // Deleted in FK-dependency order: children before parents.
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.review.deleteMany(),
    prisma.wishlistItem.deleteMany(),
    prisma.wishlist.deleteMany(),
    prisma.cartItem.deleteMany(),
    prisma.cart.deleteMany(),
    prisma.productImage.deleteMany(),
    prisma.productVariant.deleteMany(),
    prisma.product.deleteMany(),
    prisma.category.deleteMany(),
    prisma.brand.deleteMany(),
    prisma.address.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.user.deleteMany(),
    prisma.coupon.deleteMany(),
    prisma.contentBlock.deleteMany(),
  ]);
}

export async function createTestCategory() {
  return prisma.category.create({ data: { slug: `cat-${Date.now()}-${Math.random()}`, name: 'Test Category' } });
}

export async function createTestVariant(stockQty: number) {
  const category = await createTestCategory();
  const product = await prisma.product.create({
    data: {
      slug: `prod-${Date.now()}-${Math.random()}`,
      name: 'Test Headphones',
      description: 'test',
      categoryId: category.id,
      basePrice: '99.00',
      status: 'ACTIVE',
    },
  });
  return prisma.productVariant.create({
    data: {
      productId: product.id,
      sku: `sku-${Date.now()}-${Math.random()}`,
      attributes: { color: 'black' },
      stockQty,
    },
  });
}
