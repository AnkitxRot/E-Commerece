import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { resolveCategoryAndDescendantIds } from '../src/modules/catalog/categoryTree.js';
import { NotFoundError } from '../src/errors/AppError.js';
import { resetDb } from './setup.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('resolveCategoryAndDescendantIds', () => {
  it('returns self and descendants in one CTE and 404s unknown slugs', async () => {
    const root = await prisma.category.create({ data: { slug: 'headphones', name: 'Headphones' } });
    const child = await prisma.category.create({
      data: { slug: 'over-ear', name: 'Over-ear', parentId: root.id },
    });
    const grand = await prisma.category.create({
      data: { slug: 'flagship', name: 'Flagship', parentId: child.id },
    });
    const other = await prisma.category.create({ data: { slug: 'cables', name: 'Cables' } });

    const ids = await resolveCategoryAndDescendantIds('headphones');
    expect(ids.sort()).toEqual([root.id, child.id, grand.id].sort());
    expect(ids).not.toContain(other.id);

    const onlyChild = await resolveCategoryAndDescendantIds('over-ear');
    expect(onlyChild.sort()).toEqual([child.id, grand.id].sort());

    await expect(resolveCategoryAndDescendantIds('missing')).rejects.toBeInstanceOf(NotFoundError);
  });
});
