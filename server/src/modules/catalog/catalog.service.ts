import { prisma } from '../../lib/prisma.js';
import { NotFoundError } from '../../errors/AppError.js';
import type {
  BrandsResponse,
  CategoriesResponse,
  CategoryDetailDto,
  CategoryTreeNode,
  StoreSettingsDto,
} from '@audio-commerce/shared';

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
