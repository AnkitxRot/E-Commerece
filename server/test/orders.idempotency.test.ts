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

const OTHER_ADDRESS = { ...SHIPPING_ADDRESS, line1: '10 Downing Street' };

async function registerAndLogin(email: string): Promise<string> {
  const res = await request(app).post('/api/auth/register').send({ email, password: 'password123', name: 'Idempotency User' });
  return res.body.accessToken as string;
}

describe('checkout idempotency', () => {
  it('replays the same order for a retried request with the same key, without duplicating side effects', async () => {
    const token = await registerAndLogin('idem1@example.com');
    const variant = await createTestVariant(10);
    await request(app).post('/api/cart/items').set('Authorization', `Bearer ${token}`).send({ variantId: variant.id, qty: 2 });

    const first = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ shippingAddress: SHIPPING_ADDRESS, idempotencyKey: 'checkout-1' });
    expect(first.status).toBe(201);

    // The cart is now empty (real behavior after a real order), but a retry
    // with the same key must still return the SAME order rather than fail
    // because there's "nothing to check out" the second time.
    const retry = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ shippingAddress: SHIPPING_ADDRESS, idempotencyKey: 'checkout-1' });
    expect(retry.status).toBe(201);
    expect(retry.body.order.id).toBe(first.body.order.id);

    expect(await prisma.order.count()).toBe(1);
    const updatedVariant = await prisma.productVariant.findUnique({ where: { id: variant.id } });
    expect(updatedVariant?.stockQty).toBe(8); // decremented exactly once, not twice
  });

  it('rejects reusing a key for a materially different request', async () => {
    const token = await registerAndLogin('idem2@example.com');
    await createTestVariant(10).then((v) =>
      request(app).post('/api/cart/items').set('Authorization', `Bearer ${token}`).send({ variantId: v.id, qty: 1 }),
    );

    const first = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ shippingAddress: SHIPPING_ADDRESS, idempotencyKey: 'reused-key' });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ shippingAddress: OTHER_ADDRESS, idempotencyKey: 'reused-key' });
    expect(second.status).toBe(409);

    expect(await prisma.order.count()).toBe(1);
  });

  it('scopes idempotency keys per user — two users may reuse the same key independently', async () => {
    const tokenA = await registerAndLogin('idem3a@example.com');
    const tokenB = await registerAndLogin('idem3b@example.com');
    const variantA = await createTestVariant(10);
    const variantB = await createTestVariant(10);
    await request(app).post('/api/cart/items').set('Authorization', `Bearer ${tokenA}`).send({ variantId: variantA.id, qty: 1 });
    await request(app).post('/api/cart/items').set('Authorization', `Bearer ${tokenB}`).send({ variantId: variantB.id, qty: 1 });

    const resA = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ shippingAddress: SHIPPING_ADDRESS, idempotencyKey: 'shared-key' });
    const resB = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ shippingAddress: SHIPPING_ADDRESS, idempotencyKey: 'shared-key' });

    expect(resA.status).toBe(201);
    expect(resB.status).toBe(201);
    expect(resA.body.order.id).not.toBe(resB.body.order.id);
  });

  it('allows retrying after a failed attempt left no order behind', async () => {
    const token = await registerAndLogin('idem4@example.com');

    // First attempt has an empty cart — fails before any order row is written.
    const failed = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ shippingAddress: SHIPPING_ADDRESS, idempotencyKey: 'retry-after-failure' });
    expect(failed.status).toBe(400);

    const variant = await createTestVariant(10);
    await request(app).post('/api/cart/items').set('Authorization', `Bearer ${token}`).send({ variantId: variant.id, qty: 1 });

    const retried = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ shippingAddress: SHIPPING_ADDRESS, idempotencyKey: 'retry-after-failure' });
    expect(retried.status).toBe(201);
  });

  it('never creates two orders when the same idempotency key is submitted concurrently', async () => {
    const token = await registerAndLogin('idem5@example.com');
    const variant = await createTestVariant(10);
    await request(app).post('/api/cart/items').set('Authorization', `Bearer ${token}`).send({ variantId: variant.id, qty: 1 });

    const [resA, resB] = await Promise.all([
      request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({ shippingAddress: SHIPPING_ADDRESS, idempotencyKey: 'concurrent-key' }),
      request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({ shippingAddress: SHIPPING_ADDRESS, idempotencyKey: 'concurrent-key' }),
    ]);

    expect(resA.status).toBe(201);
    expect(resB.status).toBe(201);
    expect(resA.body.order.id).toBe(resB.body.order.id);

    expect(await prisma.order.count()).toBe(1);
    const updatedVariant = await prisma.productVariant.findUnique({ where: { id: variant.id } });
    expect(updatedVariant?.stockQty).toBe(9); // decremented exactly once, never twice
  });

  it('creates independent orders when no idempotency key is supplied', async () => {
    const token = await registerAndLogin('idem6@example.com');
    for (let i = 0; i < 2; i++) {
      const variant = await createTestVariant(10);
      await request(app).post('/api/cart/items').set('Authorization', `Bearer ${token}`).send({ variantId: variant.id, qty: 1 });
      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({ shippingAddress: SHIPPING_ADDRESS });
      expect(res.status).toBe(201);
    }
    expect(await prisma.order.count()).toBe(2);
  });
});
