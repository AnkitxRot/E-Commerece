import { Prisma, type ContentBlock } from '@prisma/client';
import {
  ContentBlockType,
  contentBlockPayloadSchemaByType,
  heroContentSchema,
  type BrandsResponse,
  type CatalogSort,
  type CategoriesResponse,
  type CategoryDetailDto,
  type CategoryTreeNode,
  type HomeBlockDto,
  type HomeCategoryTileDto,
  type HomeResponse,
  type ProductCardDto,
  type ProductDetailDto,
  type ProductListQuery,
  type ProductListResponse,
  type ReviewSummaryDto,
  type StoreSettingsDto,
} from '@audio-commerce/shared';
import { NotFoundError } from '../../errors/AppError.js';
import { prisma } from '../../lib/prisma.js';
import { resolveCategoryAndDescendantIds } from './categoryTree.js';
import { escapeIlike } from './ilike.js';
import { toCard, toDetail } from './mapProduct.js';

type Row = { id: string; slug: string; name: string; parentId: string | null };

function assembleTree(rows: Row[]) {
  const byParent = new Map<string | null, Row[]>();
  for (const row of rows) {
    const key = row.parentId;
    const list = byParent.get(key) ?? [];
    list.push(row);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const walk = (parentId: string | null): CategoryTreeNode[] =>
    (byParent.get(parentId) ?? []).map((row) => ({ slug: row.slug, name: row.name, children: walk(row.id) }));
  return walk(null);
}

export async function getSettings(): Promise<StoreSettingsDto> {
  const settings = await prisma.storeSettings.findUnique({ where: { id: 'singleton' } });
  if (!settings) throw new NotFoundError('Store settings not found');
  return {
    storeName: settings.storeName,
    logoUrl: settings.logoUrl,
    contactEmail: settings.contactEmail,
  };
}

export async function getCategoryTree(): Promise<CategoriesResponse> {
  const rows = await prisma.category.findMany({
    where: { isActive: true },
    select: { id: true, slug: true, name: true, parentId: true },
  });
  return { categories: assembleTree(rows) };
}

export async function getCategoryBySlug(slug: string): Promise<CategoryDetailDto> {
  const category = await prisma.category.findFirst({
    where: { slug, isActive: true },
    include: {
      parent: { select: { slug: true, name: true } },
      children: {
        where: { isActive: true },
        select: { slug: true, name: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      },
    },
  });
  if (!category) throw new NotFoundError('Category not found');
  return {
    slug: category.slug,
    name: category.name,
    parent: category.parent,
    children: category.children,
  };
}

export async function getBrands(): Promise<BrandsResponse> {
  const brands = await prisma.brand.findMany({
    where: { isActive: true, products: { some: { status: 'ACTIVE' } } },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    select: { slug: true, name: true, logoUrl: true },
  });
  return { brands };
}

export const productListInclude = {
  brand: true,
  category: true,
  variants: true,
  images: { orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }] },
};

async function mapHomeBlock(block: ContentBlock): Promise<HomeBlockDto | null> {
  if (block.type === ContentBlockType.BANNER) {
    const parsed = contentBlockPayloadSchemaByType[ContentBlockType.BANNER].safeParse(block.payload);
    if (!parsed.success) {
      console.warn(`Omitting content block ${block.id}: invalid BANNER payload`);
      return null;
    }
    return { id: block.id, type: ContentBlockType.BANNER, position: block.position, payload: parsed.data };
  }

  if (block.type === ContentBlockType.ANNOUNCEMENT) {
    const parsed = contentBlockPayloadSchemaByType[ContentBlockType.ANNOUNCEMENT].safeParse(block.payload);
    if (!parsed.success) {
      console.warn(`Omitting content block ${block.id}: invalid ANNOUNCEMENT payload`);
      return null;
    }
    return { id: block.id, type: ContentBlockType.ANNOUNCEMENT, position: block.position, payload: parsed.data };
  }

  const parsed = contentBlockPayloadSchemaByType[ContentBlockType.FEATURED_COLLECTION].safeParse(block.payload);
  if (!parsed.success) {
    console.warn(`Omitting content block ${block.id}: invalid FEATURED_COLLECTION payload`);
    return null;
  }

  const products = await prisma.product.findMany({
    where: { slug: { in: parsed.data.productSlugs }, status: 'ACTIVE' },
    include: productListInclude,
  });
  const bySlug = new Map(products.map((product) => [product.slug, product]));
  const ordered = parsed.data.productSlugs.flatMap((slug) => {
    const product = bySlug.get(slug);
    return product ? [toCard(product)] : [];
  });
  if (ordered.length === 0) return null;

  return {
    id: block.id,
    type: ContentBlockType.FEATURED_COLLECTION,
    position: block.position,
    payload: { title: parsed.data.title },
    products: ordered,
  };
}

