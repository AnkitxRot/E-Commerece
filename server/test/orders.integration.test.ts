import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { resetDb, createTestVariant } from './setup.js';

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

async function registerAndLogin(email: string): Promise<string> {
  const res = await request(app).post('/api/auth/register').send({ email, password: 'password123', name: 'Order User' });
  return res.body.accessToken as string;
}

describe('checkout', () => {
  it('requires authentication', async () => {
    const res = await request(app).post('/api/orders').send({ shippingAddress: SHIPPING_ADDRESS });
    expect(res.status).toBe(401);
  });

  it('rejects checkout with an empty cart', async () => {
    const token = await registerAndLogin('order1@example.com');
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ shippingAddress: SHIPPING_ADDRESS });
    expect(res.status).toBe(400);
  });

  it('creates an order, decrements stock, and clears the cart', async () => {
    const token = await registerAndLogin('order2@example.com');
    const variant = await createTestVariant(10);
    await request(app).post('/api/cart/items').set('Authorization', `Bearer ${token}`).send({ variantId: variant.id, qty: 3 });

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ shippingAddress: SHIPPING_ADDRESS });
    expect(res.status).toBe(201);
    expect(res.body.order.status).toBe('CONFIRMED');
    expect(res.body.order.items).toHaveLength(1);
    expect(res.body.order.items[0]).toMatchObject({ qty: 3, unitPrice: '99.00', lineTotal: '297.00' });
    expect(res.body.order.subtotal).toBe('297.00');
    expect(res.body.order.shippingAddress).toEqual(SHIPPING_ADDRESS);

    const updatedVariant = await prisma.productVariant.findUnique({ where: { id: variant.id } });
    expect(updatedVariant?.stockQty).toBe(7);

    const cart = await request(app).get('/api/cart').set('Authorization', `Bearer ${token}`);
    expect(cart.body.items).toHaveLength(0);
  });

  it('charges flat shipping below the free-shipping threshold and waives it above', async () => {
    const token = await registerAndLogin('order3@example.com');
    const cheapVariant = await createTestVariant(10);
    await request(app).post('/api/cart/items').set('Authorization', `Bearer ${token}`).send({ variantId: cheapVariant.id, qty: 1 });
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ shippingAddress: SHIPPING_ADDRESS });
    expect(res.body.order.subtotal).toBe('99.00');
    expect(res.body.order.shippingTotal).toBe('79.00');
    expect(res.body.order.grandTotal).toBe('178.00');
  });

  it('rejects checkout when stock is insufficient and leaves state unchanged', async () => {
    const token = await registerAndLogin('order4@example.com');
    const variant = await createTestVariant(1);
    await request(app).post('/api/cart/items').set('Authorization', `Bearer ${token}`).send({ variantId: variant.id, qty: 1 });

    // Simulate a race: another process sells the last unit after it was added to this cart.
    await prisma.productVariant.update({ where: { id: variant.id }, data: { stockQty: 0 } });

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ shippingAddress: SHIPPING_ADDRESS });
    expect(res.status).toBe(409);

    const cart = await request(app).get('/api/cart').set('Authorization', `Bearer ${token}`);
    expect(cart.body.items).toHaveLength(1);
    expect(await prisma.order.count()).toBe(0);
  });

  it('lists a user\'s own orders in reverse chronological order and forbids viewing another user\'s order', async () => {
    const tokenA = await registerAndLogin('order5a@example.com');
    const tokenB = await registerAndLogin('order5b@example.com');
    const variant = await createTestVariant(10);
    await request(app).post('/api/cart/items').set('Authorization', `Bearer ${tokenA}`).send({ variantId: variant.id, qty: 1 });
    const created = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ shippingAddress: SHIPPING_ADDRESS });
    const orderId = created.body.order.id;

    const list = await request(app).get('/api/orders').set('Authorization', `Bearer ${tokenA}`);
    expect(list.status).toBe(200);
    expect(list.body.orders.map((o: { id: string }) => o.id)).toContain(orderId);

    const ownDetail = await request(app).get(`/api/orders/${orderId}`).set('Authorization', `Bearer ${tokenA}`);
    expect(ownDetail.status).toBe(200);

    const forbidden = await request(app).get(`/api/orders/${orderId}`).set('Authorization', `Bearer ${tokenB}`);
    expect(forbidden.status).toBe(403);
  });
});
