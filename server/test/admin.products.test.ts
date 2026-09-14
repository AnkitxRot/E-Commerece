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
});

describe('admin product images', () => {
  async function createProduct(token: string, categoryId: string) {
    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send(productPayload(categoryId));
    return res.body.product.id as string;
  }

  it('rejects unauthenticated and non-admin callers', async () => {
    const token = await registerAdmin('img-admin1@example.com');
    const category = await createTestCategory();
    const productId = await createProduct(token, category.id);

    const res401 = await request(app).post(`/api/admin/products/${productId}/images`);
    expect(res401.status).toBe(401);

    const customerToken = await registerCustomer('img-customer@example.com');
    const res403 = await request(app)
      .post(`/api/admin/products/${productId}/images`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ url: 'https://example.com/a.jpg', altText: 'A speaker' });
    expect(res403.status).toBe(403);
  });

  it('adds images, auto-assigning position in append order when omitted', async () => {
    const token = await registerAdmin('img-admin2@example.com');
    const category = await createTestCategory();
    const productId = await createProduct(token, category.id);

    const first = await request(app)
      .post(`/api/admin/products/${productId}/images`)
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://example.com/a.jpg', altText: 'Front view' });
    expect(first.status).toBe(201);
    expect(first.body.product.images).toHaveLength(1);
    expect(first.body.product.images[0]).toMatchObject({ url: 'https://example.com/a.jpg', altText: 'Front view', position: 0 });

    const second = await request(app)
      .post(`/api/admin/products/${productId}/images`)
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://example.com/b.jpg', altText: 'Side view' });
    expect(second.status).toBe(201);
    expect(second.body.product.images).toHaveLength(2);
    expect(second.body.product.images[1]).toMatchObject({ url: 'https://example.com/b.jpg', position: 1 });

    const auditRows = await prisma.auditLog.findMany({ where: { action: 'product.image.create' } });
    expect(auditRows.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects a non-https url and missing alt text', async () => {
    const token = await registerAdmin('img-admin3@example.com');
    const category = await createTestCategory();
    const productId = await createProduct(token, category.id);

    const badUrl = await request(app)
      .post(`/api/admin/products/${productId}/images`)
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'http://example.com/a.jpg', altText: 'Front view' });
    expect(badUrl.status).toBe(400);

    const badAlt = await request(app)
      .post(`/api/admin/products/${productId}/images`)
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://example.com/a.jpg', altText: '' });
    expect(badAlt.status).toBe(400);
  });

  it('404s adding an image to an unknown product', async () => {
    const token = await registerAdmin('img-admin4@example.com');
    const res = await request(app)
      .post('/api/admin/products/00000000-0000-0000-0000-000000000000/images')
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://example.com/a.jpg', altText: 'Front view' });
    expect(res.status).toBe(404);
  });

  it('updates alt text and position, and treats an image from another product as not found', async () => {
    const token = await registerAdmin('img-admin5@example.com');
    const category = await createTestCategory();
    const productId = await createProduct(token, category.id);
    const otherProductId = await createProduct(token, category.id);

    const added = await request(app)
      .post(`/api/admin/products/${productId}/images`)
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://example.com/a.jpg', altText: 'Front view' });
    const imageId = added.body.product.images[0].id as string;

    const updateRes = await request(app)
      .patch(`/api/admin/products/${productId}/images/${imageId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ altText: 'Updated alt', position: 3 });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.product.images[0]).toMatchObject({ altText: 'Updated alt', position: 3 });

    const crossProduct = await request(app)
      .patch(`/api/admin/products/${otherProductId}/images/${imageId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ altText: 'Hijacked' });
    expect(crossProduct.status).toBe(404);

    const auditRows = await prisma.auditLog.findMany({ where: { action: 'product.image.update', entityId: imageId } });
    expect(auditRows).toHaveLength(1);
  });

  it('rejects an empty alt text on update, and tolerates an explicit position colliding with another image', async () => {
    const token = await registerAdmin('img-admin5b@example.com');
    const category = await createTestCategory();
    const productId = await createProduct(token, category.id);

    const first = await request(app)
      .post(`/api/admin/products/${productId}/images`)
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://example.com/a.jpg', altText: 'Front view' });
    const second = await request(app)
      .post(`/api/admin/products/${productId}/images`)
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://example.com/b.jpg', altText: 'Side view' });
    const firstId = first.body.product.images[0].id as string;
    const secondId = second.body.product.images[1].id as string;

    const badAlt = await request(app)
      .patch(`/api/admin/products/${productId}/images/${firstId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ altText: '' });
    expect(badAlt.status).toBe(400);

    // Position has no uniqueness constraint — it is display ordering only, with a
    // deterministic `id` tie-break (see detailInclude's orderBy). Colliding positions
    // are tolerated, not an error.
    const collide = await request(app)
      .patch(`/api/admin/products/${productId}/images/${secondId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ position: 0 });
    expect(collide.status).toBe(200);
    const positions = (collide.body.product.images as { id: string; position: number }[]).map((i) => i.position);
    expect(positions).toEqual([0, 0]);
  });

  it('deletes an image and 404s on a repeat delete, an unknown image, or a cross-product image id', async () => {
    const token = await registerAdmin('img-admin6@example.com');
    const category = await createTestCategory();
    const productId = await createProduct(token, category.id);
    const otherProductId = await createProduct(token, category.id);

    const added = await request(app)
      .post(`/api/admin/products/${productId}/images`)
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://example.com/a.jpg', altText: 'Front view' });
    const imageId = added.body.product.images[0].id as string;

    const crossProductDelete = await request(app)
      .delete(`/api/admin/products/${otherProductId}/images/${imageId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(crossProductDelete.status).toBe(404);

    const deleteRes = await request(app)
      .delete(`/api/admin/products/${productId}/images/${imageId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.product.images).toHaveLength(0);

    const repeatDelete = await request(app)
      .delete(`/api/admin/products/${productId}/images/${imageId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(repeatDelete.status).toBe(404);

    const auditRows = await prisma.auditLog.findMany({ where: { action: 'product.image.delete', entityId: imageId } });
    expect(auditRows).toHaveLength(1);
  });

  it('leaves a product purchasable with zero images (no minimum-image invariant)', async () => {
    const token = await registerAdmin('img-admin7@example.com');
    const category = await createTestCategory();
    const productId = await createProduct(token, category.id);

    const getRes = await request(app).get(`/api/admin/products/${productId}`).set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.product.images).toEqual([]);
  });

  it('never surfaces a raw 500 when two concurrent image adds race on the same product', async () => {
    const token = await registerAdmin('img-admin8@example.com');
    const category = await createTestCategory();
    const productId = await createProduct(token, category.id);

    const [a, b] = await Promise.all([
      request(app)
        .post(`/api/admin/products/${productId}/images`)
        .set('Authorization', `Bearer ${token}`)
        .send({ url: 'https://example.com/a.jpg', altText: 'A' }),
      request(app)
        .post(`/api/admin/products/${productId}/images`)
        .set('Authorization', `Bearer ${token}`)
        .send({ url: 'https://example.com/b.jpg', altText: 'B' }),
    ]);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    // No uniqueness invariant on position, so a race can legitimately assign both
    // images the same auto-computed position (see the comment in addImage) — that's
    // an accepted, harmless outcome, not a bug this test needs to rule out. What
    // matters here is that neither request ever surfaces a raw 500/crash.
    const rowsForProduct = await prisma.productImage.findMany({ where: { productId } });
    expect(rowsForProduct).toHaveLength(2);
    for (const row of rowsForProduct) {
      expect(row.position).toBeGreaterThanOrEqual(0);
    }

    const final = await request(app).get(`/api/admin/products/${productId}`).set('Authorization', `Bearer ${token}`);
    expect(final.body.product.images).toHaveLength(2);
  });
});