export async function getHome(): Promise<HomeResponse> {
  const [settings, blocks, featured, bestSellers, newArrivals, topCategories] = await Promise.all([
    prisma.storeSettings.findUnique({ where: { id: 'singleton' } }),
    prisma.contentBlock.findMany({
      where: { active: true },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
    }),
    prisma.product.findMany({
      where: { status: 'ACTIVE', featured: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 8,
      include: productListInclude,
    }),
    prisma.product.findMany({
      where: { status: 'ACTIVE' },
      orderBy: [{ reviewCount: 'desc' }, { ratingAvg: 'desc' }, { id: 'asc' }],
      take: 8,
      include: productListInclude,
    }),
    prisma.product.findMany({
      where: { status: 'ACTIVE' },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 8,
      include: productListInclude,
    }),
    prisma.category.findMany({
      where: { parentId: null, isActive: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      include: {
        products: {
          where: { status: 'ACTIVE' },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          take: 1,
          include: { images: { orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }], take: 1 } },
        },
      },
    }),
  ]);

  const heroParsed = heroContentSchema.safeParse(settings?.heroContent);
  // Each FEATURED_COLLECTION block issues its own product query (BANNER/ANNOUNCEMENT
  // are pure payload parses) — resolve all blocks concurrently rather than one
  // sequential DB round-trip per block. Promise.all preserves `blocks`' order
  // (already sorted by position above), so this changes nothing but latency.
  const mappedBlocks = await Promise.all(blocks.map((block) => mapHomeBlock(block)));
  const mapped: HomeBlockDto[] = mappedBlocks.filter((dto): dto is HomeBlockDto => dto !== null);

  const categories: HomeCategoryTileDto[] = topCategories.map((category) => {
    const image = category.products[0]?.images[0];
    return {
      slug: category.slug,
      name: category.name,
      image: image ? { url: image.url, altText: image.altText, position: image.position } : null,
    };
  });

  return {
    hero: heroParsed.success ? heroParsed.data : null,
    blocks: mapped,
    featured: featured.map(toCard),
    bestSellers: bestSellers.map(toCard),
    newArrivals: newArrivals.map(toCard),
    categories,
  };
}

function sortPrimary(alias: 'matched' | 'paged', sort: CatalogSort): Prisma.Sql {
  const col = alias === 'matched' ? Prisma.sql`matched` : Prisma.sql`paged`;
  switch (sort) {
    case 'newest':
      return Prisma.sql`${col}."createdAt" DESC`;
    case 'name_asc':
      return Prisma.sql`${col}.name ASC`;
    case 'name_desc':
      return Prisma.sql`${col}.name DESC`;
    case 'price_asc':
      return Prisma.sql`${col}.min_price ASC`;
    case 'price_desc':
      return Prisma.sql`${col}.min_price DESC`;
  }
}

function priceFilter(minPrice?: number, maxPrice?: number): Prisma.Sql {
  const variantConds: Prisma.Sql[] = [];
  const baseConds: Prisma.Sql[] = [];
  if (minPrice !== undefined) {
    variantConds.push(Prisma.sql`COALESCE(pv."priceOverride", p."basePrice") >= ${minPrice}`);
    baseConds.push(Prisma.sql`p."basePrice" >= ${minPrice}`);
  }
  if (maxPrice !== undefined) {
    variantConds.push(Prisma.sql`COALESCE(pv."priceOverride", p."basePrice") <= ${maxPrice}`);
    baseConds.push(Prisma.sql`p."basePrice" <= ${maxPrice}`);
  }
  return Prisma.sql`(
    EXISTS (
      SELECT 1 FROM "ProductVariant" pv
      WHERE pv."productId" = p.id
        AND ${Prisma.join(variantConds, ' AND ')}
    )
    OR (
      NOT EXISTS (SELECT 1 FROM "ProductVariant" pv WHERE pv."productId" = p.id)
      AND ${Prisma.join(baseConds, ' AND ')}
    )
  )`;
}

