import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { createTestVariant, resetDb } from './setup.js';

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

async function registerAndLogin(email: string, name = 'Checkout User'): Promise<string> {
  const res = await request(app).post('/api/auth/register').send({ email, password: 'password123', name });
  return res.body.accessToken as string;
}

async function addItemToCart(token: string): Promise<void> {
  const variant = await createTestVariant(10);
  await request(app).post('/api/cart/items').set('Authorization', `Bearer ${token}`).send({ variantId: variant.id, qty: 1 });
}

describe('checkout with a saved address', () => {
  it('checks out with a saved address, snapshotting the user name and address fields', async () => {
    const token = await registerAndLogin('checkoutaddr1@example.com', 'Priya Sharma');
    const addressRes = await request(app)
      .post('/api/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'Home', line1: '10 Downing Street', city: 'London', state: 'London', postalCode: 'SW1A', country: 'UK', phone: '5551234567' });
    await addItemToCart(token);

    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ addressId: addressRes.body.address.id });
    expect(orderRes.status).toBe(201);
    expect(orderRes.body.order.shippingAddress).toMatchObject({
      fullName: 'Priya Sharma',
      line1: '10 Downing Street',
      city: 'London',
      country: 'UK',
    });
  });

  it('rejects providing both shippingAddress and addressId, and rejects providing neither', async () => {
    const token = await registerAndLogin('checkoutaddr2@example.com');
    const addressRes = await request(app)
      .post('/api/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'Home', line1: 'X', city: 'X', state: 'X', postalCode: '400001', country: 'X', phone: '1234567890' });
    await addItemToCart(token);

    const both = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ shippingAddress: SHIPPING_ADDRESS, addressId: addressRes.body.address.id });
    expect(both.status).toBe(400);

    const neither = await request(app).post('/api/orders').set('Authorization', `Bearer ${token}`).send({});
    expect(neither.status).toBe(400);
  });

  it('rejects checkout with another customer\'s address id and creates no order', async () => {
    const tokenA = await registerAndLogin('checkoutaddr3a@example.com');
    const tokenB = await registerAndLogin('checkoutaddr3b@example.com');
    const addressA = await request(app)
      .post('/api/addresses')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ label: 'Home', line1: 'X', city: 'X', state: 'X', postalCode: '400001', country: 'X', phone: '1234567890' });
    await addItemToCart(tokenB);

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ addressId: addressA.body.address.id });
    expect(res.status).toBe(404);
    expect(await prisma.order.count()).toBe(0);
  });

  it('rejects checkout with a nonexistent or already-deleted address id', async () => {
    const token = await registerAndLogin('checkoutaddr4@example.com');
    const addressRes = await request(app)
      .post('/api/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'Home', line1: 'X', city: 'X', state: 'X', postalCode: '400001', country: 'X', phone: '1234567890' });
    await request(app).delete(`/api/addresses/${addressRes.body.address.id}`).set('Authorization', `Bearer ${token}`);
    await addItemToCart(token);

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ addressId: addressRes.body.address.id });
    expect(res.status).toBe(404);
    expect(await prisma.order.count()).toBe(0);
  });

  it('keeps a historical order unchanged after the saved address is later edited', async () => {
    const token = await registerAndLogin('checkoutaddr5@example.com', 'Priya Sharma');
    const addressRes = await request(app)
      .post('/api/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'Home', line1: 'Original Line 1', city: 'Mumbai', state: 'Maharashtra', postalCode: '400001', country: 'India', phone: '9876543210' });
    await addItemToCart(token);
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ addressId: addressRes.body.address.id });
    expect(orderRes.body.order.shippingAddress.line1).toBe('Original Line 1');

    await request(app)
      .patch(`/api/addresses/${addressRes.body.address.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ line1: 'Edited Line 1' });

    const reread = await request(app).get(`/api/orders/${orderRes.body.order.id}`).set('Authorization', `Bearer ${token}`);
    expect(reread.body.order.shippingAddress.line1).toBe('Original Line 1');
  });

  it('keeps a historical order unchanged after the saved address is later deleted', async () => {
    const token = await registerAndLogin('checkoutaddr6@example.com', 'Priya Sharma');
    const addressRes = await request(app)
      .post('/api/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'Home', line1: 'Doomed Line 1', city: 'Mumbai', state: 'Maharashtra', postalCode: '400001', country: 'India', phone: '9876543210' });
    await addItemToCart(token);
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ addressId: addressRes.body.address.id });

    await request(app).delete(`/api/addresses/${addressRes.body.address.id}`).set('Authorization', `Bearer ${token}`);

    const reread = await request(app).get(`/api/orders/${orderRes.body.order.id}`).set('Authorization', `Bearer ${token}`);
    expect(reread.status).toBe(200);
    expect(reread.body.order.shippingAddress.line1).toBe('Doomed Line 1');
  });

  it('still supports a manually typed shipping address, unchanged from before this feature', async () => {
    const token = await registerAndLogin('checkoutaddr7@example.com');
    await addItemToCart(token);
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ shippingAddress: SHIPPING_ADDRESS });
    expect(res.status).toBe(201);
    expect(res.body.order.shippingAddress).toEqual(SHIPPING_ADDRESS);
  });
});
