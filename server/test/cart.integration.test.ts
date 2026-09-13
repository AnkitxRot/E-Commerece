import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { resetDb, createTestVariant } from './setup.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

async function registerAndLogin(email: string): Promise<string> {
  const res = await request(app).post('/api/auth/register').send({ email, password: 'password123', name: 'Cart User' });
  return res.body.accessToken as string;
}

describe('cart', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/cart');
    expect(res.status).toBe(401);
  });

  it('starts empty for a new user', async () => {
    const token = await registerAndLogin('cart1@example.com');
    const res = await request(app).get('/api/cart').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], itemCount: 0, subtotal: '0.00' });
  });

  it('adds an item and computes subtotal and lineTotal', async () => {
    const token = await registerAndLogin('cart2@example.com');
    const variant = await createTestVariant(10);
    const res = await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ variantId: variant.id, qty: 2 });
    expect(res.status).toBe(200);
    expect(res.body.itemCount).toBe(2);
    expect(res.body.subtotal).toBe('198.00');
    expect(res.body.items[0]).toMatchObject({ qty: 2, unitPrice: '99.00', lineTotal: '198.00', inStock: true });
  });

  it('increments quantity when the same variant is added twice', async () => {
    const token = await registerAndLogin('cart3@example.com');
    const variant = await createTestVariant(10);
    await request(app).post('/api/cart/items').set('Authorization', `Bearer ${token}`).send({ variantId: variant.id, qty: 2 });
    const res = await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ variantId: variant.id, qty: 3 });
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].qty).toBe(5);
  });

  it('rejects adding more than the available stock', async () => {
    const token = await registerAndLogin('cart4@example.com');
    const variant = await createTestVariant(2);
    const res = await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ variantId: variant.id, qty: 5 });
    expect(res.status).toBe(409);
  });

  it('rejects adding an out-of-stock variant', async () => {
    const token = await registerAndLogin('cart5@example.com');
    const variant = await createTestVariant(0);
    const res = await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ variantId: variant.id, qty: 1 });
    expect(res.status).toBe(409);
  });

  it('updates item quantity, capping at available stock', async () => {
    const token = await registerAndLogin('cart6@example.com');
    const variant = await createTestVariant(5);
    const added = await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ variantId: variant.id, qty: 1 });
    const itemId = added.body.items[0].id;

    const ok = await request(app)
      .patch(`/api/cart/items/${itemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ qty: 5 });
    expect(ok.status).toBe(200);
    expect(ok.body.items[0].qty).toBe(5);

    const overLimit = await request(app)
      .patch(`/api/cart/items/${itemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ qty: 6 });
    expect(overLimit.status).toBe(409);
  });

  it('removes an item from the cart', async () => {
    const token = await registerAndLogin('cart7@example.com');
    const variant = await createTestVariant(5);
    const added = await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ variantId: variant.id, qty: 1 });
    const itemId = added.body.items[0].id;

    const res = await request(app).delete(`/api/cart/items/${itemId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0);
  });

  it('clears the whole cart', async () => {
    const token = await registerAndLogin('cart8@example.com');
    const variant = await createTestVariant(5);
    await request(app).post('/api/cart/items').set('Authorization', `Bearer ${token}`).send({ variantId: variant.id, qty: 2 });
    const res = await request(app).delete('/api/cart').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0);
  });

  it('keeps carts isolated per user', async () => {
    const tokenA = await registerAndLogin('carta@example.com');
    const tokenB = await registerAndLogin('cartb@example.com');
    const variant = await createTestVariant(5);
    await request(app).post('/api/cart/items').set('Authorization', `Bearer ${tokenA}`).send({ variantId: variant.id, qty: 1 });
    const bCart = await request(app).get('/api/cart').set('Authorization', `Bearer ${tokenB}`);
    expect(bCart.body.items).toHaveLength(0);
  });
});
