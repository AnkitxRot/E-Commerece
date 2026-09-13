import { z } from 'zod';
import { productCardDtoSchema, slugSchema } from './catalog.js';

export const addWishlistItemSchema = z
  .object({
    slug: slugSchema,
  })
  .strict();
export type AddWishlistItemInput = z.infer<typeof addWishlistItemSchema>;

export const wishlistSlugParamSchema = z.object({ slug: slugSchema }).strict();

export const wishlistItemDtoSchema = z
  .object({
    addedAt: z.string(),
    product: productCardDtoSchema,
  })
  .strict();
export type WishlistItemDto = z.infer<typeof wishlistItemDtoSchema>;

export const wishlistDtoSchema = z
  .object({
    items: z.array(wishlistItemDtoSchema),
  })
  .strict();
export type WishlistDto = z.infer<typeof wishlistDtoSchema>;
