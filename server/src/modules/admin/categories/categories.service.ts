import type { Prisma } from '@prisma/client';
import type {
  AdminCategoryDto,
  AdminCategoryListResponse,
  CreateCategoryInput,
  UpdateCategoryInput,
} from '@audio-commerce/shared';
import { prisma } from '../../../lib/prisma.js';
import { ConflictError, NotFoundError, ValidationError } from '../../../errors/AppError.js';
import { MAX_CATEGORY_DEPTH } from '../../catalog/categoryTree.js';
import { recordAudit } from '../audit.js';

const include = {
  parent: { select: { name: true } },
  _count: { select: { products: true, children: true } },
};

type CategoryRow = Prisma.CategoryGetPayload<{ include: typeof include }>;

function toDto(row: CategoryRow): AdminCategoryDto {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    parentId: row.parentId,
    parentName: row.parent?.name ?? null,
    isActive: row.isActive,
    productCount: row._count.products,
    childCount: row._count.children,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listCategories(): Promise<AdminCategoryListResponse> {
  const rows = await prisma.category.findMany({
    include,
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  });
  return { categories: rows.map(toDto) };
}

async function assertUniqueSlug(slug: string, excludeId?: string): Promise<void> {
  const existing = await prisma.category.findUnique({ where: { slug } });
  if (existing && existing.id !== excludeId) {
    throw new ConflictError('A category with this slug already exists');
  }
}

/**
 * Rejects a parent assignment that doesn't exist, that would make a category
 * its own parent, that would create a cycle (the candidate parent is already
 * a descendant of this category), or that would push the resulting subtree
 * past the same MAX_CATEGORY_DEPTH the public recursive-CTE query is bounded
 * to — otherwise a category could be created that public browsing silently
 * truncates.
 */
async function assertValidParent(categoryId: string | null, parentId: string | null | undefined): Promise<void> {
  if (parentId === undefined || parentId === null) return;
  if (parentId === categoryId) {
    throw new ValidationError('A category cannot be its own parent');
  }

  let current = await prisma.category.findUnique({ where: { id: parentId } });
  if (!current) throw new ValidationError('Parent category not found');

  let depth = 1;
  while (current.parentId) {
    if (current.parentId === categoryId) {
      throw new ValidationError('A category cannot be a descendant of itself');
    }
    if (depth >= MAX_CATEGORY_DEPTH) {
      throw new ValidationError(`Category hierarchy cannot exceed ${MAX_CATEGORY_DEPTH} levels`);
    }
    current = await prisma.category.findUniqueOrThrow({ where: { id: current.parentId } });
    depth++;
  }
}

export async function createCategory(actorId: string, input: CreateCategoryInput): Promise<AdminCategoryDto> {
  await assertUniqueSlug(input.slug);
  await assertValidParent(null, input.parentId);

  const created = await prisma.$transaction(async (tx) => {
    const category = await tx.category.create({
      data: { slug: input.slug, name: input.name, parentId: input.parentId ?? null },
      include,
    });
    await recordAudit(
      actorId,
      'category.create',
      'Category',
      category.id,
      { slug: category.slug, name: category.name, parentId: category.parentId },
      tx,
    );
    return category;
  });

  return toDto(created);
}

export async function updateCategory(
  actorId: string,
  id: string,
  input: UpdateCategoryInput,
): Promise<AdminCategoryDto> {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Category not found');
  if (input.slug !== undefined) await assertUniqueSlug(input.slug, id);
  if (input.parentId !== undefined) await assertValidParent(id, input.parentId);

  const updated = await prisma.$transaction(async (tx) => {
    const category = await tx.category.update({
      where: { id },
      data: {
        slug: input.slug,
        name: input.name,
        parentId: input.parentId,
        isActive: input.isActive,
      },
      include,
    });
    await recordAudit(actorId, 'category.update', 'Category', id, input as Prisma.InputJsonValue, tx);
    return category;
  });

  return toDto(updated);
}

export async function deleteCategory(actorId: string, id: string): Promise<void> {
  const existing = await prisma.category.findUnique({ where: { id }, include });
  if (!existing) throw new NotFoundError('Category not found');
  if (existing._count.products > 0) {
    throw new ConflictError('Cannot delete a category that still has products — deactivate it instead');
  }
  if (existing._count.children > 0) {
    throw new ConflictError('Cannot delete a category that still has subcategories — deactivate it instead');
  }

  await prisma.$transaction(async (tx) => {
    await tx.category.delete({ where: { id } });
    await recordAudit(actorId, 'category.delete', 'Category', id, { slug: existing.slug, name: existing.name }, tx);
  });
}
