import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { registerAdmin, registerCustomer, resetDb } from './setup.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

function couponPayload(overrides: Record<string, unknown> = {}) {
  const unique = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  return {
    code: `SAVE${unique}`,
    type: 'PERCENT',
    value: '10.00',
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    usageLimit: null,
    ...overrides,
  };
}

describe('admin coupons', () => {
  it('rejects unauthenticated and non-admin callers', async () => {
    const res401 = await request(app).get('/api/admin/coupons');
    expect(res401.status).toBe(401);

    const customerToken = await registerCustomer('coupon-customer@example.com');
    const res403 = await request(app)
      .post('/api/admin/coupons')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(couponPayload());
    expect(res403.status).toBe(403);
  });

  it('creates, lists, and updates a coupon, and normalizes the code to uppercase', async () => {
    const token = await registerAdmin('coupon-admin1@example.com');

    const createRes = await request(app)
      .post('/api/admin/coupons')
      .set('Authorization', `Bearer ${token}`)
      .send(couponPayload({ code: 'lowercase-code' }));
    expect(createRes.status).toBe(201);
    expect(createRes.body.coupon.code).toBe('LOWERCASE-CODE');
    expect(createRes.body.coupon.active).toBe(true);
    expect(createRes.body.coupon.timesUsed).toBe(0);
    const couponId = createRes.body.coupon.id;

    const listRes = await request(app).get('/api/admin/coupons').set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.coupons.map((c: { id: string }) => c.id)).toContain(couponId);

    const updateRes = await request(app)
      .patch(`/api/admin/coupons/${couponId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ value: '15.00', active: false });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.coupon.value).toBe('15.00');
    expect(updateRes.body.coupon.active).toBe(false);

    const auditRows = await prisma.auditLog.findMany({ where: { entityId: couponId } });
    expect(auditRows.map((r) => r.action)).toEqual(expect.arrayContaining(['coupon.create', 'coupon.update']));
  });

  it('rejects a duplicate code, an out-of-range percent value, and a zero fixed value', async () => {
    const token = await registerAdmin('coupon-admin2@example.com');

    const payload = couponPayload();
    const first = await request(app).post('/api/admin/coupons').set('Authorization', `Bearer ${token}`).send(payload);
    expect(first.status).toBe(201);

    const duplicate = await request(app)
      .post('/api/admin/coupons')
      .set('Authorization', `Bearer ${token}`)
      .send(couponPayload({ code: payload.code }));
    expect(duplicate.status).toBe(409);

    const badPercent = await request(app)
      .post('/api/admin/coupons')
      .set('Authorization', `Bearer ${token}`)
      .send(couponPayload({ type: 'PERCENT', value: '150.00' }));
    expect(badPercent.status).toBe(400);

    const zeroFixed = await request(app)
      .post('/api/admin/coupons')
      .set('Authorization', `Bearer ${token}`)
      .send(couponPayload({ type: 'FIXED', value: '0.00' }));
    expect(zeroFixed.status).toBe(400);
  });

  it('returns 404 for updating an unknown coupon', async () => {
    const token = await registerAdmin('coupon-admin3@example.com');
    const res = await request(app)
      .patch('/api/admin/coupons/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .send({ active: false });
    expect(res.status).toBe(404);
  });

  it('blocks deleting a coupon that has already been used, and allows it once unused', async () => {
    const token = await registerAdmin('coupon-admin4@example.com');
    const used = await prisma.coupon.create({
      data: { ...couponPayload({ code: 'USED-ONE' }), timesUsed: 1, value: '10.00', expiresAt: new Date() },
    });
    const unused = await prisma.coupon.create({ data: { ...couponPayload({ code: 'UNUSED-ONE' }), value: '10.00' } });

    const blocked = await request(app)
      .delete(`/api/admin/coupons/${used.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(blocked.status).toBe(409);

    const deleted = await request(app)
      .delete(`/api/admin/coupons/${unused.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleted.status).toBe(204);
    expect(await prisma.coupon.findUnique({ where: { id: unused.id } })).toBeNull();
  });
});
