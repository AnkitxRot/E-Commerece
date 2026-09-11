import { Prisma } from '@prisma/client';
import type {
  BrandsResponse,
  CatalogSort,
  CategoriesResponse,
  CategoryDetailDto,
  CategoryTreeNode,
  ProductDetailDto,
  ProductListQuery,
  ProductListResponse,
  StoreSettingsDto,
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
    select: { id: true, slug: true, name: true, parentId: true },
  });
  return { categories: assembleTree(rows) };
}

export async function getCategoryBySlug(slug: string): Promise<CategoryDetailDto> {
  const category = await prisma.category.findUnique({
    where: { slug },
    include: {
      parent: { select: { slug: true, name: true } },
      children: {
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
    where: { products: { some: { status: 'ACTIVE' } } },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    select: { slug: true, name: true, logoUrl: true },
  });
  return { brands };
}

const productListInclude = {
  brand: true,
  category: true,
  variants: true,
  images: { orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }] },
};

const sortPrimary: Record<CatalogSort, Prisma.Sql> = {
  newest: Prisma.sql`matched."createdAt" DESC`,
  name_asc: Prisma.sql`matched.name ASC`,
  name_desc: Prisma.sql`matched.name DESC`,
  price_asc: Prisma.sql`matched.min_price ASC`,
  price_desc: Prisma.sql`matched.min_price DESC`,
};

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
    if (!brand) throw new NotFoundError('Brand not found');
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
      SELECT matched.id
      FROM matched
      ORDER BY ${sortPrimary[query.sort]}, matched.id ASC
      LIMIT ${query.pageSize} OFFSET ${offset}
    ) paged ON TRUE
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
  return toDetail(product);
}
