import type { Prisma } from '@prisma/client';
import type { AdminBrandDto, AdminBrandListResponse, CreateBrandInput, UpdateBrandInput } from '@audio-commerce/shared';
import { prisma } from '../../../lib/prisma.js';
import { ConflictError, NotFoundError } from '../../../errors/AppError.js';
import { recordAudit } from '../audit.js';

const include = { _count: { select: { products: true } } };

type BrandRow = Prisma.BrandGetPayload<{ include: typeof include }>;

function toDto(row: BrandRow): AdminBrandDto {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    logoUrl: row.logoUrl,
    isActive: row.isActive,
    productCount: row._count.products,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listBrands(): Promise<AdminBrandListResponse> {
  const rows = await prisma.brand.findMany({
    include,
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  });
  return { brands: rows.map(toDto) };
}

async function assertUniqueSlug(slug: string, excludeId?: string): Promise<void> {
  const existing = await prisma.brand.findUnique({ where: { slug } });
  if (existing && existing.id !== excludeId) {
    throw new ConflictError('A brand with this slug already exists');
  }
}

export async function createBrand(actorId: string, input: CreateBrandInput): Promise<AdminBrandDto> {
  await assertUniqueSlug(input.slug);

  const created = await prisma.$transaction(async (tx) => {
    const brand = await tx.brand.create({
      data: { slug: input.slug, name: input.name, logoUrl: input.logoUrl ?? null },
      include,
    });
    await recordAudit(actorId, 'brand.create', 'Brand', brand.id, { slug: brand.slug, name: brand.name }, tx);
    return brand;
  });

  return toDto(created);
}

export async function updateBrand(actorId: string, id: string, input: UpdateBrandInput): Promise<AdminBrandDto> {
  const existing = await prisma.brand.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Brand not found');
  if (input.slug !== undefined) await assertUniqueSlug(input.slug, id);

  const updated = await prisma.$transaction(async (tx) => {
    const brand = await tx.brand.update({
      where: { id },
      data: { slug: input.slug, name: input.name, logoUrl: input.logoUrl, isActive: input.isActive },
      include,
    });
    await recordAudit(actorId, 'brand.update', 'Brand', id, input as Prisma.InputJsonValue, tx);
    return brand;
  });

  return toDto(updated);
}

export async function deleteBrand(actorId: string, id: string): Promise<void> {
  const existing = await prisma.brand.findUnique({ where: { id }, include });
  if (!existing) throw new NotFoundError('Brand not found');
  if (existing._count.products > 0) {
    throw new ConflictError('Cannot delete a brand that still has products — deactivate it instead');
  }

  await prisma.$transaction(async (tx) => {
    await tx.brand.delete({ where: { id } });
    await recordAudit(actorId, 'brand.delete', 'Brand', id, { slug: existing.slug, name: existing.name }, tx);
  });
}
