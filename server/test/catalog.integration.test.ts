import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { productDetailResponseSchema, productListResponseSchema } from '@audio-commerce/shared';
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

async function seedProductListFixtures() {
  const audio = await prisma.category.create({ data: { slug: 'audio', name: 'Audio' } });
  const dacs = await prisma.category.create({ data: { slug: 'dacs', name: 'DACs', parentId: audio.id } });
  const brandA = await prisma.brand.create({ data: { slug: 'brand-a', name: 'Brand A' } });
  const brandB = await prisma.brand.create({ data: { slug: 'brand-b', name: 'Brand B' } });

  const alpha = await prisma.product.create({
    data: {
      slug: 'alpha',
      name: 'Alpha',
      description: 'alpha product',
      categoryId: audio.id,
      brandId: brandA.id,
      basePrice: '100.00',
      status: 'ACTIVE',
      featured: false,
      variants: { create: { sku: 'A1', attributes: { color: 'black' }, stockQty: 5, reservedQty: 0 } },
      images: {
        create: {
          url: 'https://picsum.photos/seed/alpha/800/800',
          altText: 'Alpha DAC',
          position: 0,
        },
      },
    },
  });
  await prisma.product.create({
    data: {
      slug: 'beta',
      name: 'Beta',
      description: 'beta product',
      categoryId: dacs.id,
      brandId: brandB.id,
      basePrice: '200.00',
      status: 'ACTIVE',
      featured: false,
      variants: {
        create: { sku: 'B1', attributes: { color: 'silver' }, stockQty: 1, reservedQty: 1, priceOverride: '150.00' },
      },
    },
  });
  await prisma.product.create({
    data: {
      slug: 'gamma',
      name: 'Gamma',
      description: 'gamma product',
      categoryId: audio.id,
      brandId: brandA.id,
      basePrice: '50.00',
      status: 'DRAFT',
      featured: true,
      variants: { create: { sku: 'G1', attributes: { color: 'black' }, stockQty: 9, reservedQty: 0 } },
    },
  });
  const delta = await prisma.product.create({
    data: {
      slug: 'delta',
      name: 'Delta',
      description: 'delta product',
      categoryId: audio.id,
      brandId: brandA.id,
      basePrice: '100.00',
      status: 'ACTIVE',
      featured: false,
    },
  });

  const sameCreatedAt = new Date('2026-01-01T00:00:00Z');
  await prisma.product.update({ where: { id: alpha.id }, data: { createdAt: sameCreatedAt } });
  await prisma.product.update({ where: { id: delta.id }, data: { createdAt: sameCreatedAt } });

  return { audio, dacs, brandA, brandB, alpha, delta };
}

