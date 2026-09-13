import { prisma } from '../../lib/prisma.js';
import { NotFoundError } from '../../errors/AppError.js';

export const MAX_CATEGORY_DEPTH = 8;

export async function resolveCategoryAndDescendantIds(slug: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    WITH RECURSIVE tree AS (
      SELECT id, "parentId", 1 AS depth
      FROM "Category"
      WHERE slug = ${slug} AND "isActive" = true
      UNION ALL
      SELECT c.id, c."parentId", tree.depth + 1
      FROM "Category" c
      INNER JOIN tree ON c."parentId" = tree.id
      WHERE tree.depth < ${MAX_CATEGORY_DEPTH} AND c."isActive" = true
    )
    SELECT id FROM tree
  `;
  if (rows.length === 0) throw new NotFoundError('Category not found');
  return rows.map((r) => r.id);
}
