import { z } from 'zod';
import { ContentBlockType } from '../enums.js';

export const moneySchema = z.string().regex(/^\d+\.\d{2}$/);
export type Money = z.infer<typeof moneySchema>;

export const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .min(1)
  .max(80);

export const skuSchema = z.string().trim().min(1).max(40);

export const internalPathSchema = z
  .string()
  .min(1)
  .max(200)
  .refine((p) => p.startsWith('/') && !p.startsWith('//') && !/^https?:/i.test(p), {
    message: 'Must be a root-relative path',
  });

export const httpsUrlSchema = z.string().url().refine((u) => u.startsWith('https://'), {
  message: 'Must be an https URL',
});

export const variantAttributesSchema = z.record(z.string().min(1).max(40), z.string().min(1).max(80));

export const imageDtoSchema = z.object({
  url: httpsUrlSchema,
  altText: z.string().min(1).max(200),
  position: z.number().int().min(0),
});
export type ImageDto = z.infer<typeof imageDtoSchema>;

export const brandSummarySchema = z.object({
  slug: slugSchema,
  name: z.string().min(1).max(100),
});
export type BrandSummary = z.infer<typeof brandSummarySchema>;

export const brandDtoSchema = brandSummarySchema.extend({
  logoUrl: httpsUrlSchema.nullable(),
});
export type BrandDto = z.infer<typeof brandDtoSchema>;

export const categorySummarySchema = z.object({
  slug: slugSchema,
  name: z.string().min(1).max(100),
});
export type CategorySummary = z.infer<typeof categorySummarySchema>;

export const productCardDtoSchema = z
  .object({
    slug: slugSchema,
    name: z.string().min(1).max(120),
    brand: brandSummarySchema.nullable(),
    category: categorySummarySchema,
    priceFrom: moneySchema,
    priceTo: moneySchema,
    thumbnail: imageDtoSchema.nullable(),
    inStock: z.boolean(),
    featured: z.boolean(),
  })
  .strict();
export type ProductCardDto = z.infer<typeof productCardDtoSchema>;

export const variantDtoSchema = z
  .object({
    sku: skuSchema,
    attributes: variantAttributesSchema,
    price: moneySchema,
    inStock: z.boolean(),
    availableQty: z.number().int().min(0),
  })
  .strict();
export type VariantDto = z.infer<typeof variantDtoSchema>;

export const productDetailDtoSchema = z
  .object({
    slug: slugSchema,
    name: z.string().min(1).max(120),
    description: z.string().min(1).max(8000),
    seoTitle: z.string().max(80).nullable(),
    seoDescription: z.string().max(200).nullable(),
    brand: brandDtoSchema.nullable(),
    category: categorySummarySchema,
    featured: z.boolean(),
    inStock: z.boolean(),
    images: z.array(imageDtoSchema),
    variants: z.array(variantDtoSchema),
    priceFrom: moneySchema,
    priceTo: moneySchema,
  })
  .strict();
export type ProductDetailDto = z.infer<typeof productDetailDtoSchema>;

export const heroContentSchema = z.object({
  title: z.string().trim().min(1).max(80),
  subtitle: z.string().trim().min(1).max(200).optional(),
  imageUrl: httpsUrlSchema.optional(),
  ctaLabel: z.string().trim().min(1).max(40).optional(),
  ctaHref: internalPathSchema.optional(),
});
export type HeroContent = z.infer<typeof heroContentSchema>;

export const bannerPayloadSchema = heroContentSchema;
export type BannerPayload = z.infer<typeof bannerPayloadSchema>;

export const announcementPayloadSchema = z.object({
  message: z.string().trim().min(1).max(240),
  href: internalPathSchema.optional(),
});
export type AnnouncementPayload = z.infer<typeof announcementPayloadSchema>;

export const featuredCollectionPayloadSchema = z.object({
  title: z.string().trim().min(1).max(80),
  productSlugs: z.array(slugSchema).min(1).max(8),
});
export type FeaturedCollectionPayload = z.infer<typeof featuredCollectionPayloadSchema>;

export const contentBlockPayloadSchemaByType = {
  [ContentBlockType.BANNER]: bannerPayloadSchema,
  [ContentBlockType.ANNOUNCEMENT]: announcementPayloadSchema,
  [ContentBlockType.FEATURED_COLLECTION]: featuredCollectionPayloadSchema,
} as const;

