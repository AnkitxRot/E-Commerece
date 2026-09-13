import type { AdminBrandsResponse, AdminCategoriesResponse } from '@audio-commerce/shared';
import { prisma } from '../../lib/prisma.js';

export async function listCategoryOptions(): Promise<AdminCategoriesResponse> {
  const categories = await prisma.category.findMany({
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    select: { id: true, name: true },
  });
  return { categories };
}

export async function listBrandOptions(): Promise<AdminBrandsResponse> {
  const brands = await prisma.brand.findMany({
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    select: { id: true, name: true },
  });
  return { brands };
}
