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

async function registerAndLogin(email: string): Promise<string> {
  const res = await request(app).post('/api/auth/register').send({ email, password: 'password123', name: 'Coupon User' });
  return res.body.accessToken as string;
}

async function addToCart(token: string, qty: number, stockQty = 100): Promise<void> {
  const variant = await createTestVariant(stockQty);
  await request(app).post('/api/cart/items').set('Authorization', `Bearer ${token}`).send({ variantId: variant.id, qty });
}

function futureDate(): Date {
  return new Date(Date.now() + 86_400_000);
}

describe('POST /api/coupons/validate', () => {
  it('requires authentication', async () => {
    const res = await request(app).post('/api/coupons/validate').send({ code: 'ANY' });
    expect(res.status).toBe(401);
  });

  it('previews a percent discount against the current cart without mutating usage', async () => {
    const token = await registerAndLogin('coupon-preview1@example.com');
    await addToCart(token, 2); // 2 x 99.00 = 198.00
    const coupon = await prisma.coupon.create({
      data: { code: 'PREVIEW10', type: 'PERCENT', value: '10.00', expiresAt: futureDate() },
    });

    const res = await request(app)
      .post('/api/coupons/validate')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'preview10' });
    expect(res.status).toBe(200);
    expect(res.body.coupon).toMatchObject({ code: 'PREVIEW10', type: 'PERCENT', discountAmount: '19.80' });

    expect((await prisma.coupon.findUnique({ where: { id: coupon.id } }))?.timesUsed).toBe(0);
  });

  it('rejects a nonexistent code, an inactive coupon, an expired coupon, and an empty cart', async () => {
    const token = await registerAndLogin('coupon-preview2@example.com');

    const missing = await request(app)
      .post('/api/coupons/validate')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'NOPE' });
    expect(missing.status).toBe(404);

    await addToCart(token, 1);

    await prisma.coupon.create({ data: { code: 'INACTIVE', type: 'FIXED', value: '5.00', expiresAt: futureDate(), active: false } });
    const inactive = await request(app)
      .post('/api/coupons/validate')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'INACTIVE' });
    expect(inactive.status).toBe(404);

    await prisma.coupon.create({ data: { code: 'EXPIRED', type: 'FIXED', value: '5.00', expiresAt: new Date(Date.now() - 1000) } });
    const expired = await request(app)
      .post('/api/coupons/validate')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'EXPIRED' });
    expect(expired.status).toBe(400);

    const emptyCartToken = await registerAndLogin('coupon-preview3@example.com');
    await prisma.coupon.create({ data: { code: 'NOCART', type: 'FIXED', value: '5.00', expiresAt: futureDate() } });
    const emptyCart = await request(app)
      .post('/api/coupons/validate')
      .set('Authorization', `Bearer ${emptyCartToken}`)
      .send({ code: 'NOCART' });
    expect(emptyCart.status).toBe(400);
  });
});

describe('checkout with a coupon', () => {
  it('applies a fixed discount, records the coupon code, and increments timesUsed exactly once', async () => {
    const token = await registerAndLogin('coupon-checkout1@example.com');
    await addToCart(token, 1); // subtotal 99.00
    const coupon = await prisma.coupon.create({
      data: { code: 'FIXED20', type: 'FIXED', value: '20.00', expiresAt: futureDate() },
    });

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ shippingAddress: SHIPPING_ADDRESS, couponCode: 'fixed20' });
    expect(res.status).toBe(201);
    expect(res.body.order.couponCode).toBe('FIXED20');
    expect(res.body.order.discountTotal).toBe('20.00');
    expect(res.body.order.subtotal).toBe('99.00');
    expect(res.body.order.grandTotal).toBe(
      (Number(res.body.order.subtotal) + Number(res.body.order.shippingTotal) - 20).toFixed(2),
    );

    const updated = await prisma.coupon.findUnique({ where: { id: coupon.id } });
    expect(updated?.timesUsed).toBe(1);
  });

  it('clamps a fixed discount so it can never exceed the subtotal', async () => {
    const token = await registerAndLogin('coupon-checkout2@example.com');
    await addToCart(token, 1); // subtotal 99.00
    await prisma.coupon.create({ data: { code: 'HUGE', type: 'FIXED', value: '500.00', expiresAt: futureDate() } });

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ shippingAddress: SHIPPING_ADDRESS, couponCode: 'HUGE' });
    expect(res.status).toBe(201);
    expect(res.body.order.discountTotal).toBe('99.00');
    expect(Number(res.body.order.grandTotal)).toBeGreaterThanOrEqual(0);
  });

  it('rejects checkout with an unknown, expired, or exhausted coupon and creates no order', async () => {
    const token = await registerAndLogin('coupon-checkout3@example.com');

    await addToCart(token, 1);
    const unknown = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ shippingAddress: SHIPPING_ADDRESS, couponCode: 'GHOST' });
    expect(unknown.status).toBe(400);
    expect(await prisma.order.count()).toBe(0);

    await addToCart(token, 1);
    await prisma.coupon.create({ data: { code: 'STALE', type: 'FIXED', value: '5.00', expiresAt: new Date(Date.now() - 1000) } });
    const expired = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ shippingAddress: SHIPPING_ADDRESS, couponCode: 'STALE' });
    expect(expired.status).toBe(400);
    expect(await prisma.order.count()).toBe(0);

    await addToCart(token, 1);
    await prisma.coupon.create({
      data: { code: 'MAXED', type: 'FIXED', value: '5.00', expiresAt: futureDate(), usageLimit: 1, timesUsed: 1 },
    });
    const exhausted = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ shippingAddress: SHIPPING_ADDRESS, couponCode: 'MAXED' });
    expect(exhausted.status).toBe(409);
    expect(await prisma.order.count()).toBe(0);
  });

  it('never lets concurrent checkouts push a usage-limited coupon over its limit', async () => {
    await prisma.coupon.create({
      data: { code: 'LASTONE', type: 'FIXED', value: '5.00', expiresAt: futureDate(), usageLimit: 1 },
    });

    const tokenA = await registerAndLogin('coupon-race-a@example.com');
    const tokenB = await registerAndLogin('coupon-race-b@example.com');
    await addToCart(tokenA, 1, 100);
    await addToCart(tokenB, 1, 100);

    const [resA, resB] = await Promise.all([
      request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ shippingAddress: SHIPPING_ADDRESS, couponCode: 'LASTONE' }),
      request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ shippingAddress: SHIPPING_ADDRESS, couponCode: 'LASTONE' }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([201, 409]);

    const coupon = await prisma.coupon.findUnique({ where: { code: 'LASTONE' } });
    expect(coupon?.timesUsed).toBe(1);
    expect(await prisma.order.count()).toBe(1);
  });
});
