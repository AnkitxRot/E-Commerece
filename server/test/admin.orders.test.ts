import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { createTestVariant, registerAdmin, registerCustomer, resetDb } from './setup.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const SHIPPING_ADDRESS = {
  fullName: 'Test Customer',
  line1: '221B Baker Street',
  city: 'Mumbai',
  state: 'Maharashtra',
  postalCode: '400001',
  country: 'India',
  phone: '9876543210',
};

async function placeOrder(customerToken: string): Promise<string> {
  const variant = await createTestVariant(10);
  await request(app)
    .post('/api/cart/items')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({ variantId: variant.id, qty: 1 });
  const res = await request(app)
    .post('/api/orders')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({ shippingAddress: SHIPPING_ADDRESS });
  return res.body.order.id as string;
}

describe('admin orders', () => {
  it('rejects a non-admin caller', async () => {
    const token = await registerCustomer('order-forbidden@example.com');
    const res = await request(app).get('/api/admin/orders').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('lists orders, filters by status, and returns full detail', async () => {
    const adminToken = await registerAdmin('order-admin1@example.com');
    const customerToken = await registerCustomer('order-customer1@example.com');
    const orderId = await placeOrder(customerToken);

    const listRes = await request(app).get('/api/admin/orders').set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.items.map((o: { id: string }) => o.id)).toContain(orderId);

    const filteredRes = await request(app)
      .get('/api/admin/orders?status=CONFIRMED')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(filteredRes.body.items.map((o: { id: string }) => o.id)).toContain(orderId);

    const detailRes = await request(app)
      .get(`/api/admin/orders/${orderId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.order.customer.email).toBe('order-customer1@example.com');
    expect(detailRes.body.order.items).toHaveLength(1);
  });

  it('walks an order through valid status transitions and rejects an invalid jump', async () => {
    const adminToken = await registerAdmin('order-admin2@example.com');
    const customerToken = await registerCustomer('order-customer2@example.com');
    const orderId = await placeOrder(customerToken);

    const invalidJump = await request(app)
      .patch(`/api/admin/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'DELIVERED' });
    expect(invalidJump.status).toBe(409);

    for (const status of ['PROCESSING', 'SHIPPED', 'DELIVERED']) {
      const res = await request(app)
        .patch(`/api/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status });
      expect(res.status).toBe(200);
      expect(res.body.order.status).toBe(status);
    }

    const auditRows = await prisma.auditLog.findMany({ where: { entityId: orderId, action: 'order.status.update' } });
    expect(auditRows).toHaveLength(3);
  });
});
