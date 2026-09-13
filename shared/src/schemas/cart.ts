import { z } from 'zod';
import { moneySchema, skuSchema, slugSchema, variantAttributesSchema, imageDtoSchema } from './catalog.js';

export const addCartItemSchema = z
  .object({
    variantId: z.string().uuid(),
    qty: z.number().int().min(1).max(20),
  })
  .strict();
export type AddCartItemInput = z.infer<typeof addCartItemSchema>;

export const updateCartItemSchema = z
  .object({
    qty: z.number().int().min(1).max(20),
  })
  .strict();
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;

export const cartItemDtoSchema = z
  .object({
    id: z.string().uuid(),
    variantId: z.string().uuid(),
    sku: skuSchema,
    productSlug: slugSchema,
    productName: z.string().min(1).max(120),
    attributes: variantAttributesSchema,
    thumbnail: imageDtoSchema.nullable(),
    unitPrice: moneySchema,
    compareAtPrice: moneySchema.nullable(),
    qty: z.number().int().min(1),
    availableQty: z.number().int().min(0),
    inStock: z.boolean(),
    lineTotal: moneySchema,
  })
  .strict();
export type CartItemDto = z.infer<typeof cartItemDtoSchema>;

export const cartDtoSchema = z
  .object({
    items: z.array(cartItemDtoSchema),
    itemCount: z.number().int().min(0),
    subtotal: moneySchema,
  })
  .strict();
export type CartDto = z.infer<typeof cartDtoSchema>;
