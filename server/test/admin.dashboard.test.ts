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

describe('admin dashboard', () => {
  it('reports product/order counts, recognized revenue, low stock, and recent orders', async () => {
    const adminToken = await registerAdmin('dash-admin@example.com');
    const customerToken = await registerCustomer('dash-customer@example.com');

    // One healthy-stock variant, one at/under its low-stock threshold.
    const healthyVariant = await createTestVariant(20);
    const lowVariant = await createTestVariant(2);
    await prisma.productVariant.update({ where: { id: lowVariant.id }, data: { lowStockThreshold: 5 } });

    await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ variantId: healthyVariant.id, qty: 1 });
    const order = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ shippingAddress: SHIPPING_ADDRESS });
    expect(order.status).toBe(201);

    const res = await request(app).get('/api/admin/overview').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.productCount).toBe(2);
    expect(res.body.activeProductCount).toBe(2);
    expect(res.body.orderCount).toBe(1);
    expect(res.body.revenueTotal).toBe(order.body.order.grandTotal);
    expect(res.body.lowStockCount).toBe(1);
    expect(res.body.recentOrders).toHaveLength(1);
    expect(res.body.recentOrders[0]).toMatchObject({
      id: order.body.order.id,
      customerEmail: 'dash-customer@example.com',
      itemCount: 1,
    });
  });

  it('rejects a non-admin caller', async () => {
    const token = await registerCustomer('dash-forbidden@example.com');
    const res = await request(app).get('/api/admin/overview').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
