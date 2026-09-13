import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { registerAdmin, registerCustomer, resetDb } from './setup.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

function categoryPayload(overrides: Record<string, unknown> = {}) {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return { slug: `cat-${unique}`, name: 'Headphones', ...overrides };
}

describe('admin categories', () => {
  it('rejects unauthenticated and non-admin callers', async () => {
    const res401 = await request(app).get('/api/admin/categories');
    expect(res401.status).toBe(401);

    const customerToken = await registerCustomer('cat-customer@example.com');
    const res403 = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(categoryPayload());
    expect(res403.status).toBe(403);
  });

  it('creates, lists, and updates a category', async () => {
    const token = await registerAdmin('cat-admin1@example.com');

    const createRes = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send(categoryPayload());
    expect(createRes.status).toBe(201);
    const categoryId = createRes.body.category.id;
    expect(createRes.body.category.isActive).toBe(true);
    expect(createRes.body.category.productCount).toBe(0);

    const listRes = await request(app).get('/api/admin/categories').set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.categories.map((c: { id: string }) => c.id)).toContain(categoryId);

    const updateRes = await request(app)
      .patch(`/api/admin/categories/${categoryId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Over-ear headphones' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.category.name).toBe('Over-ear headphones');

    const auditRows = await prisma.auditLog.findMany({ where: { entityId: categoryId } });
    expect(auditRows.map((r) => r.action)).toEqual(expect.arrayContaining(['category.create', 'category.update']));
  });

  it('rejects invalid input and a duplicate slug', async () => {
    const token = await registerAdmin('cat-admin2@example.com');

    const invalid = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: 'Not A Slug', name: 'X' });
    expect(invalid.status).toBe(400);

    const payload = categoryPayload();
    const first = await request(app).post('/api/admin/categories').set('Authorization', `Bearer ${token}`).send(payload);
    expect(first.status).toBe(201);

    const duplicate = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send(categoryPayload({ slug: payload.slug }));
    expect(duplicate.status).toBe(409);
  });

  it('returns 404 for updating an unknown category', async () => {
    const token = await registerAdmin('cat-admin3@example.com');
    const res = await request(app)
      .patch('/api/admin/categories/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'X' });
    expect(res.status).toBe(404);
  });

  it('rejects a parent that would create a cycle or does not exist', async () => {
    const token = await registerAdmin('cat-admin4@example.com');
    const root = await prisma.category.create({ data: categoryPayload({ name: 'Root' }) });
    const child = await prisma.category.create({ data: categoryPayload({ name: 'Child', parentId: root.id }) });

    const missingParent = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send(categoryPayload({ parentId: '00000000-0000-0000-0000-000000000000' }));
    expect(missingParent.status).toBe(400);

    const selfParent = await request(app)
      .patch(`/api/admin/categories/${root.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ parentId: root.id });
    expect(selfParent.status).toBe(400);

    const cyclic = await request(app)
      .patch(`/api/admin/categories/${root.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ parentId: child.id });
    expect(cyclic.status).toBe(400);
  });

  it('activates and deactivates a category', async () => {
    const token = await registerAdmin('cat-admin5@example.com');
    const category = await prisma.category.create({ data: categoryPayload() });

    const deactivate = await request(app)
      .patch(`/api/admin/categories/${category.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false });
    expect(deactivate.status).toBe(200);
    expect(deactivate.body.category.isActive).toBe(false);

    const reactivate = await request(app)
      .patch(`/api/admin/categories/${category.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: true });
    expect(reactivate.status).toBe(200);
    expect(reactivate.body.category.isActive).toBe(true);
  });

  it('blocks deleting a category with products or children, and allows it once unreferenced', async () => {
    const token = await registerAdmin('cat-admin6@example.com');
    const category = await prisma.category.create({ data: categoryPayload() });
    await prisma.product.create({
      data: {
        slug: `p-${Date.now()}`,
        name: 'Test product',
        description: 'x',
        categoryId: category.id,
        basePrice: '10.00',
      },
    });

    const blocked = await request(app)
      .delete(`/api/admin/categories/${category.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(blocked.status).toBe(409);

    const empty = await prisma.category.create({ data: categoryPayload() });
    const deleted = await request(app).delete(`/api/admin/categories/${empty.id}`).set('Authorization', `Bearer ${token}`);
    expect(deleted.status).toBe(204);
    expect(await prisma.category.findUnique({ where: { id: empty.id } })).toBeNull();

    const withChild = await prisma.category.create({ data: categoryPayload() });
    await prisma.category.create({ data: categoryPayload({ parentId: withChild.id }) });
    const blockedChild = await request(app)
      .delete(`/api/admin/categories/${withChild.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(blockedChild.status).toBe(409);
  });
});
