import type { WishlistDto } from '@audio-commerce/shared';
import { prisma } from '../../lib/prisma.js';
import { NotFoundError } from '../../errors/AppError.js';
import { toCard } from '../catalog/mapProduct.js';
import { productListInclude } from '../catalog/catalog.service.js';

async function getOrCreateWishlistId(userId: string): Promise<string> {
  const existing = await prisma.wishlist.findUnique({ where: { userId } });
  if (existing) return existing.id;
  const created = await prisma.wishlist.create({ data: { userId } });
  return created.id;
}

export async function getWishlist(userId: string): Promise<WishlistDto> {
  const wishlistId = await getOrCreateWishlistId(userId);
  const rows = await prisma.wishlistItem.findMany({
    where: { wishlistId },
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    include: { product: { include: productListInclude } },
  });
  return {
    items: rows.map((row) => ({
      addedAt: row.createdAt.toISOString(),
      product: toCard(row.product),
    })),
  };
}

async function findActiveProductBySlug(slug: string) {
  const product = await prisma.product.findFirst({ where: { slug, status: 'ACTIVE' }, select: { id: true } });
  if (!product) throw new NotFoundError('Product not found');
  return product;
}

export async function addItem(userId: string, slug: string): Promise<WishlistDto> {
  const product = await findActiveProductBySlug(slug);
  const wishlistId = await getOrCreateWishlistId(userId);
  await prisma.wishlistItem.upsert({
    where: { wishlistId_productId: { wishlistId, productId: product.id } },
    update: {},
    create: { wishlistId, productId: product.id },
  });
  return getWishlist(userId);
}

export async function removeItem(userId: string, slug: string): Promise<WishlistDto> {
  const wishlistId = await getOrCreateWishlistId(userId);
  const product = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
  if (product) {
    await prisma.wishlistItem.deleteMany({ where: { wishlistId, productId: product.id } });
  }
  return getWishlist(userId);
}
