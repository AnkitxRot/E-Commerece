import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { registerAdmin, registerCustomer, resetDb } from './setup.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('admin content blocks', () => {
  it('rejects unauthenticated and non-admin callers', async () => {
    const res401 = await request(app).get('/api/admin/content-blocks');
    expect(res401.status).toBe(401);

    const customerToken = await registerCustomer('cb-customer@example.com');
    const res403 = await request(app)
      .post('/api/admin/content-blocks')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ type: 'ANNOUNCEMENT', payload: { message: 'x' }, position: 0 });
    expect(res403.status).toBe(403);
  });

  it('creates each block type, lists them ordered by position, and audit-logs creation', async () => {
    const token = await registerAdmin('cb-admin1@example.com');

    const announcement = await request(app)
      .post('/api/admin/content-blocks')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'ANNOUNCEMENT', payload: { message: 'Free shipping over ₹999' }, position: 1 });
    expect(announcement.status).toBe(201);
    expect(announcement.body.block.active).toBe(true);

    const banner = await request(app)
      .post('/api/admin/content-blocks')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'BANNER', payload: { title: 'Summer Sale' }, position: 0 });
    expect(banner.status).toBe(201);

    const listRes = await request(app).get('/api/admin/content-blocks').set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.blocks.map((b: { type: string }) => b.type)).toEqual(['BANNER', 'ANNOUNCEMENT']);

    const auditRows = await prisma.auditLog.findMany({ where: { action: 'contentBlock.create' } });
    expect(auditRows).toHaveLength(2);
  });

  it('rejects a payload that does not match the declared type', async () => {
    const token = await registerAdmin('cb-admin2@example.com');

    const missingMessage = await request(app)
      .post('/api/admin/content-blocks')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'ANNOUNCEMENT', payload: { title: 'wrong shape' }, position: 0 });
    expect(missingMessage.status).toBe(400);

    const emptySlugs = await request(app)
      .post('/api/admin/content-blocks')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'FEATURED_COLLECTION', payload: { title: 'Featured', productSlugs: [] }, position: 0 });
    expect(emptySlugs.status).toBe(400);
  });

  it('updates position, active, and a type-matching payload; rejects a mismatched payload', async () => {
    const token = await registerAdmin('cb-admin3@example.com');
    const created = await request(app)
      .post('/api/admin/content-blocks')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'ANNOUNCEMENT', payload: { message: 'Original' }, position: 0 });
    const id = created.body.block.id;

    const updateRes = await request(app)
      .patch(`/api/admin/content-blocks/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ payload: { message: 'Updated' }, position: 2, active: false });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.block.payload.message).toBe('Updated');
    expect(updateRes.body.block.position).toBe(2);
    expect(updateRes.body.block.active).toBe(false);

    const mismatchedPayload = await request(app)
      .patch(`/api/admin/content-blocks/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ payload: { productSlugs: ['x'] } });
    expect(mismatchedPayload.status).toBe(400);

    const auditRows = await prisma.auditLog.findMany({ where: { action: 'contentBlock.update' } });
    expect(auditRows).toHaveLength(1);
  });

  it('returns 404 for updating or deleting an unknown block', async () => {
    const token = await registerAdmin('cb-admin4@example.com');
    const unknownId = '00000000-0000-0000-0000-000000000000';

    const updateRes = await request(app)
      .patch(`/api/admin/content-blocks/${unknownId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ active: false });
    expect(updateRes.status).toBe(404);

    const deleteRes = await request(app)
      .delete(`/api/admin/content-blocks/${unknownId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(404);
  });

  it('deletes a block and audit-logs it', async () => {
    const token = await registerAdmin('cb-admin5@example.com');
    const created = await request(app)
      .post('/api/admin/content-blocks')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'BANNER', payload: { title: 'Doomed' }, position: 0 });
    const id = created.body.block.id;

    const deleteRes = await request(app).delete(`/api/admin/content-blocks/${id}`).set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(204);
    expect(await prisma.contentBlock.findUnique({ where: { id } })).toBeNull();

    const auditRows = await prisma.auditLog.findMany({ where: { action: 'contentBlock.delete' } });
    expect(auditRows).toHaveLength(1);
  });
});
