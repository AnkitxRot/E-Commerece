import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { createTestProduct, registerAdmin, registerCustomer, resetDb } from './setup.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('customer reviews', () => {
  it('requires authentication', async () => {
    const product = await createTestProduct('ACTIVE');
    const res = await request(app)
      .post(`/api/products/${product.slug}/reviews`)
      .send({ rating: 5, body: 'Great product.' });
    expect(res.status).toBe(401);
  });

  it('creates a pending review for an authenticated user', async () => {
    const token = await registerCustomer('review1@example.com');
    const product = await createTestProduct('ACTIVE');
    const res = await request(app)
      .post(`/api/products/${product.slug}/reviews`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 4, body: 'Sounds great, good bass.' });
    expect(res.status).toBe(201);
    expect(res.body.review.status).toBe('PENDING');
    expect(res.body.review.rating).toBe(4);
  });

  it('rejects an invalid rating', async () => {
    const token = await registerCustomer('review2@example.com');
    const product = await createTestProduct('ACTIVE');
    const res = await request(app)
      .post(`/api/products/${product.slug}/reviews`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 6, body: 'Great product.' });
    expect(res.status).toBe(400);
  });

  it('rejects an empty body', async () => {
    const token = await registerCustomer('review3@example.com');
    const product = await createTestProduct('ACTIVE');
    const res = await request(app)
      .post(`/api/products/${product.slug}/reviews`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 5, body: '' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for a nonexistent product', async () => {
    const token = await registerCustomer('review4@example.com');
    const res = await request(app)
      .post('/api/products/does-not-exist/reviews')
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 5, body: 'Great product.' });
    expect(res.status).toBe(404);
  });

  it('returns 404 for an inactive (draft) product', async () => {
    const token = await registerCustomer('review5@example.com');
    const product = await createTestProduct('DRAFT');
    const res = await request(app)
      .post(`/api/products/${product.slug}/reviews`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 5, body: 'Great product.' });
    expect(res.status).toBe(404);
  });

  it('rejects a duplicate review from the same user', async () => {
    const token = await registerCustomer('review6@example.com');
    const product = await createTestProduct('ACTIVE');
    await request(app)
      .post(`/api/products/${product.slug}/reviews`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 5, body: 'Great product.' });
    const res = await request(app)
      .post(`/api/products/${product.slug}/reviews`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 3, body: 'Changed my mind.' });
    expect(res.status).toBe(409);
  });

  it('allows different users to review the same product', async () => {
    const tokenA = await registerCustomer('reviewa@example.com');
    const tokenB = await registerCustomer('reviewb@example.com');
    const product = await createTestProduct('ACTIVE');
    await request(app)
      .post(`/api/products/${product.slug}/reviews`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ rating: 5, body: 'Great product.' });
    const res = await request(app)
      .post(`/api/products/${product.slug}/reviews`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ rating: 2, body: 'Not for me.' });
    expect(res.status).toBe(201);
  });

  it('does not surface a pending review on the public product page', async () => {
    const token = await registerCustomer('review7@example.com');
    const product = await createTestProduct('ACTIVE');
    await request(app)
      .post(`/api/products/${product.slug}/reviews`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 5, body: 'Great product.' });

    const pdp = await request(app).get(`/api/catalog/products/${product.slug}`);
    expect(pdp.body.product.reviews).toHaveLength(0);
    expect(pdp.body.product.reviewCount).toBe(0);
  });
});