describe('GET /api/catalog/products', () => {
  beforeEach(seedProductListFixtures);

  it('lists ACTIVE products only and does not require Authorization', async () => {
    const res = await request(app).get('/api/catalog/products');
    expect(res.status).toBe(200);
    const body = productListResponseSchema.parse(res.body);
    expect(body.items.map((i) => i.slug).sort()).toEqual(['alpha', 'beta', 'delta']);
    expect(body.items.some((i) => i.slug === 'gamma')).toBe(false);
    expect(body.items[0]).not.toHaveProperty('id');
    expect(body.meta).toMatchObject({ page: 1, pageSize: 24, total: 3, totalPages: 1 });

    const alpha = body.items.find((i) => i.slug === 'alpha');
    expect(alpha).toMatchObject({
      priceFrom: '100.00',
      priceTo: '100.00',
      inStock: true,
      featured: false,
      brand: { slug: 'brand-a', name: 'Brand A' },
      category: { slug: 'audio', name: 'Audio' },
      thumbnail: {
        url: 'https://picsum.photos/seed/alpha/800/800',
        altText: 'Alpha DAC',
        position: 0,
      },
    });
    const delta = body.items.find((i) => i.slug === 'delta');
    expect(delta).toMatchObject({ priceFrom: '100.00', priceTo: '100.00', inStock: false, thumbnail: null });
  });

  it('searches name, description, and SKU with escaped ILIKE and hides drafts', async () => {
    const bySku = await request(app).get('/api/catalog/products').query({ q: 'B1' });
    expect(bySku.status).toBe(200);
    expect(productListResponseSchema.parse(bySku.body).items.map((i) => i.slug)).toEqual(['beta']);

    const tooShort = await request(app).get('/api/catalog/products').query({ q: 'a' });
    expect(tooShort.status).toBe(400);

    const draft = await request(app).get('/api/catalog/products').query({ q: 'gamma' });
    expect(draft.status).toBe(200);
    expect(draft.body.items).toEqual([]);
  });

  it('filters by category self and descendants and 404s unknown slugs', async () => {
    const audio = await request(app).get('/api/catalog/products').query({ category: 'audio' });
    expect(audio.status).toBe(200);
    expect(productListResponseSchema.parse(audio.body).items.map((i) => i.slug).sort()).toEqual([
      'alpha',
      'beta',
      'delta',
    ]);

    const missing = await request(app).get('/api/catalog/products').query({ category: 'missing' });
    expect(missing.status).toBe(404);
  });

  it('filters by brand slug and 404s unknown brands', async () => {
    const brandB = await request(app).get('/api/catalog/products').query({ brand: 'brand-b' });
    expect(brandB.status).toBe(200);
    expect(productListResponseSchema.parse(brandB.body).items.map((i) => i.slug)).toEqual(['beta']);

    const missing = await request(app).get('/api/catalog/products').query({ brand: 'missing' });
    expect(missing.status).toBe(404);
  });

  it('filters by effective variant price and inStock availableQty', async () => {
    const priced = await request(app).get('/api/catalog/products').query({ minPrice: '140', maxPrice: '160' });
    expect(priced.status).toBe(200);
    const pricedBody = productListResponseSchema.parse(priced.body);
    expect(pricedBody.items.map((i) => i.slug)).toEqual(['beta']);
    expect(pricedBody.items[0]).toMatchObject({ priceFrom: '150.00', priceTo: '150.00', inStock: false });

    const inStock = await request(app).get('/api/catalog/products').query({ inStock: 'true' });
    expect(inStock.status).toBe(200);
    expect(inStock.body.items.map((i: { slug: string }) => i.slug).sort()).toEqual(['alpha']);
    expect(inStock.body.items.map((i: { slug: string }) => i.slug)).not.toContain('beta');

    const audio = await prisma.category.findUniqueOrThrow({ where: { slug: 'audio' } });
    const brandA = await prisma.brand.findUniqueOrThrow({ where: { slug: 'brand-a' } });
    await prisma.product.create({
      data: {
        slug: 'epsilon',
        name: 'Epsilon',
        description: 'edge stock',
        categoryId: audio.id,
        brandId: brandA.id,
        basePrice: '80.00',
        status: 'ACTIVE',
        variants: { create: { sku: 'E1', attributes: { color: 'black' }, stockQty: 5, reservedQty: 4 } },
      },
    });
    const withEdge = await request(app).get('/api/catalog/products').query({ inStock: 'true' });
    expect(withEdge.body.items.map((i: { slug: string }) => i.slug).sort()).toEqual(['alpha', 'epsilon']);
  });

  it('sorts by min effective price then id ASC', async () => {
    const res = await request(app).get('/api/catalog/products').query({ sort: 'price_asc' });
    expect(res.status).toBe(200);
    const slugs = productListResponseSchema.parse(res.body).items.map((i) => i.slug);
    expect(slugs[slugs.length - 1]).toBe('beta');
    const tied = await prisma.product.findMany({ where: { slug: { in: ['alpha', 'delta'] } } });
    const expectedTied = tied.sort((a, b) => a.id.localeCompare(b.id)).map((p) => p.slug);
    expect(slugs.slice(0, 2)).toEqual(expectedTied);
  });

  it('keeps newest page slices stable with id ASC when createdAt ties', async () => {
    const first = await request(app)
      .get('/api/catalog/products')
      .query({ category: 'audio', brand: 'brand-a', pageSize: '1', page: '1' });
    const second = await request(app)
      .get('/api/catalog/products')
      .query({ category: 'audio', brand: 'brand-a', pageSize: '1', page: '1' });
    expect(first.status).toBe(200);
    expect(first.body.items.map((i: { slug: string }) => i.slug)).toEqual(
      second.body.items.map((i: { slug: string }) => i.slug),
    );

    const page2 = await request(app)
      .get('/api/catalog/products')
      .query({ category: 'audio', brand: 'brand-a', pageSize: '1', page: '2' });
    const tied = await prisma.product.findMany({ where: { slug: { in: ['alpha', 'delta'] } } });
    const expected = tied.sort((a, b) => a.id.localeCompare(b.id)).map((p) => p.slug);
    expect([first.body.items[0].slug, page2.body.items[0].slug]).toEqual(expected);
  });

  it('returns an empty page with honest total when page is past the end', async () => {
    const res = await request(app).get('/api/catalog/products').query({ pageSize: '1', page: '9' });
    expect(res.status).toBe(200);
    const body = productListResponseSchema.parse(res.body);
    expect(body.items).toEqual([]);
    expect(body.meta.total).toBe(3);
    expect(body.meta.page).toBe(9);
    expect(body.meta.pageSize).toBe(1);
    expect(body.meta.totalPages).toBe(3);
  });

  it('rejects inStock=TRUE as validation error', async () => {
    const res = await request(app).get('/api/catalog/products').query({ inStock: 'TRUE' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/catalog/products/:slug', () => {
  beforeEach(seedProductListFixtures);

  it('returns ACTIVE variants with availableQty, inStock, and priceOverride', async () => {
    const audio = await prisma.category.findUniqueOrThrow({ where: { slug: 'audio' } });
    const brandA = await prisma.brand.findUniqueOrThrow({ where: { slug: 'brand-a' } });
    const product = await prisma.product.create({
      data: {
        slug: 'helix-lineage',
        name: 'Helix Lineage',
        description: 'mixed stock lineage',
        categoryId: audio.id,
        brandId: brandA.id,
        basePrice: '100.00',
        status: 'ACTIVE',
        featured: true,
        seoTitle: 'Helix Lineage SEO',
        seoDescription: 'Lineage meta',
      },
    });
    const later = new Date('2026-02-01T00:00:00Z');
    const earlier = new Date('2026-01-01T00:00:00Z');
    const ovr = await prisma.productVariant.create({
      data: {
        productId: product.id,
        sku: 'LIN-OVR',
        attributes: { color: 'red' },
        stockQty: 0,
        reservedQty: 0,
        createdAt: new Date('2026-03-01T00:00:00Z'),
      },
    });
    const slv = await prisma.productVariant.create({
      data: {
        productId: product.id,
        sku: 'LIN-SLV',
        attributes: { color: 'silver' },
        stockQty: 0,
        reservedQty: 0,
        priceOverride: '120.00',
        createdAt: later,
      },
    });
    const blk = await prisma.productVariant.create({
      data: {
        productId: product.id,
        sku: 'LIN-BLK',
        attributes: { color: 'black' },
        stockQty: 4,
        reservedQty: 1,
        createdAt: earlier,
      },
    });
    await prisma.productImage.create({
      data: {
        productId: product.id,
        url: 'https://picsum.photos/seed/lineage-1/800/800',
        altText: 'Lineage side',
        position: 1,
      },
    });
    await prisma.productImage.create({
      data: {
        productId: product.id,
        url: 'https://picsum.photos/seed/lineage-0/800/800',
        altText: 'Lineage front',
        position: 0,
      },
    });

    const res = await request(app).get('/api/catalog/products/helix-lineage');
    expect(res.status).toBe(200);
    const body = productDetailResponseSchema.parse(res.body);
    expect(body.product.id).toBeUndefined();
    expect(body.product).not.toHaveProperty('id');
    expect(body.product).toMatchObject({
      slug: 'helix-lineage',
      name: 'Helix Lineage',
      description: 'mixed stock lineage',
      seoTitle: 'Helix Lineage SEO',
      seoDescription: 'Lineage meta',
      featured: true,
      inStock: true,
      priceFrom: '100.00',
      priceTo: '120.00',
      brand: { slug: 'brand-a', name: 'Brand A', logoUrl: null },
      category: { slug: 'audio', name: 'Audio' },
    });
    expect(body.product.variants.map((v) => v.sku)).toEqual(['LIN-BLK', 'LIN-SLV', 'LIN-OVR']);
    expect(body.product.variants).toEqual([
      {
        id: blk.id,
        sku: 'LIN-BLK',
        attributes: { color: 'black' },
        price: '100.00',
        compareAtPrice: null,
        inStock: true,
        availableQty: 3,
      },
      {
        id: slv.id,
        sku: 'LIN-SLV',
        attributes: { color: 'silver' },
        price: '120.00',
        compareAtPrice: null,
        inStock: false,
        availableQty: 0,
      },
      {
        id: ovr.id,
        sku: 'LIN-OVR',
        attributes: { color: 'red' },
        price: '100.00',
        compareAtPrice: null,
        inStock: false,
        availableQty: 0,
      },
    ]);
    expect(body.product.images.map((img) => img.position)).toEqual([0, 1]);
    expect(body.product.images[0]).toMatchObject({
      url: 'https://picsum.photos/seed/lineage-0/800/800',
      altText: 'Lineage front',
      position: 0,
    });
  });

  it('returns 404 for DRAFT, ARCHIVED, and missing slugs', async () => {
    const draft = await request(app).get('/api/catalog/products/gamma');
    expect(draft.status).toBe(404);
    expect(draft.body.error.code).toBe('NOT_FOUND');

    const audio = await prisma.category.findUniqueOrThrow({ where: { slug: 'audio' } });
    await prisma.product.create({
      data: {
        slug: 'helix-classic-v1',
        name: 'Classic V1',
        description: 'archived classic',
        categoryId: audio.id,
        basePrice: '10.00',
        status: 'ARCHIVED',
      },
    });
    const archived = await request(app).get('/api/catalog/products/helix-classic-v1');
    expect(archived.status).toBe(404);
    expect(archived.body.error.code).toBe('NOT_FOUND');

    const missing = await request(app).get('/api/catalog/products/nope');
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');
  });

  it('ignores client-only ?variant= and still returns the ACTIVE product', async () => {
    const res = await request(app).get('/api/catalog/products/alpha').query({ variant: 'NOT-A-SKU' });
    expect(res.status).toBe(200);
    const body = productDetailResponseSchema.parse(res.body);
    expect(body.product.slug).toBe('alpha');
    expect(body.product.variants[0]).toMatchObject({
      sku: 'A1',
      price: '100.00',
      inStock: true,
      availableQty: 5,
    });
  });

  it('orders tied variants by id ASC and tied images by id ASC', async () => {
    const audio = await prisma.category.findUniqueOrThrow({ where: { slug: 'audio' } });
    const product = await prisma.product.create({
      data: {
        slug: 'tied-order',
        name: 'Tied Order',
        description: 'stable ties',
        categoryId: audio.id,
        basePrice: '10.00',
        status: 'ACTIVE',
      },
    });
    const createdAt = new Date('2026-01-01T00:00:00Z');
    const v1 = await prisma.productVariant.create({
      data: {
        productId: product.id,
        sku: 'TIE-A',
        attributes: { color: 'black' },
        stockQty: 1,
        reservedQty: 0,
        createdAt,
      },
    });
    const v2 = await prisma.productVariant.create({
      data: {
        productId: product.id,
        sku: 'TIE-B',
        attributes: { color: 'silver' },
        stockQty: 1,
        reservedQty: 0,
        createdAt,
      },
    });
    await prisma.productVariant.update({ where: { id: v1.id }, data: { createdAt } });
    await prisma.productVariant.update({ where: { id: v2.id }, data: { createdAt } });
    const img1 = await prisma.productImage.create({
      data: {
        productId: product.id,
        url: 'https://picsum.photos/seed/tie-a/800/800',
        altText: 'Tie A',
        position: 0,
      },
    });
    const img2 = await prisma.productImage.create({
      data: {
        productId: product.id,
        url: 'https://picsum.photos/seed/tie-b/800/800',
        altText: 'Tie B',
        position: 0,
      },
    });

    const res = await request(app).get('/api/catalog/products/tied-order');
    expect(res.status).toBe(200);
    const body = productDetailResponseSchema.parse(res.body);
    const expectedSkus = [v1, v2].sort((a, b) => a.id.localeCompare(b.id)).map((v) => v.sku);
    const expectedAlts = [img1, img2].sort((a, b) => a.id.localeCompare(b.id)).map((img) => img.altText);
    expect(body.product.variants.map((v) => v.sku)).toEqual(expectedSkus);
    expect(body.product.images.map((img) => img.altText)).toEqual(expectedAlts);
  });
});
