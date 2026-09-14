import { z } from 'zod';
import {
  announcementPayloadSchema,
  bannerPayloadSchema,
  featuredCollectionPayloadSchema,
  heroContentSchema,
  httpsUrlSchema,
} from './catalog.js';
import { ContentBlockType } from '../enums.js';

// A fixed set of platforms rather than an open-ended record — this is a
// demo storefront's footer, not a general-purpose link list, and an
// unbounded key set would need its own length/count limits to stay safe.
export const socialLinksSchema = z
  .object({
    twitter: httpsUrlSchema.optional(),
    instagram: httpsUrlSchema.optional(),
    facebook: httpsUrlSchema.optional(),
    youtube: httpsUrlSchema.optional(),
  })
  .strict();
export type SocialLinks = z.infer<typeof socialLinksSchema>;

// ---- Store settings (a singleton row — no create/delete, only read/update) ----

export const updateStoreSettingsInputSchema = z
  .object({
    storeName: z.string().trim().min(1).max(80).optional(),
    logoUrl: httpsUrlSchema.nullable().optional(),
    faviconUrl: httpsUrlSchema.nullable().optional(),
    contactEmail: z.string().trim().email().optional(),
    contactPhone: z.string().trim().min(6).max(20).nullable().optional(),
    socialLinks: socialLinksSchema.optional(),
    heroContent: heroContentSchema.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' });
export type UpdateStoreSettingsInput = z.infer<typeof updateStoreSettingsInputSchema>;

export const adminStoreSettingsDtoSchema = z
  .object({
    storeName: z.string(),
    logoUrl: z.string().nullable(),
    faviconUrl: z.string().nullable(),
    contactEmail: z.string(),
    contactPhone: z.string().nullable(),
    socialLinks: socialLinksSchema,
    heroContent: heroContentSchema.nullable(),
    updatedAt: z.string(),
  })
  .strict();
export type AdminStoreSettingsDto = z.infer<typeof adminStoreSettingsDtoSchema>;

export const adminStoreSettingsResponseSchema = z.object({ settings: adminStoreSettingsDtoSchema }).strict();
export type AdminStoreSettingsResponse = z.infer<typeof adminStoreSettingsResponseSchema>;

// ---- Content blocks ----

// A discriminated union so `payload`'s shape is tied to `type` at create
// time — the same per-type payload schemas the public home page already
// validates against (contentBlockPayloadSchemaByType), so there is exactly
// one definition of what a valid BANNER/ANNOUNCEMENT/FEATURED_COLLECTION
// payload looks like, not a second one for the admin write path.
export const createContentBlockInputSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal(ContentBlockType.BANNER),
    payload: bannerPayloadSchema,
    position: z.number().int().min(0),
    active: z.boolean().optional(),
  }),
  z.object({
    type: z.literal(ContentBlockType.ANNOUNCEMENT),
    payload: announcementPayloadSchema,
    position: z.number().int().min(0),
    active: z.boolean().optional(),
  }),
  z.object({
    type: z.literal(ContentBlockType.FEATURED_COLLECTION),
    payload: featuredCollectionPayloadSchema,
    position: z.number().int().min(0),
    active: z.boolean().optional(),
  }),
]);
export type CreateContentBlockInput = z.infer<typeof createContentBlockInputSchema>;

// type is intentionally immutable after creation (same reasoning as a
// coupon's code or a product variant's SKU elsewhere in this codebase) —
// changing what kind of block this is is a new block, not an edit of this
// one. payload is validated server-side against the EXISTING block's type
// via contentBlockPayloadSchemaByType, so it's typed loosely here.
export const updateContentBlockInputSchema = z
  .object({
    payload: z.record(z.unknown()).optional(),
    position: z.number().int().min(0).optional(),
    active: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' });
export type UpdateContentBlockInput = z.infer<typeof updateContentBlockInputSchema>;

export const adminContentBlockDtoSchema = z
  .object({
    id: z.string().uuid(),
    type: z.nativeEnum(ContentBlockType),
    payload: z.record(z.unknown()),
    position: z.number().int(),
    active: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();
export type AdminContentBlockDto = z.infer<typeof adminContentBlockDtoSchema>;

export const adminContentBlockListResponseSchema = z
  .object({ blocks: z.array(adminContentBlockDtoSchema) })
  .strict();
export type AdminContentBlockListResponse = z.infer<typeof adminContentBlockListResponseSchema>;

export const adminContentBlockResponseSchema = z.object({ block: adminContentBlockDtoSchema }).strict();
export type AdminContentBlockResponse = z.infer<typeof adminContentBlockResponseSchema>;
