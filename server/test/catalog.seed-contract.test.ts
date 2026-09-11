import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { ContentBlockType, heroContentSchema } from '@audio-commerce/shared';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { seedCatalog } from '../prisma/catalogSeed.js';
import { resetDb } from './setup.js';

beforeEach(async () => {
  await resetDb();
  await seedCatalog(prisma);
});
afterAll(() => prisma.$disconnect());

describe('catalog seed contract', () => {
  it('seeds required fixtures and hides non-ACTIVE products from the public API', async () => {
    expect(await prisma.product.count({ where: { status: 'ACTIVE' } })).toBeGreaterThanOrEqual(20);
    expect(await prisma.product.findUnique({ where: { slug: 'aurelia-lab-prototype' } })).toMatchObject({ status: 'DRAFT' });
    expect(await prisma.product.findUnique({ where: { slug: 'helix-classic-v1' } })).toMatchObject({ status: 'ARCHIVED' });
    const nova = await prisma.productVariant.findUnique({ where: { sku: 'NOV-BLK-00' } });
    expect(nova).toBeTruthy();
    expect((await request(app).get('/api/catalog/products/aurelia-lab-prototype')).status).toBe(404);
    expect((await request(app).get('/api/catalog/products?q=NOV-BLK')).body.items[0].slug).toBe('aurelia-nova');

    expect((await request(app).get('/api/catalog/products/helix-classic-v1')).status).toBe(404);
    expect((await request(app).get('/api/catalog/products/aurelia-nova')).status).toBe(200);
  });

  it('places required products in the specified categories with stock and price mix', async () => {
    const novaProduct = await prisma.product.findUnique({
      where: { slug: 'aurelia-nova' },
      include: { category: true, variants: true },
    });
    expect(novaProduct).toMatchObject({ status: 'ACTIVE', featured: true });
    expect(novaProduct?.category.slug).toBe('over-ear');
    expect(novaProduct?.variants.some((v) => v.sku === 'NOV-BLK-00' && v.stockQty > 0)).toBe(true);

    const ion = await prisma.product.findUnique({
      where: { slug: 'sable-ion' },
      include: { category: true, variants: true },
    });
    expect(ion).toMatchObject({ status: 'ACTIVE' });
    expect(ion?.category.slug).toBe('in-ear');
    expect(ion?.variants.some((v) => v.priceOverride != null)).toBe(true);

    const restock = await prisma.product.findUnique({
      where: { slug: 'northwind-restock' },
      include: { variants: true },
    });
    expect(restock).toMatchObject({ status: 'ACTIVE' });
    expect(restock?.variants.length).toBeGreaterThanOrEqual(1);
    expect(restock?.variants.every((v) => v.stockQty === 0)).toBe(true);

    const lineage = await prisma.product.findUnique({
      where: { slug: 'helix-lineage' },
      include: { variants: true },
    });
    expect(lineage).toMatchObject({ status: 'ACTIVE' });
    expect(lineage?.variants.some((v) => v.stockQty > 0)).toBe(true);
    expect(lineage?.variants.some((v) => v.stockQty === 0)).toBe(true);
  });

  it('upserts the category tree, brands, images, content blocks, and hero', async () => {
    const headphones = await prisma.category.findUnique({
      where: { slug: 'headphones' },
      include: { children: { select: { slug: true } } },
    });
    expect(headphones).toBeTruthy();
    expect(headphones?.children.map((c) => c.slug).sort()).toEqual(['in-ear', 'over-ear']);

    const homeAudio = await prisma.category.findUnique({
      where: { slug: 'home-audio' },
      include: { children: { select: { slug: true } } },
    });
    expect(homeAudio?.children.map((c) => c.slug).sort()).toEqual(['amplifiers', 'dacs']);

    const accessories = await prisma.category.findUnique({
      where: { slug: 'accessories' },
      include: { children: { select: { slug: true } } },
    });
    expect(accessories?.children.map((c) => c.slug)).toEqual(['cables']);

    const brandSlugs = (await prisma.brand.findMany({ select: { slug: true } })).map((b) => b.slug).sort();
    expect(brandSlugs).toEqual(['aurelia', 'helix', 'northwind', 'sable']);

    const featuredActive = await prisma.product.count({ where: { status: 'ACTIVE', featured: true } });
    expect(featuredActive).toBeGreaterThanOrEqual(4);

    const products = await prisma.product.findMany({ include: { variants: true, images: true } });
    for (const product of products) {
      if (product.status !== 'ACTIVE') continue;
      expect(product.variants.length, product.slug).toBeGreaterThanOrEqual(1);
      expect(product.images.length, product.slug).toBeGreaterThanOrEqual(2);
      expect(product.images.every((img) => img.altText.trim().length > 0), product.slug).toBe(true);
      expect(
        product.images.every((img) =>
          /^https:\/\/picsum\.photos\/seed\/[a-z0-9]+(?:-[a-z0-9]+)*-\d+\/800\/800$/.test(img.url),
        ),
        product.slug,
      ).toBe(true);
    }

    const blocks = await prisma.contentBlock.findMany({ orderBy: { position: 'asc' } });
    expect(blocks).toHaveLength(3);
    expect(blocks.every((b) => b.active)).toBe(true);
    expect(blocks.map((b) => b.type).sort()).toEqual(
      [ContentBlockType.ANNOUNCEMENT, ContentBlockType.BANNER, ContentBlockType.FEATURED_COLLECTION].sort(),
    );
    const collection = blocks.find((b) => b.type === 'FEATURED_COLLECTION');
    const payload = collection?.payload as { productSlugs?: string[] };
    expect(payload.productSlugs).toContain('aurelia-nova');

    const settings = await prisma.storeSettings.findUnique({ where: { id: 'singleton' } });
    expect(heroContentSchema.parse(settings?.heroContent).ctaHref).toBe('/c/headphones');
  });

  it('is idempotent on a second run', async () => {
    await prisma.product.update({
      where: { slug: 'aurelia-nova' },
      data: { name: 'stale-name', featured: false, status: 'DRAFT' },
    });
    await prisma.storeSettings.update({
      where: { id: 'singleton' },
      data: { heroContent: {} },
    });
    await seedCatalog(prisma);
    expect(await prisma.product.count({ where: { status: 'ACTIVE' } })).toBeGreaterThanOrEqual(20);
    expect(await prisma.contentBlock.count()).toBe(3);
    expect(await prisma.product.findUnique({ where: { slug: 'aurelia-nova' } })).toMatchObject({
      name: 'Aurelia Nova',
      featured: true,
      status: 'ACTIVE',
    });
    expect(await prisma.productVariant.findUnique({ where: { sku: 'NOV-BLK-00' } })).toBeTruthy();
    const novaImages = await prisma.productImage.findMany({
      where: { product: { slug: 'aurelia-nova' } },
    });
    expect(novaImages).toHaveLength(2);
    const settings = await prisma.storeSettings.findUnique({ where: { id: 'singleton' } });
    expect(heroContentSchema.parse(settings?.heroContent).ctaHref).toBe('/c/headphones');
  });
});