export async function listProducts(query: ProductListQuery): Promise<ProductListResponse> {
  const filters: Prisma.Sql[] = [Prisma.sql`p.status = 'ACTIVE'`];

  if (query.category) {
    const categoryIds = await resolveCategoryAndDescendantIds(query.category);
    filters.push(Prisma.sql`p."categoryId" IN (${Prisma.join(categoryIds)})`);
  }

  if (query.brand) {
    const brand = await prisma.brand.findUnique({ where: { slug: query.brand } });
    if (!brand || !brand.isActive) throw new NotFoundError('Brand not found');
    filters.push(Prisma.sql`p."brandId" = ${brand.id}`);
  }

  if (query.q) {
    const pattern = `%${escapeIlike(query.q)}%`;
    const escapeChar = '\\';
    filters.push(Prisma.sql`(
      p.name ILIKE ${pattern} ESCAPE ${escapeChar}
      OR p.description ILIKE ${pattern} ESCAPE ${escapeChar}
      OR EXISTS (
        SELECT 1 FROM "ProductVariant" v2
        WHERE v2."productId" = p.id AND v2.sku ILIKE ${pattern} ESCAPE ${escapeChar}
      )
    )`);
  }

  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    filters.push(priceFilter(query.minPrice, query.maxPrice));
  }

  if (query.inStock === true) {
    filters.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "ProductVariant" vs
      WHERE vs."productId" = p.id
        AND (vs."stockQty" - vs."reservedQty") > 0
    )`);
  } else if (query.inStock === false) {
    filters.push(Prisma.sql`NOT EXISTS (
      SELECT 1 FROM "ProductVariant" vs
      WHERE vs."productId" = p.id
        AND (vs."stockQty" - vs."reservedQty") > 0
    )`);
  }

  const offset = (query.page - 1) * query.pageSize;
  const rows = await prisma.$queryRaw<{ id: string | null; total: bigint | number }[]>`
    WITH matched AS (
      SELECT p.id,
             p."createdAt",
             p.name,
             COALESCE(
               MIN(COALESCE(v."priceOverride", p."basePrice")),
               p."basePrice"
             ) AS min_price
      FROM "Product" p
      LEFT JOIN "ProductVariant" v ON v."productId" = p.id
      WHERE ${Prisma.join(filters, ' AND ')}
      GROUP BY p.id
    ),
    meta AS (
      SELECT COUNT(*)::int AS total FROM matched
    )
    SELECT paged.id, meta.total
    FROM meta
    LEFT JOIN LATERAL (
      SELECT matched.id, matched."createdAt", matched.name, matched.min_price
      FROM matched
      ORDER BY ${sortPrimary('matched', query.sort)}, matched.id ASC
      LIMIT ${query.pageSize} OFFSET ${offset}
    ) paged ON TRUE
    ORDER BY ${sortPrimary('paged', query.sort)}, paged.id ASC
  `;

  const total = Number(rows[0]?.total ?? 0);
  const ids = rows.map((r) => r.id).filter((id): id is string => id != null);
  const totalPages = total === 0 ? 0 : Math.ceil(total / query.pageSize);

  if (ids.length === 0) {
    return { items: [], meta: { page: query.page, pageSize: query.pageSize, total, totalPages } };
  }

  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    include: productListInclude,
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const items = ids.map((id) => {
    const product = byId.get(id);
    if (!product) throw new Error(`Listed product ${id} missing from follow-up query`);
    return toCard(product);
  });

  return { items, meta: { page: query.page, pageSize: query.pageSize, total, totalPages } };
}

const RELATED_PRODUCTS_LIMIT = 4;
const REVIEWS_LIMIT = 5;

export async function getProductBySlug(slug: string): Promise<ProductDetailDto> {
  const product = await prisma.product.findFirst({
    where: { slug, status: 'ACTIVE' },
    include: {
      brand: true,
      category: true,
      variants: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
      images: { orderBy: [{ position: 'asc' }, { id: 'asc' }] },
    },
  });
  if (!product) throw new NotFoundError('Product not found');

  const [reviewRows, relatedRows] = await Promise.all([
    prisma.review.findMany({
      where: { productId: product.id, status: 'APPROVED' },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: REVIEWS_LIMIT,
      include: { user: { select: { name: true } } },
    }),
    prisma.product.findMany({
      where: { categoryId: product.categoryId, status: 'ACTIVE', id: { not: product.id } },
      orderBy: [{ reviewCount: 'desc' }, { id: 'asc' }],
      take: RELATED_PRODUCTS_LIMIT,
      include: productListInclude,
    }),
  ]);

  const reviews: ReviewSummaryDto[] = reviewRows.map((review) => ({
    id: review.id,
    rating: review.rating,
    body: review.body,
    authorName: review.user.name,
    createdAt: review.createdAt.toISOString(),
  }));
  const relatedProducts: ProductCardDto[] = relatedRows.map(toCard);

  return toDetail(product, reviews, relatedProducts);
}