describe('admin review moderation', () => {
  async function submitReview(customerToken: string, productSlug: string, rating = 5, body = 'Great product.') {
    const res = await request(app)
      .post(`/api/products/${productSlug}/reviews`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ rating, body });
    return res.body.review.id as string;
  }

  it('rejects a non-admin caller', async () => {
    const token = await registerCustomer('mod-forbidden@example.com');
    const res = await request(app).get('/api/admin/reviews').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('rejects an unauthenticated caller', async () => {
    const res = await request(app).get('/api/admin/reviews');
    expect(res.status).toBe(401);
  });

  it('lists the moderation queue and filters by status', async () => {
    const adminToken = await registerAdmin('mod-admin1@example.com');
    const customerToken = await registerCustomer('mod-customer1@example.com');
    const product = await createTestProduct('ACTIVE');
    const reviewId = await submitReview(customerToken, product.slug);

    const listRes = await request(app).get('/api/admin/reviews').set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.items.map((r: { id: string }) => r.id)).toContain(reviewId);

    const filteredRes = await request(app)
      .get('/api/admin/reviews?status=PENDING')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(filteredRes.body.items.map((r: { id: string }) => r.id)).toContain(reviewId);

    const rejectedFilter = await request(app)
      .get('/api/admin/reviews?status=REJECTED')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(rejectedFilter.body.items.map((r: { id: string }) => r.id)).not.toContain(reviewId);
  });

  it('approves a review and recomputes the product rating aggregate', async () => {
    const adminToken = await registerAdmin('mod-admin2@example.com');
    const customerToken = await registerCustomer('mod-customer2@example.com');
    const product = await createTestProduct('ACTIVE');
    const reviewId = await submitReview(customerToken, product.slug, 4);

    const approveRes = await request(app)
      .patch(`/api/admin/reviews/${reviewId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'APPROVED' });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.review.status).toBe('APPROVED');

    const updated = await prisma.product.findUnique({ where: { id: product.id } });
    expect(Number(updated!.ratingAvg)).toBe(4);
    expect(updated!.reviewCount).toBe(1);

    const pdp = await request(app).get(`/api/catalog/products/${product.slug}`);
    expect(pdp.body.product.reviews).toHaveLength(1);
    expect(pdp.body.product.reviewCount).toBe(1);
    expect(pdp.body.product.rating).toBe(4);
  });

  it('rejects a review and leaves the product rating aggregate unchanged', async () => {
    const adminToken = await registerAdmin('mod-admin3@example.com');
    const customerToken = await registerCustomer('mod-customer3@example.com');
    const product = await createTestProduct('ACTIVE');
    const reviewId = await submitReview(customerToken, product.slug, 1);

    const rejectRes = await request(app)
      .patch(`/api/admin/reviews/${reviewId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'REJECTED' });
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.review.status).toBe('REJECTED');

    const updated = await prisma.product.findUnique({ where: { id: product.id } });
    expect(Number(updated!.ratingAvg)).toBe(0);
    expect(updated!.reviewCount).toBe(0);

    const pdp = await request(app).get(`/api/catalog/products/${product.slug}`);
    expect(pdp.body.product.reviews).toHaveLength(0);
  });

  it('rejects re-moderating an already-decided review', async () => {
    const adminToken = await registerAdmin('mod-admin4@example.com');
    const customerToken = await registerCustomer('mod-customer4@example.com');
    const product = await createTestProduct('ACTIVE');
    const reviewId = await submitReview(customerToken, product.slug);

    await request(app)
      .patch(`/api/admin/reviews/${reviewId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'APPROVED' });

    const res = await request(app)
      .patch(`/api/admin/reviews/${reviewId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'REJECTED' });
    expect(res.status).toBe(409);
  });

  it('returns 404 when moderating an unknown review id', async () => {
    const adminToken = await registerAdmin('mod-admin5@example.com');
    const res = await request(app)
      .patch('/api/admin/reviews/00000000-0000-0000-0000-000000000000/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'APPROVED' });
    expect(res.status).toBe(404);
  });

  it('averages multiple approved reviews correctly', async () => {
    const adminToken = await registerAdmin('mod-admin6@example.com');
    const tokenA = await registerCustomer('mod-avg-a@example.com');
    const tokenB = await registerCustomer('mod-avg-b@example.com');
    const product = await createTestProduct('ACTIVE');
    const reviewIdA = await submitReview(tokenA, product.slug, 5);
    const reviewIdB = await submitReview(tokenB, product.slug, 2);

    await request(app)
      .patch(`/api/admin/reviews/${reviewIdA}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'APPROVED' });
    await request(app)
      .patch(`/api/admin/reviews/${reviewIdB}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'APPROVED' });

    const updated = await prisma.product.findUnique({ where: { id: product.id } });
    expect(Number(updated!.ratingAvg)).toBe(3.5);
    expect(updated!.reviewCount).toBe(2);
  });
});
