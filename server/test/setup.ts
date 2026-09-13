import request from 'supertest';
import { prisma } from '../src/lib/prisma.js';
import { env } from '../src/config/env.js';
import { app } from '../src/app.js';
import { assertIsolatedTestDatabase, readDevDatabaseUrl } from '../src/config/dbSafety.js';

/**
 * Deletes rows across nearly every table. Only ever safe against the
 * isolated test database — refuses to run otherwise so a misconfigured
 * environment can never wipe development data.
 */
export async function resetDb() {
  if (env.NODE_ENV !== 'test') {
    throw new Error('resetDb() may only run when NODE_ENV=test (isolated test database).');
  }
  assertIsolatedTestDatabase(env.DATABASE_URL, readDevDatabaseUrl());
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

function randomSlugSuffix(): string {
  return Math.random().toString(36).slice(2);
}

export async function createTestProduct(status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED' = 'ACTIVE') {
  const category = await createTestCategory();
  return prisma.product.create({
    data: {
      slug: `prod-${Date.now()}-${randomSlugSuffix()}`,
      name: 'Test Headphones',
      description: 'test',
      categoryId: category.id,
      basePrice: '99.00',
      status,
    },
  });
}

export async function createTestVariant(stockQty: number) {
  const product = await createTestProduct('ACTIVE');
  return prisma.productVariant.create({
    data: {
      productId: product.id,
      sku: `sku-${Date.now()}-${Math.random()}`,
      attributes: { color: 'black' },
      stockQty,
    },
  });
}

/** Registers a user, promotes it to ADMIN, then re-authenticates so the returned token's role claim is current. */
export async function registerAdmin(email: string, password = 'password123'): Promise<string> {
  await request(app).post('/api/auth/register').send({ email, password, name: 'Admin User' });
  await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });
  const loginRes = await request(app).post('/api/auth/login').send({ email, password });
  return loginRes.body.accessToken as string;
}

export async function registerCustomer(email: string, password = 'password123'): Promise<string> {
  const res = await request(app).post('/api/auth/register').send({ email, password, name: 'Customer User' });
  return res.body.accessToken as string;
}
