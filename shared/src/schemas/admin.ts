import { z } from 'zod';
import { OrderStatus, ProductStatus } from '../enums.js';
import { httpsUrlSchema, moneySchema, skuSchema, slugSchema, specsSchema, variantAttributesSchema } from './catalog.js';
import { shippingAddressInputSchema } from './orders.js';

export const paginationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const paginationMetaSchema = z
  .object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  })
  .strict();
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

// ---- Products ----

export const adminProductListQuerySchema = paginationQuerySchema
  .extend({
    status: z.nativeEnum(ProductStatus).optional(),
    q: z.string().trim().min(1).max(100).optional(),
  })
  .strict();
export type AdminProductListQuery = z.infer<typeof adminProductListQuerySchema>;

export const adminVariantInputSchema = z
  .object({
    sku: skuSchema,
    attributes: variantAttributesSchema,
    stockQty: z.number().int().min(0),
    lowStockThreshold: z.number().int().min(0).default(5),
    priceOverride: moneySchema.nullable().optional(),
    compareAtPrice: moneySchema.nullable().optional(),
  })
  .strict();
export type AdminVariantInput = z.infer<typeof adminVariantInputSchema>;

export const createProductInputSchema = z
  .object({
    slug: slugSchema,
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(5000),
    categoryId: z.string().uuid(),
    brandId: z.string().uuid().nullable().optional(),
    basePrice: moneySchema,
    status: z.nativeEnum(ProductStatus).default(ProductStatus.DRAFT),
    featured: z.boolean().default(false),
    seoTitle: z.string().trim().max(200).nullable().optional(),
    seoDescription: z.string().trim().max(300).nullable().optional(),
    specs: specsSchema.default({}),
    variants: z.array(adminVariantInputSchema).min(1, 'At least one variant is required'),
  })
  .strict();
export type CreateProductInput = z.infer<typeof createProductInputSchema>;

export const updateProductInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().min(1).max(5000).optional(),
    categoryId: z.string().uuid().optional(),
    brandId: z.string().uuid().nullable().optional(),
    basePrice: moneySchema.optional(),
    status: z.nativeEnum(ProductStatus).optional(),
    featured: z.boolean().optional(),
    seoTitle: z.string().trim().max(200).nullable().optional(),
    seoDescription: z.string().trim().max(300).nullable().optional(),
    specs: specsSchema.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' });
export type UpdateProductInput = z.infer<typeof updateProductInputSchema>;

