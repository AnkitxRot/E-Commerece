import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { resetDb } from './setup.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('GET /api/catalog/settings', () => {
  it('returns the singleton and sets public cache for anonymous requests', async () => {
    await prisma.storeSettings.upsert({
      where: { id: 'singleton' },
      update: { storeName: 'Aurelia Audio', contactEmail: 'hello@aureliaaudio.demo' },
      create: { id: 'singleton', storeName: 'Aurelia Audio', contactEmail: 'hello@aureliaaudio.demo' },
    });
    const res = await request(app).get('/api/catalog/settings');
    expect(res.status).toBe(200);
    expect(res.body.storeName).toBe('Aurelia Audio');
    expect(res.headers['cache-control']).toMatch(/public/);
    expect(res.headers['cache-control']).toMatch(/max-age=15/);
  });

  it('uses private cache when Authorization is present and no-store on 404', async () => {
    const authed = await request(app).get('/api/catalog/settings').set('Authorization', 'Bearer nope');
    expect(authed.headers['cache-control']).toMatch(/private/);
    expect(authed.headers['cache-control']).not.toMatch(/public/);

    await prisma.storeSettings.deleteMany();
    const missing = await request(app).get('/api/catalog/settings');
    expect(missing.status).toBe(404);
    expect(missing.headers['cache-control']).toMatch(/no-store/);
  });
});

describe('GET /api/catalog/categories', () => {
  it('returns a tree sorted by name then id and details by slug', async () => {
    const headphones = await prisma.category.create({ data: { slug: 'headphones', name: 'Headphones' } });
    await prisma.category.create({ data: { slug: 'over-ear', name: 'Over-ear', parentId: headphones.id } });
    await prisma.category.create({ data: { slug: 'accessories', name: 'Accessories' } });
    const tree = await request(app).get('/api/catalog/categories');
    expect(tree.status).toBe(200);
    expect(tree.body.categories.map((c: { slug: string }) => c.slug)).toEqual(['accessories', 'headphones']);
    expect(tree.body.categories[1].children[0].slug).toBe('over-ear');
    const detail = await request(app).get('/api/catalog/categories/headphones');
    expect(detail.status).toBe(200);
    expect(detail.body.children[0].slug).toBe('over-ear');
    const missing = await request(app).get('/api/catalog/categories/nope');
    expect(missing.status).toBe(404);
  });
});

describe('GET /api/catalog/brands', () => {
  it('returns only brands that have an ACTIVE product', async () => {
    const cat = await prisma.category.create({ data: { slug: 'c1', name: 'C1' } });
    const live = await prisma.brand.create({ data: { slug: 'aurelia', name: 'Aurelia' } });
    await prisma.brand.create({ data: { slug: 'ghost', name: 'Ghost' } });
    await prisma.product.create({
      data: {
        slug: 'live-prod',
        name: 'Live',
        description: 'd',
        categoryId: cat.id,
        brandId: live.id,
        basePrice: '10.00',
        status: 'ACTIVE',
      },
    });
    const res = await request(app).get('/api/catalog/brands');
    expect(res.status).toBe(200);
    expect(res.body.brands.map((b: { slug: string }) => b.slug)).toEqual(['aurelia']);
  });
});