export const bannerBlockDtoSchema = z.object({
  id: z.string().uuid(),
  type: z.literal(ContentBlockType.BANNER),
  position: z.number().int(),
  payload: bannerPayloadSchema,
});
export const announcementBlockDtoSchema = z.object({
  id: z.string().uuid(),
  type: z.literal(ContentBlockType.ANNOUNCEMENT),
  position: z.number().int(),
  payload: announcementPayloadSchema,
});
export const featuredCollectionBlockDtoSchema = z.object({
  id: z.string().uuid(),
  type: z.literal(ContentBlockType.FEATURED_COLLECTION),
  position: z.number().int(),
  payload: z.object({ title: z.string().min(1).max(80) }),
  products: z.array(productCardDtoSchema),
});
export const homeBlockDtoSchema = z.discriminatedUnion('type', [
  bannerBlockDtoSchema,
  announcementBlockDtoSchema,
  featuredCollectionBlockDtoSchema,
]);
export type HomeBlockDto = z.infer<typeof homeBlockDtoSchema>;

export const storeSettingsDtoSchema = z.object({
  storeName: z.string().min(1).max(80),
  logoUrl: httpsUrlSchema.nullable(),
  contactEmail: z.string().email(),
});
export type StoreSettingsDto = z.infer<typeof storeSettingsDtoSchema>;

export const homeResponseSchema = z
  .object({
    hero: heroContentSchema.nullable(),
    blocks: z.array(homeBlockDtoSchema),
    featured: z.array(productCardDtoSchema).max(8),
  })
  .strict();
export type HomeResponse = z.infer<typeof homeResponseSchema>;

export type CategoryTreeNode = {
  slug: string;
  name: string;
  children: CategoryTreeNode[];
};
export const categoryTreeNodeSchema: z.ZodType<CategoryTreeNode> = z.lazy(() =>
  z.object({
    slug: slugSchema,
    name: z.string().min(1).max(100),
    children: z.array(categoryTreeNodeSchema),
  }),
);

export const categoriesResponseSchema = z.object({
  categories: z.array(categoryTreeNodeSchema),
});
export type CategoriesResponse = z.infer<typeof categoriesResponseSchema>;

export const categoryDetailDtoSchema = z.object({
  slug: slugSchema,
  name: z.string().min(1).max(100),
  parent: categorySummarySchema.nullable(),
  children: z.array(categorySummarySchema),
});
export type CategoryDetailDto = z.infer<typeof categoryDetailDtoSchema>;

export const brandsResponseSchema = z.object({
  brands: z.array(brandDtoSchema),
});
export type BrandsResponse = z.infer<typeof brandsResponseSchema>;

export const productListMetaSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(48),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
});
export type ProductListMeta = z.infer<typeof productListMetaSchema>;

export const productListResponseSchema = z
  .object({
    items: z.array(productCardDtoSchema),
    meta: productListMetaSchema,
  })
  .strict();
export type ProductListResponse = z.infer<typeof productListResponseSchema>;

export const productDetailResponseSchema = z.object({
  product: productDetailDtoSchema,
});
export type ProductDetailResponse = z.infer<typeof productDetailResponseSchema>;

export const catalogSortSchema = z.enum(['newest', 'price_asc', 'price_desc', 'name_asc', 'name_desc']);
export type CatalogSort = z.infer<typeof catalogSortSchema>;

const scalarString = z.string(); // rejects string[]

export function normalizeSearchQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

const qSchema = z.preprocess((v) => {
  if (v === undefined || v === '') return undefined;
  if (typeof v !== 'string') return v;
  const n = normalizeSearchQuery(v);
  return n === '' ? undefined : n;
}, z.string().min(2).max(80).optional());

const optionalSlug = z.preprocess(
  (v) => (v === undefined || v === '' ? undefined : v),
  slugSchema.optional(),
);

const boundedIntString = (min: number, max: number) =>
  scalarString.regex(/^\d+$/).transform(Number).refine((n) => Number.isInteger(n) && n >= min && n <= max);

const priceString = scalarString
  .regex(/^\d+(?:\.\d{1,2})?$/)
  .transform(Number)
  .refine((n) => n >= 0 && n <= 1_000_000);

const optionalBoolean = z.preprocess(
  (v) => (v === undefined || v === '' ? undefined : v),
  z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
);

export const productListQuerySchema = z
  .object({
    q: qSchema,
    category: optionalSlug,
    brand: optionalSlug,
    minPrice: z.preprocess((v) => (v === undefined || v === '' ? undefined : v), priceString.optional()),
    maxPrice: z.preprocess((v) => (v === undefined || v === '' ? undefined : v), priceString.optional()),
    inStock: optionalBoolean,
    sort: z.preprocess((v) => (v === undefined || v === '' ? 'newest' : v), catalogSortSchema),
    page: z.preprocess((v) => (v === undefined || v === '' ? '1' : v), boundedIntString(1, 1_000_000)),
    pageSize: z.preprocess((v) => (v === undefined || v === '' ? '24' : v), boundedIntString(1, 48)),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.minPrice !== undefined && val.maxPrice !== undefined && val.minPrice > val.maxPrice) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'minPrice must be <= maxPrice', path: ['maxPrice'] });
    }
  });
export type ProductListQuery = z.infer<typeof productListQuerySchema>;

export const catalogSlugParamSchema = z.object({ slug: slugSchema }).strict();