export const updateVariantInputSchema = z
  .object({
    stockQty: z.number().int().min(0).optional(),
    lowStockThreshold: z.number().int().min(0).optional(),
    priceOverride: moneySchema.nullable().optional(),
    compareAtPrice: moneySchema.nullable().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' });
export type UpdateVariantInput = z.infer<typeof updateVariantInputSchema>;

export const adminProductVariantDtoSchema = z
  .object({
    id: z.string().uuid(),
    sku: skuSchema,
    attributes: variantAttributesSchema,
    stockQty: z.number().int(),
    reservedQty: z.number().int(),
    lowStockThreshold: z.number().int(),
    priceOverride: moneySchema.nullable(),
    compareAtPrice: moneySchema.nullable(),
  })
  .strict();
export type AdminProductVariantDto = z.infer<typeof adminProductVariantDtoSchema>;

export const createProductImageInputSchema = z
  .object({
    url: httpsUrlSchema,
    altText: z.string().trim().min(1).max(200),
    position: z.number().int().min(0).optional(),
  })
  .strict();
export type CreateProductImageInput = z.infer<typeof createProductImageInputSchema>;

export const updateProductImageInputSchema = z
  .object({
    altText: z.string().trim().min(1).max(200).optional(),
    position: z.number().int().min(0).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' });
export type UpdateProductImageInput = z.infer<typeof updateProductImageInputSchema>;

export const adminProductImageDtoSchema = z
  .object({
    id: z.string().uuid(),
    url: httpsUrlSchema,
    altText: z.string(),
    position: z.number().int(),
  })
  .strict();
export type AdminProductImageDto = z.infer<typeof adminProductImageDtoSchema>;

export const adminProductSummaryDtoSchema = z
  .object({
    id: z.string().uuid(),
    slug: slugSchema,
    name: z.string(),
    status: z.nativeEnum(ProductStatus),
    basePrice: moneySchema,
    category: z.object({ id: z.string().uuid(), name: z.string() }),
    brand: z.object({ id: z.string().uuid(), name: z.string() }).nullable(),
    totalStock: z.number().int(),
    lowStock: z.boolean(),
    createdAt: z.string(),
  })
  .strict();
export type AdminProductSummaryDto = z.infer<typeof adminProductSummaryDtoSchema>;

export const adminProductDetailDtoSchema = z
  .object({
    id: z.string().uuid(),
    slug: slugSchema,
    name: z.string(),
    description: z.string(),
    status: z.nativeEnum(ProductStatus),
    basePrice: moneySchema,
    categoryId: z.string().uuid(),
    brandId: z.string().uuid().nullable(),
    featured: z.boolean(),
    seoTitle: z.string().nullable(),
    seoDescription: z.string().nullable(),
    specs: specsSchema,
    variants: z.array(adminProductVariantDtoSchema),
    images: z.array(adminProductImageDtoSchema),
    createdAt: z.string(),
  })
  .strict();
export type AdminProductDetailDto = z.infer<typeof adminProductDetailDtoSchema>;

export const adminProductListResponseSchema = z
  .object({ items: z.array(adminProductSummaryDtoSchema), meta: paginationMetaSchema })
  .strict();
export type AdminProductListResponse = z.infer<typeof adminProductListResponseSchema>;

export const adminProductResponseSchema = z.object({ product: adminProductDetailDtoSchema }).strict();
export type AdminProductResponse = z.infer<typeof adminProductResponseSchema>;

// ---- Orders ----

export const adminOrderListQuerySchema = paginationQuerySchema
  .extend({ status: z.nativeEnum(OrderStatus).optional() })
  .strict();
export type AdminOrderListQuery = z.infer<typeof adminOrderListQuerySchema>;

export const adminOrderSummaryDtoSchema = z
  .object({
    id: z.string().uuid(),
    status: z.nativeEnum(OrderStatus),
    currency: z.string(),
    grandTotal: moneySchema,
    customerEmail: z.string().email(),
    itemCount: z.number().int(),
    createdAt: z.string(),
  })
  .strict();
export type AdminOrderSummaryDto = z.infer<typeof adminOrderSummaryDtoSchema>;

export const adminOrderListResponseSchema = z
  .object({ items: z.array(adminOrderSummaryDtoSchema), meta: paginationMetaSchema })
  .strict();
export type AdminOrderListResponse = z.infer<typeof adminOrderListResponseSchema>;

export const adminOrderItemDtoSchema = z
  .object({
    id: z.string().uuid(),
    productSlug: slugSchema.nullable(),
    productName: z.string(),
    variantSku: skuSchema,
    variantAttributes: variantAttributesSchema,
    unitPrice: moneySchema,
    qty: z.number().int(),
    lineTotal: moneySchema,
  })
  .strict();
export type AdminOrderItemDto = z.infer<typeof adminOrderItemDtoSchema>;

export const adminOrderDetailDtoSchema = z
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
    customer: z.object({ id: z.string().uuid(), email: z.string().email(), name: z.string() }),
    items: z.array(adminOrderItemDtoSchema),
    createdAt: z.string(),
  })
  .strict();
export type AdminOrderDetailDto = z.infer<typeof adminOrderDetailDtoSchema>;

export const adminOrderResponseSchema = z.object({ order: adminOrderDetailDtoSchema }).strict();
export type AdminOrderResponse = z.infer<typeof adminOrderResponseSchema>;

export const updateOrderStatusInputSchema = z.object({ status: z.nativeEnum(OrderStatus) }).strict();
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusInputSchema>;

// ---- Category management ----

export const createCategoryInputSchema = z
  .object({
    slug: slugSchema,
    name: z.string().trim().min(1).max(100),
    parentId: z.string().uuid().nullable().optional(),
  })
  .strict();
export type CreateCategoryInput = z.infer<typeof createCategoryInputSchema>;

export const updateCategoryInputSchema = z
  .object({
    slug: slugSchema.optional(),
    name: z.string().trim().min(1).max(100).optional(),
    parentId: z.string().uuid().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' });
export type UpdateCategoryInput = z.infer<typeof updateCategoryInputSchema>;

export const adminCategoryDtoSchema = z
  .object({
    id: z.string().uuid(),
    slug: slugSchema,
    name: z.string(),
    parentId: z.string().uuid().nullable(),
    parentName: z.string().nullable(),
    isActive: z.boolean(),
    productCount: z.number().int(),
    childCount: z.number().int(),
    createdAt: z.string(),
  })
  .strict();
export type AdminCategoryDto = z.infer<typeof adminCategoryDtoSchema>;

export const adminCategoryListResponseSchema = z.object({ categories: z.array(adminCategoryDtoSchema) }).strict();
export type AdminCategoryListResponse = z.infer<typeof adminCategoryListResponseSchema>;

export const adminCategoryResponseSchema = z.object({ category: adminCategoryDtoSchema }).strict();
export type AdminCategoryResponse = z.infer<typeof adminCategoryResponseSchema>;

// ---- Brand management ----

export const createBrandInputSchema = z
  .object({
    slug: slugSchema,
    name: z.string().trim().min(1).max(100),
    logoUrl: httpsUrlSchema.nullable().optional(),
  })
  .strict();
export type CreateBrandInput = z.infer<typeof createBrandInputSchema>;

export const updateBrandInputSchema = z
  .object({
    slug: slugSchema.optional(),
    name: z.string().trim().min(1).max(100).optional(),
    logoUrl: httpsUrlSchema.nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' });
export type UpdateBrandInput = z.infer<typeof updateBrandInputSchema>;

export const adminBrandDtoSchema = z
  .object({
    id: z.string().uuid(),
    slug: slugSchema,
    name: z.string(),
    logoUrl: z.string().nullable(),
    isActive: z.boolean(),
    productCount: z.number().int(),
    createdAt: z.string(),
  })
  .strict();
export type AdminBrandDto = z.infer<typeof adminBrandDtoSchema>;

export const adminBrandListResponseSchema = z.object({ brands: z.array(adminBrandDtoSchema) }).strict();
export type AdminBrandListResponse = z.infer<typeof adminBrandListResponseSchema>;

export const adminBrandResponseSchema = z.object({ brand: adminBrandDtoSchema }).strict();
export type AdminBrandResponse = z.infer<typeof adminBrandResponseSchema>;

// ---- Dashboard ----

export const adminDashboardDtoSchema = z
  .object({
    productCount: z.number().int(),
    activeProductCount: z.number().int(),
    orderCount: z.number().int(),
    revenueTotal: moneySchema,
    lowStockCount: z.number().int(),
    recentOrders: z.array(adminOrderSummaryDtoSchema),
  })
  .strict();
export type AdminDashboardDto = z.infer<typeof adminDashboardDtoSchema>;
