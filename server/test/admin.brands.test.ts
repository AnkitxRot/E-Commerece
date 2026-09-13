import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { createTestCategory, registerAdmin, registerCustomer, resetDb } from './setup.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

function brandPayload(overrides: Record<string, unknown> = {}) {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return { slug: `brand-${unique}`, name: 'Aurelia', ...overrides };
}

describe('admin brands', () => {
  it('rejects unauthenticated and non-admin callers', async () => {
    const res401 = await request(app).get('/api/admin/brands');
    expect(res401.status).toBe(401);

    const customerToken = await registerCustomer('brand-customer@example.com');
    const res403 = await request(app)
      .post('/api/admin/brands')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(brandPayload());
    expect(res403.status).toBe(403);
  });

  it('creates, lists, and updates a brand', async () => {
    const token = await registerAdmin('brand-admin1@example.com');

    const createRes = await request(app)
      .post('/api/admin/brands')
      .set('Authorization', `Bearer ${token}`)
      .send(brandPayload({ logoUrl: 'https://example.com/logo.png' }));
    expect(createRes.status).toBe(201);
    const brandId = createRes.body.brand.id;
    expect(createRes.body.brand.isActive).toBe(true);
    expect(createRes.body.brand.logoUrl).toBe('https://example.com/logo.png');

    const listRes = await request(app).get('/api/admin/brands').set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.brands.map((b: { id: string }) => b.id)).toContain(brandId);

    const updateRes = await request(app)
      .patch(`/api/admin/brands/${brandId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Aurelia Audio' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.brand.name).toBe('Aurelia Audio');

    const auditRows = await prisma.auditLog.findMany({ where: { entityId: brandId } });
    expect(auditRows.map((r) => r.action)).toEqual(expect.arrayContaining(['brand.create', 'brand.update']));
  });

  it('rejects invalid input, a non-https logo URL, and a duplicate slug', async () => {
    const token = await registerAdmin('brand-admin2@example.com');

    const invalidSlug = await request(app)
      .post('/api/admin/brands')
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: 'Not A Slug', name: 'X' });
    expect(invalidSlug.status).toBe(400);

    const invalidLogo = await request(app)
      .post('/api/admin/brands')
      .set('Authorization', `Bearer ${token}`)
      .send(brandPayload({ logoUrl: 'http://example.com/logo.png' }));
    expect(invalidLogo.status).toBe(400);

    const payload = brandPayload();
    const first = await request(app).post('/api/admin/brands').set('Authorization', `Bearer ${token}`).send(payload);
    expect(first.status).toBe(201);

    const duplicate = await request(app)
      .post('/api/admin/brands')
      .set('Authorization', `Bearer ${token}`)
      .send(brandPayload({ slug: payload.slug }));
    expect(duplicate.status).toBe(409);
  });

  it('returns 404 for updating an unknown brand', async () => {
    const token = await registerAdmin('brand-admin3@example.com');
    const res = await request(app)
      .patch('/api/admin/brands/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'X' });
    expect(res.status).toBe(404);
  });

  it('activates and deactivates a brand', async () => {
    const token = await registerAdmin('brand-admin4@example.com');
    const brand = await prisma.brand.create({ data: brandPayload() });

    const deactivate = await request(app)
      .patch(`/api/admin/brands/${brand.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false });
    expect(deactivate.status).toBe(200);
    expect(deactivate.body.brand.isActive).toBe(false);

    const reactivate = await request(app)
      .patch(`/api/admin/brands/${brand.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: true });
    expect(reactivate.status).toBe(200);
    expect(reactivate.body.brand.isActive).toBe(true);
  });

  it('blocks deleting a brand with products, and allows it once unreferenced', async () => {
    const token = await registerAdmin('brand-admin5@example.com');
    const category = await createTestCategory();
    const brand = await prisma.brand.create({ data: brandPayload() });
    await prisma.product.create({
      data: {
        slug: `p-${Date.now()}`,
        name: 'Test product',
        description: 'x',
        categoryId: category.id,
        brandId: brand.id,
        basePrice: '10.00',
      },
    });

    const blocked = await request(app).delete(`/api/admin/brands/${brand.id}`).set('Authorization', `Bearer ${token}`);
    expect(blocked.status).toBe(409);

    const empty = await prisma.brand.create({ data: brandPayload() });
    const deleted = await request(app).delete(`/api/admin/brands/${empty.id}`).set('Authorization', `Bearer ${token}`);
    expect(deleted.status).toBe(204);
    expect(await prisma.brand.findUnique({ where: { id: empty.id } })).toBeNull();
  });
});
