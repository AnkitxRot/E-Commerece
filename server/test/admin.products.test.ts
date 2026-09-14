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

  it('rejects assigning an inactive category or brand, but tolerates one already in place', async () => {
    const token = await registerAdmin('prod-admin5@example.com');
    const category = await createTestCategory();
    const inactiveCategory = await prisma.category.create({
      data: { slug: `inactive-cat-${Date.now()}`, name: 'Retired', isActive: false },
    });
    const brand = await prisma.brand.create({ data: { slug: `brand-${Date.now()}`, name: 'Live Brand' } });
    const inactiveBrand = await prisma.brand.create({
      data: { slug: `inactive-brand-${Date.now()}`, name: 'Retired Brand', isActive: false },
    });

    const createWithInactiveCategory = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send(productPayload(inactiveCategory.id));
    expect(createWithInactiveCategory.status).toBe(400);

    const createWithInactiveBrand = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send(productPayload(category.id, { brandId: inactiveBrand.id }));
    expect(createWithInactiveBrand.status).toBe(400);

    const createRes = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send(productPayload(category.id, { brandId: brand.id }));
    expect(createRes.status).toBe(201);
    const productId = createRes.body.product.id;

    const reassignInactiveCategory = await request(app)
      .patch(`/api/admin/products/${productId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ categoryId: inactiveCategory.id });
    expect(reassignInactiveCategory.status).toBe(400);

    // Deactivate the category/brand this product already uses — an unrelated
    // field update must still succeed (no retroactive re-validation).
    await prisma.category.update({ where: { id: category.id }, data: { isActive: false } });
    await prisma.brand.update({ where: { id: brand.id }, data: { isActive: false } });
    const unrelatedUpdate = await request(app)
      .patch(`/api/admin/products/${productId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ featured: true });
    expect(unrelatedUpdate.status).toBe(200);
    expect(unrelatedUpdate.body.product.categoryId).toBe(category.id);
    expect(unrelatedUpdate.body.product.brandId).toBe(brand.id);
  });

  it('adds a new variant to an existing product', async () => {
    const token = await registerAdmin('prod-admin6@example.com');
    const category = await createTestCategory();
    const createRes = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send(productPayload(category.id));
    const productId = createRes.body.product.id;

    const res = await request(app)
      .post(`/api/admin/products/${productId}/variants`)
      .set('Authorization', `Bearer ${token}`)
      .send({ sku: `NEW-${Date.now()}`, attributes: { color: 'Silver' }, stockQty: 5, lowStockThreshold: 2 });
    expect(res.status).toBe(201);
    expect(res.body.product.variants).toHaveLength(2);

    const auditRows = await prisma.auditLog.findMany({ where: { action: 'product.variant.create' } });
    expect(auditRows).toHaveLength(1);
  });

  it('rejects adding a variant with a SKU already used elsewhere, or for an unknown product', async () => {
    const token = await registerAdmin('prod-admin7@example.com');
    const category = await createTestCategory();
    const first = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send(productPayload(category.id));
    const existingSku = first.body.product.variants[0].sku;

    const second = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send(productPayload(category.id));

    const clash = await request(app)
      .post(`/api/admin/products/${second.body.product.id}/variants`)
      .set('Authorization', `Bearer ${token}`)
      .send({ sku: existingSku, attributes: {}, stockQty: 1, lowStockThreshold: 1 });
    expect(clash.status).toBe(409);

    const unknownProduct = await request(app)
      .post('/api/admin/products/00000000-0000-0000-0000-000000000000/variants')
      .set('Authorization', `Bearer ${token}`)
      .send({ sku: `X-${Date.now()}`, attributes: {}, stockQty: 1, lowStockThreshold: 1 });
    expect(unknownProduct.status).toBe(404);
  });

  it('deletes a variant, cascading its removal from any cart, but blocks deleting the last one', async () => {
    const token = await registerAdmin('prod-admin8@example.com');
    const customerToken = await registerCustomer('prod-variant-cart@example.com');
    const category = await createTestCategory();
    const createRes = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send(productPayload(category.id));
    const productId = createRes.body.product.id;
    const firstVariantId = createRes.body.product.variants[0].id;

    const addSecond = await request(app)
      .post(`/api/admin/products/${productId}/variants`)
      .set('Authorization', `Bearer ${token}`)
      .send({ sku: `SECOND-${Date.now()}`, attributes: { color: 'Silver' }, stockQty: 5, lowStockThreshold: 2 });
    const secondVariantId = addSecond.body.product.variants[1].id;

    // Put the second variant in a customer's cart before deleting it.
    await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ variantId: secondVariantId, qty: 1 });

    const deleteRes = await request(app)
      .delete(`/api/admin/products/${productId}/variants/${secondVariantId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.product.variants).toHaveLength(1);
    expect(await prisma.productVariant.findUnique({ where: { id: secondVariantId } })).toBeNull();

    const cart = await request(app).get('/api/cart').set('Authorization', `Bearer ${customerToken}`);
    expect(cart.body.items).toHaveLength(0);

    const deleteLast = await request(app)
      .delete(`/api/admin/products/${productId}/variants/${firstVariantId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteLast.status).toBe(409);
    expect(await prisma.productVariant.findUnique({ where: { id: firstVariantId } })).not.toBeNull();
  });

  it('rejects customer and unauthenticated callers for variant create/delete', async () => {
    const token = await registerAdmin('prod-admin9@example.com');
    const customerToken = await registerCustomer('prod-variant-customer@example.com');
    const category = await createTestCategory();
    const createRes = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send(productPayload(category.id));
    const productId = createRes.body.product.id;
    const variantId = createRes.body.product.variants[0].id;

    const createNoAuth = await request(app).post(`/api/admin/products/${productId}/variants`).send({});
    expect(createNoAuth.status).toBe(401);
    const createCustomer = await request(app)
      .post(`/api/admin/products/${productId}/variants`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ sku: `X-${Date.now()}`, attributes: {}, stockQty: 1, lowStockThreshold: 1 });
    expect(createCustomer.status).toBe(403);

    const deleteCustomer = await request(app)
      .delete(`/api/admin/products/${productId}/variants/${variantId}`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(deleteCustomer.status).toBe(403);
  });
});
