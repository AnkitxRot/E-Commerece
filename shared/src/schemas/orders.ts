import { z } from 'zod';
import { moneySchema, skuSchema, slugSchema, variantAttributesSchema } from './catalog.js';
import { OrderStatus } from '../enums.js';

export const shippingAddressInputSchema = z
  .object({
    fullName: z.string().trim().min(1).max(100),
    line1: z.string().trim().min(1).max(200),
    line2: z.string().trim().max(200).optional(),
    city: z.string().trim().min(1).max(100),
    state: z.string().trim().min(1).max(100),
    postalCode: z.string().trim().min(3).max(20),
    country: z.string().trim().min(1).max(100),
    phone: z.string().trim().min(6).max(20),
  })
  .strict();
export type ShippingAddressInput = z.infer<typeof shippingAddressInputSchema>;

// Exactly one of shippingAddress (typed in at checkout) or addressId (a
// saved address book entry) must be given — the server resolves either
// into the same snapshot shape before creating the order, so an order's
// stored shippingAddress is always a plain historical copy, never a live
// reference to an Address row that could later be edited or deleted.
export const createOrderInputSchema = z
  .object({
    shippingAddress: shippingAddressInputSchema.optional(),
    addressId: z.string().uuid().optional(),
  })
  .strict()
  .refine((data) => Boolean(data.shippingAddress) !== Boolean(data.addressId), {
    message: 'Provide exactly one of shippingAddress or addressId',
  });
export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;

export const orderItemDtoSchema = z
  .object({
    id: z.string().uuid(),
    productSlug: slugSchema.nullable(),
    productName: z.string().min(1).max(120),
    variantSku: skuSchema,
    variantAttributes: variantAttributesSchema,
    unitPrice: moneySchema,
    qty: z.number().int().min(1),
    lineTotal: moneySchema,
  })
  .strict();
export type OrderItemDto = z.infer<typeof orderItemDtoSchema>;

export const orderDtoSchema = z
  .object({
    id: z.string().uuid(),
    status: z.nativeEnum(OrderStatus),
    currency: z.string(),
    subtotal: moneySchema,
    discountTotal: moneySchema,
    shippingTotal: moneySchema,
    taxTotal: moneySchema,
    grandTotal: moneySchema,
    shippingAddress: shippingAddressInputSchema,
    items: z.array(orderItemDtoSchema),
    createdAt: z.string(),
  })
  .strict();
export type OrderDto = z.infer<typeof orderDtoSchema>;

export const orderResponseSchema = z.object({ order: orderDtoSchema }).strict();
export type OrderResponse = z.infer<typeof orderResponseSchema>;

export const orderListResponseSchema = z.object({ orders: z.array(orderDtoSchema) }).strict();
export type OrderListResponse = z.infer<typeof orderListResponseSchema>;
