import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { resetDb, createTestProduct } from './setup.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

async function registerAndLogin(email: string): Promise<string> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'password123', name: 'Wishlist User' });
  return res.body.accessToken as string;
}

describe('wishlist', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/wishlist');
    expect(res.status).toBe(401);
  });

  it('starts empty for a new user', async () => {
    const token = await registerAndLogin('wish1@example.com');
    const res = await request(app).get('/api/wishlist').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [] });
  });

  it('adds a product to the wishlist', async () => {
    const token = await registerAndLogin('wish2@example.com');
    const product = await createTestProduct('ACTIVE');
    const res = await request(app)
      .post('/api/wishlist/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: product.slug });
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].product.slug).toBe(product.slug);
  });

  it('keeps duplicate adds idempotent', async () => {
    const token = await registerAndLogin('wish3@example.com');
    const product = await createTestProduct('ACTIVE');
    await request(app).post('/api/wishlist/items').set('Authorization', `Bearer ${token}`).send({ slug: product.slug });
    const res = await request(app)
      .post('/api/wishlist/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: product.slug });
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);

    const list = await request(app).get('/api/wishlist').set('Authorization', `Bearer ${token}`);
    expect(list.body.items).toHaveLength(1);
  });

  it('removes an item from the wishlist', async () => {
    const token = await registerAndLogin('wish4@example.com');
    const product = await createTestProduct('ACTIVE');
    await request(app).post('/api/wishlist/items').set('Authorization', `Bearer ${token}`).send({ slug: product.slug });

    const res = await request(app)
      .delete(`/api/wishlist/items/${product.slug}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0);
  });

  it('removing an item that was never added is still a no-op success', async () => {
    const token = await registerAndLogin('wish5@example.com');
    const product = await createTestProduct('ACTIVE');
    const res = await request(app)
      .delete(`/api/wishlist/items/${product.slug}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0);
  });

  it('rejects adding an unknown product slug', async () => {
    const token = await registerAndLogin('wish6@example.com');
    const res = await request(app)
      .post('/api/wishlist/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: 'does-not-exist' });
    expect(res.status).toBe(404);
  });

  it('rejects adding an inactive (draft) product', async () => {
    const token = await registerAndLogin('wish7@example.com');
    const product = await createTestProduct('DRAFT');
    const res = await request(app)
      .post('/api/wishlist/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: product.slug });
    expect(res.status).toBe(404);
  });

  it('rejects a malformed request body', async () => {
    const token = await registerAndLogin('wish8@example.com');
    const res = await request(app)
      .post('/api/wishlist/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: 'Not A Valid Slug!' });
    expect(res.status).toBe(400);
  });

  it('keeps wishlists isolated per user', async () => {
    const tokenA = await registerAndLogin('wisha@example.com');
    const tokenB = await registerAndLogin('wishb@example.com');
    const product = await createTestProduct('ACTIVE');
    await request(app).post('/api/wishlist/items').set('Authorization', `Bearer ${tokenA}`).send({ slug: product.slug });

    const bList = await request(app).get('/api/wishlist').set('Authorization', `Bearer ${tokenB}`);
    expect(bList.body.items).toHaveLength(0);

    const bRemove = await request(app)
      .delete(`/api/wishlist/items/${product.slug}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(bRemove.status).toBe(200);

    const aList = await request(app).get('/api/wishlist').set('Authorization', `Bearer ${tokenA}`);
    expect(aList.body.items).toHaveLength(1);
  });
});
