import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { ContentBlockType, homeResponseSchema } from '@audio-commerce/shared';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { resetDb } from './setup.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

async function upsertSettings(heroContent: object) {
  await prisma.storeSettings.upsert({
    where: { id: 'singleton' },
    update: {
      storeName: 'Aurelia Audio',
      contactEmail: 'hello@aureliaaudio.demo',
      heroContent,
    },
    create: {
      id: 'singleton',
      storeName: 'Aurelia Audio',
      contactEmail: 'hello@aureliaaudio.demo',
      heroContent,
    },
  });
}

async function seedHomeProducts() {
  const audio = await prisma.category.create({ data: { slug: 'audio', name: 'Audio' } });
  const brandA = await prisma.brand.create({ data: { slug: 'brand-a', name: 'Brand A' } });
  const alpha = await prisma.product.create({
    data: {
      slug: 'alpha',
      name: 'Alpha',
      description: 'alpha product',
      categoryId: audio.id,
      brandId: brandA.id,
      basePrice: '100.00',
      status: 'ACTIVE',
      featured: true,
      variants: { create: { sku: 'A1', attributes: { color: 'black' }, stockQty: 5, reservedQty: 0 } },
    },
  });
  const beta = await prisma.product.create({
    data: {
      slug: 'beta',
      name: 'Beta',
      description: 'beta product',
      categoryId: audio.id,
      brandId: brandA.id,
      basePrice: '200.00',
      status: 'ACTIVE',
      featured: false,
      variants: { create: { sku: 'B1', attributes: { color: 'silver' }, stockQty: 1, reservedQty: 0 } },
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
  return { audio, brandA, alpha, beta };
}

describe('GET /api/catalog/home', () => {
  it('returns typed BANNER, ANNOUNCEMENT, and FEATURED_COLLECTION blocks', async () => {
    await upsertSettings({});
    await seedHomeProducts();
    const banner = await prisma.contentBlock.create({
      data: {
        type: 'BANNER',
        position: 0,
        active: true,
        payload: {
          title: 'Listen closer',
          subtitle: 'Studio headphones',
          ctaLabel: 'Shop',
          ctaHref: '/products',
        },
      },
    });
    const announcement = await prisma.contentBlock.create({
      data: {
        type: 'ANNOUNCEMENT',
        position: 1,
        active: true,
        payload: { message: 'Free shipping this week', href: '/products' },
      },
    });
    const collection = await prisma.contentBlock.create({
      data: {
        type: 'FEATURED_COLLECTION',
        position: 2,
        active: true,
        payload: { title: 'Staff picks', productSlugs: ['alpha', 'beta'] },
      },
    });
    await prisma.contentBlock.create({
      data: {
        type: 'ANNOUNCEMENT',
        position: 3,
        active: false,
        payload: { message: 'Hidden inactive' },
      },
    });

    const res = await request(app).get('/api/catalog/home');
    expect(res.status).toBe(200);
    const body = homeResponseSchema.parse(res.body);
    expect(body.blocks.map((b) => b.type)).toEqual([
      ContentBlockType.BANNER,
      ContentBlockType.ANNOUNCEMENT,
      ContentBlockType.FEATURED_COLLECTION,
    ]);
    expect(body.blocks[0]).toMatchObject({
      id: banner.id,
      type: ContentBlockType.BANNER,
      position: 0,
      payload: {
        title: 'Listen closer',
        subtitle: 'Studio headphones',
        ctaLabel: 'Shop',
        ctaHref: '/products',
      },
    });
    expect(body.blocks[1]).toMatchObject({
      id: announcement.id,
      type: ContentBlockType.ANNOUNCEMENT,
      payload: { message: 'Free shipping this week', href: '/products' },
    });
    expect(body.blocks[2]).toMatchObject({
      id: collection.id,
      type: ContentBlockType.FEATURED_COLLECTION,
      payload: { title: 'Staff picks' },
    });
    expect(body.blocks[2].payload).not.toHaveProperty('productSlugs');
    if (body.blocks[2].type === ContentBlockType.FEATURED_COLLECTION) {
      expect(body.blocks[2].products.map((p) => p.slug)).toEqual(['alpha', 'beta']);
    }
    expect(body.blocks.some((b) => b.type === ContentBlockType.ANNOUNCEMENT && b.payload && 'message' in b.payload && b.payload.message === 'Hidden inactive')).toBe(
      false,
    );
  });

  it('preserves position order across multiple FEATURED_COLLECTION blocks resolved concurrently', async () => {
    // Each FEATURED_COLLECTION block runs its own product query; getHome resolves
    // them concurrently rather than one-by-one. This pins down that concurrent
    // resolution still returns blocks in stored position order, not resolution order.
    await upsertSettings({});
    await seedHomeProducts();
    const second = await prisma.contentBlock.create({
      data: { type: 'FEATURED_COLLECTION', position: 1, active: true, payload: { title: 'Second', productSlugs: ['beta'] } },
    });
    const first = await prisma.contentBlock.create({
      data: { type: 'FEATURED_COLLECTION', position: 0, active: true, payload: { title: 'First', productSlugs: ['alpha'] } },
    });
    const third = await prisma.contentBlock.create({
      data: {
        type: 'FEATURED_COLLECTION',
        position: 2,
        active: true,
        payload: { title: 'Third', productSlugs: ['alpha', 'beta'] },
      },
    });

    const res = await request(app).get('/api/catalog/home');
    expect(res.status).toBe(200);
    const body = homeResponseSchema.parse(res.body);
    expect(body.blocks.map((b) => b.id)).toEqual([first.id, second.id, third.id]);
    expect(body.blocks.every((b) => b.type === ContentBlockType.FEATURED_COLLECTION)).toBe(true);
  });

  it('omits a block with an invalid payload and keeps a valid sibling', async () => {
    await upsertSettings({});
    await seedHomeProducts();
    const invalid = await prisma.contentBlock.create({
      data: {
        type: 'BANNER',
        position: 0,
        active: true,
        payload: { nope: true },
      },
    });
    const valid = await prisma.contentBlock.create({
      data: {
        type: 'ANNOUNCEMENT',
        position: 1,
        active: true,
        payload: { message: 'Still here' },
      },
    });

    const res = await request(app).get('/api/catalog/home');
    expect(res.status).toBe(200);
    const body = homeResponseSchema.parse(res.body);
    expect(body.blocks.map((b) => b.id)).toEqual([valid.id]);
    expect(body.blocks.map((b) => b.id)).not.toContain(invalid.id);
  });

  it('drops DRAFT collection slugs and keeps stored ACTIVE order', async () => {
    await upsertSettings({});
    await seedHomeProducts();
    await prisma.contentBlock.create({
      data: {
        type: 'FEATURED_COLLECTION',
        position: 0,
        active: true,
        payload: { title: 'Mixed shelf', productSlugs: ['beta', 'gamma', 'alpha'] },
      },
    });

    const res = await request(app).get('/api/catalog/home');
    expect(res.status).toBe(200);
    const body = homeResponseSchema.parse(res.body);
    expect(body.blocks).toHaveLength(1);
    expect(body.blocks[0].type).toBe(ContentBlockType.FEATURED_COLLECTION);
    if (body.blocks[0].type === ContentBlockType.FEATURED_COLLECTION) {
      expect(body.blocks[0].payload).toEqual({ title: 'Mixed shelf' });
      expect(body.blocks[0].products.map((p) => p.slug)).toEqual(['beta', 'alpha']);
      expect(body.blocks[0].products.map((p) => p.slug)).not.toContain('gamma');
    }
  });

  it('omits a FEATURED_COLLECTION when no ACTIVE products remain', async () => {
    await upsertSettings({});
    await seedHomeProducts();
    await prisma.contentBlock.create({
      data: {
        type: 'FEATURED_COLLECTION',
        position: 0,
        active: true,
        payload: { title: 'Empty after drop', productSlugs: ['gamma', 'missing-slug'] },
      },
    });
    const sibling = await prisma.contentBlock.create({
      data: {
        type: 'ANNOUNCEMENT',
        position: 1,
        active: true,
        payload: { message: 'Sibling stays' },
      },
    });

    const res = await request(app).get('/api/catalog/home');
    expect(res.status).toBe(200);
    const body = homeResponseSchema.parse(res.body);
    expect(body.blocks.map((b) => b.id)).toEqual([sibling.id]);
  });

  it('omits DRAFT products from featured even when featured is true', async () => {
    await upsertSettings({});
    await seedHomeProducts();

    const res = await request(app).get('/api/catalog/home');
    expect(res.status).toBe(200);
    const body = homeResponseSchema.parse(res.body);
    expect(body.featured.map((p) => p.slug)).toEqual(['alpha']);
    expect(body.featured.some((p) => p.slug === 'gamma')).toBe(false);
  });

  it('caps featured at 8 ACTIVE products ordered createdAt DESC then id ASC', async () => {
    await upsertSettings({});
    const { audio, brandA, alpha } = await seedHomeProducts();
    await prisma.product.update({ where: { id: alpha.id }, data: { featured: false } });
    const sameCreatedAt = new Date('2026-03-01T00:00:00Z');
    const extras = [];
    for (let i = 0; i < 7; i += 1) {
      extras.push(
        await prisma.product.create({
          data: {
            slug: `feat-${i}`,
            name: `Feat ${i}`,
            description: 'featured extra',
            categoryId: audio.id,
            brandId: brandA.id,
            basePrice: '10.00',
            status: 'ACTIVE',
            featured: true,
            createdAt: new Date(Date.UTC(2026, 0, 10 + i)),
          },
        }),
      );
    }
    const tiedA = await prisma.product.create({
      data: {
        slug: 'tied-a',
        name: 'Tied A',
        description: 'tied featured',
        categoryId: audio.id,
        brandId: brandA.id,
        basePrice: '10.00',
        status: 'ACTIVE',
        featured: true,
        createdAt: sameCreatedAt,
      },
    });
    const tiedB = await prisma.product.create({
      data: {
        slug: 'tied-b',
        name: 'Tied B',
        description: 'tied featured',
        categoryId: audio.id,
        brandId: brandA.id,
        basePrice: '10.00',
        status: 'ACTIVE',
        featured: true,
        createdAt: sameCreatedAt,
      },
    });
    await prisma.product.update({ where: { id: tiedA.id }, data: { createdAt: sameCreatedAt } });
    await prisma.product.update({ where: { id: tiedB.id }, data: { createdAt: sameCreatedAt } });

    const res = await request(app).get('/api/catalog/home');
    expect(res.status).toBe(200);
    const body = homeResponseSchema.parse(res.body);
    expect(body.featured).toHaveLength(8);
    const tiedOrder = [tiedA, tiedB].sort((a, b) => a.id.localeCompare(b.id)).map((p) => p.slug);
    expect(body.featured.map((p) => p.slug)).toEqual([
      ...tiedOrder,
      ...extras
        .slice()
        .reverse()
        .slice(0, 6)
        .map((p) => p.slug),
    ]);
    expect(body.featured.some((p) => p.slug === 'feat-0')).toBe(false);
    expect(body.featured.some((p) => p.slug === 'gamma')).toBe(false);
  });

  it('returns hero null for empty heroContent and parses a valid hero', async () => {
    await seedHomeProducts();
    await upsertSettings({});
    const empty = await request(app).get('/api/catalog/home');
    expect(empty.status).toBe(200);
    expect(homeResponseSchema.parse(empty.body).hero).toBeNull();

    await upsertSettings({
      title: 'Aurelia Audio',
      subtitle: 'Reference headphones',
      ctaLabel: 'Browse',
      ctaHref: '/c/headphones',
    });
    const valid = await request(app).get('/api/catalog/home');
    expect(valid.status).toBe(200);
    expect(homeResponseSchema.parse(valid.body).hero).toEqual({
      title: 'Aurelia Audio',
      subtitle: 'Reference headphones',
      ctaLabel: 'Browse',
      ctaHref: '/c/headphones',
    });
  });
});
