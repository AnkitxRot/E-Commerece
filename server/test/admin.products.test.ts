import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { createTestCategory, registerAdmin, registerCustomer, resetDb } from './setup.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

function productPayload(categoryId: string, overrides: Record<string, unknown> = {}) {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    slug: `admin-product-${unique}`,
    name: 'Admin Test Headphones',
    description: 'A great pair of headphones.',
    categoryId,
    basePrice: '199.00',
    variants: [
      { sku: `ADM-${unique}`, attributes: { color: 'Black' }, stockQty: 10, lowStockThreshold: 5 },
    ],
    ...overrides,
  };
}

describe('admin products', () => {
  it('rejects unauthenticated and non-admin callers', async () => {
    const res401 = await request(app).get('/api/admin/products');
    expect(res401.status).toBe(401);

    const customerToken = await registerCustomer('prod-customer@example.com');
    const res403 = await request(app).get('/api/admin/products').set('Authorization', `Bearer ${customerToken}`);
    expect(res403.status).toBe(403);
  });

  it('creates a product with a variant, then lists, fetches, and updates it', async () => {
    const token = await registerAdmin('prod-admin1@example.com');
    const category = await createTestCategory();

    const createRes = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send(productPayload(category.id));
    expect(createRes.status).toBe(201);
    const productId = createRes.body.product.id;
    expect(createRes.body.product.status).toBe('DRAFT');
    expect(createRes.body.product.variants).toHaveLength(1);

    const listRes = await request(app).get('/api/admin/products').set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.items.map((p: { id: string }) => p.id)).toContain(productId);

    const getRes = await request(app).get(`/api/admin/products/${productId}`).set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.product.name).toBe('Admin Test Headphones');

    const updateRes = await request(app)
      .patch(`/api/admin/products/${productId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'ACTIVE', basePrice: '249.00' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.product.status).toBe('ACTIVE');
    expect(updateRes.body.product.basePrice).toBe('249.00');

    const auditRows = await prisma.auditLog.findMany({ where: { entityId: productId } });
    expect(auditRows.map((r) => r.action)).toEqual(expect.arrayContaining(['product.create', 'product.update']));
  });

  it('rejects a duplicate slug and an unknown category', async () => {
    const token = await registerAdmin('prod-admin2@example.com');
    const category = await createTestCategory();
    const payload = productPayload(category.id);

    const first = await request(app).post('/api/admin/products').set('Authorization', `Bearer ${token}`).send(payload);
    expect(first.status).toBe(201);

    const duplicate = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send(productPayload(category.id, { slug: payload.slug }));
    expect(duplicate.status).toBe(409);

    const badCategory = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send(productPayload('00000000-0000-0000-0000-000000000000'));
    expect(badCategory.status).toBe(400);
  });

  it('updates variant stock and flips the low-stock flag', async () => {
    const token = await registerAdmin('prod-admin3@example.com');
    const category = await createTestCategory();
    const createRes = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send(productPayload(category.id));
    const productId = createRes.body.product.id;
    const variantId = createRes.body.product.variants[0].id;
    expect(createRes.body.product.variants[0].stockQty).toBe(10);

    const listBefore = await request(app).get('/api/admin/products').set('Authorization', `Bearer ${token}`);
    expect(listBefore.body.items.find((p: { id: string }) => p.id === productId).lowStock).toBe(false);

    const updateVariantRes = await request(app)
      .patch(`/api/admin/products/${productId}/variants/${variantId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ stockQty: 2 });
    expect(updateVariantRes.status).toBe(200);
    expect(updateVariantRes.body.product.variants[0].stockQty).toBe(2);

    const listAfter = await request(app).get('/api/admin/products').set('Authorization', `Bearer ${token}`);
    expect(listAfter.body.items.find((p: { id: string }) => p.id === productId).lowStock).toBe(true);
  });

  it('exposes category and brand options for the product form', async () => {
    const token = await registerAdmin('prod-admin4@example.com');
    const category = await createTestCategory();

    const categoriesRes = await request(app).get('/api/admin/categories').set('Authorization', `Bearer ${token}`);
    expect(categoriesRes.status).toBe(200);
    expect(categoriesRes.body.categories.map((c: { id: string }) => c.id)).toContain(category.id);

    const brandsRes = await request(app).get('/api/admin/brands').set('Authorization', `Bearer ${token}`);
    expect(brandsRes.status).toBe(200);
    expect(Array.isArray(brandsRes.body.brands)).toBe(true);
  });
});
