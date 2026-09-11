# Phase 2: Public Catalog Storefront — Design Spec

Date: 2026-09-12
Status: Approved for implementation planning (amendments 1–11 incorporated)

## Purpose

Ship a public, database-backed catalog for Aurelia Audio: homepage,
category and product listing, product detail (variants and images),
search, filtering, sorting, pagination, and a realistic catalog seed.

This phase makes the storefront browsable. It does not sell.

## Stack (locked — inherited from Phase 1)

- Frontend: React 18 + Vite + TypeScript + React Router v6 + Tailwind
  CSS. No Next.js. No SSR/SSG.
- Backend: Node.js + Express + TypeScript.
- Database: existing PostgreSQL + Prisma schema. No table redesign.
- Contracts: Zod schemas in `/shared` are the **only** catalog
  request/response types. Server validates with them. Client types
  them with `z.infer` and **runtime-parses** every catalog payload
  with the same schemas. The client must not declare parallel
  interfaces or guess response shape.
- Auth: unchanged. Catalog APIs are public and do not require a JWT.
- Money: INR. JSON never uses floating-point for prices.

## In scope

- Homepage: store hero from `StoreSettings.heroContent`, active
  `ContentBlock` rows, featured `Product` rows.
- Category listing (including products in descendant categories).
- Product listing (all active products, with query filters).
- Product detail: description, image gallery, variant picker, price,
  availability.
- Search, filtering, sorting, offset pagination.
- REST APIs that read live PostgreSQL data.
- Realistic, idempotent catalog seed (categories, brands, products,
  variants, images, content blocks, hero).
- Client pages that render only API data — no hardcoded product arrays,
  featured collections, or prices in the client.

## Out of scope

Cart, wishlist, checkout, orders, reviews, coupons, admin CRUD, image
upload, payment, sitemap/robots/llms.txt/JSON-LD, React Query / any new
client cache library, full-text search indexes, variant-specific
imagery, add-to-cart or buy buttons.

SEO beyond `document.title` / `meta name="description"` from existing
`seoTitle` / `seoDescription` fields is PARTIAL, per the Phase 1
React+Vite constraint — never faked with SSR.

## Database (no redesign)

Phase 2 reads these existing models as-is:

- `Category` (optional `parentId` tree), `Brand`, `Product`,
  `ProductVariant`, `ProductImage`, `ContentBlock`, `StoreSettings`.

Public catalog queries **always** constrain `Product.status = ACTIVE`.
`DRAFT` and `ARCHIVED` products are indistinguishable from missing:
detail and search return 404 / omit them. Do not leak existence.

Availability is computed, never stored as a new column, and is the
**same formula everywhere** (list cards, list `inStock` filter, PDP
product, PDP variant):

```
availableQty(variant) = variant.stockQty - variant.reservedQty
inStock(variant)      = availableQty(variant) > 0
inStock(product)      = at least one variant has inStock(variant) === true
                        (zero-variant products are not in stock)
```

The list filter `inStock=true` means `inStock(product) === true`.
`inStock=false` means `inStock(product) === false` (every variant
has `availableQty === 0`, or there are no variants).

Do not expose `stockQty`, `reservedQty`, or `lowStockThreshold` on
public DTOs. PDP variants **do** expose `availableQty` (the computed
value) plus `inStock`. List cards expose only `inStock` (the product
rollup), not per-variant qty.

**Accepted schema limitations (not blockers):**

- `ProductImage` is product-scoped. Changing variant does not swap the
  gallery. Color is communicated with the variant attribute label.
- `ContentBlock.payload` and `StoreSettings.heroContent` are untyped
  JSON **in the database**. They never flow into the homepage UI as
  raw JSON. The server parses each payload with the Zod schema for
  that `ContentBlockType` (or `heroContentSchema`) and returns only
  the parsed DTO. Invalid payloads are omitted (logged), not
  migrated.
- Search stays Postgres case-insensitive **substring** (`ILIKE`,
  metacharacters escaped). No search engine, no `pg_trgm`, no
  tsvector, no speculative indexes in this phase.

A Prisma migration is allowed only if implementation discovers a
concrete blocker (for example a missing index that makes a required
query incorrect, not merely slower). Additive indexes are permitted;
new tables, renamed columns, and variant-image FKs are not.

---

## Decisions (alternatives considered)

**Pagination — offset `page` + `pageSize` with a total count**
(not cursor, not infinite scroll). Listing URLs must be shareable as
`?page=2`. Every catalog `ORDER BY` ends with `"id" ASC` as a stable
tie-breaker so equal primary keys never shuffle between pages.

**Search — escaped Postgres `ILIKE` substring** on product name,
description, and variant SKU. No Elasticsearch, no `pg_trgm`, no
generated search column. Academic catalog scale does not justify
them.

**Category descendants — one bounded recursive CTE** (max depth 8),
not per-child queries and not an in-memory walk of N queries. The
full nav tree is a **single** `findMany` assembled in process (also
not N+1).

**Client data fetching — route-driven `apiFetch` + `AbortController`**
(not TanStack Query). URL is the source of truth. Changing
q/category/brand/price/inStock/sort (or pageSize) **resets `page`
to 1**. Filters `replace` history; pagination `push`es.

**Server cache — short-lived, never user-specific public cache.**
Anonymous catalog GET: `public, max-age=15, stale-while-revalidate=60`.
If the request carries `Authorization` or a `refreshToken` cookie:
`private, max-age=15` (same body, never stored as a public shared
response). Errors: `no-store`. This helper is catalog-router only —
never `/api/auth` or `/api/admin`. Catalog DTOs contain no user,
cart, or session fields.

---

## Architecture

Route → controller → service → Prisma. Same as auth.

New server module: `server/src/modules/catalog/`
(`catalog.routes.ts`, `catalog.controller.ts`, `catalog.service.ts`,
`categoryTree.ts`, `money.ts`, `availability.ts`, `cacheControl.ts`,
`mapProduct.ts`). No writes except the existing seed script.

New shared module: `shared/src/schemas/catalog.ts`, re-exported from
`shared/src/index.ts`.

New client pages and catalog components under
`client/src/pages/` and `client/src/components/catalog/`. Pages are
lazy-loaded from `App.tsx` like login/register.

`app.ts` mounts:

```
app.use('/api/catalog', catalogRouter);
```

Catalog routes are not wrapped in `requireAuth` or `requireRole`.

Decimal values from Prisma are serialized with a shared helper to a
two-decimal string (example `"12999.00"`). The client formats for
display with `Intl.NumberFormat('en-IN', { style: 'currency',
currency: 'INR' })`. Never `Number(price)` for money math on the
client; listing already receives display strings and a numeric sort
key is server-side only.

---

## Route structure (client)

| Path | Page | Data |
|---|---|---|
| `/` | `HomePage` | `GET /api/catalog/home` |
| `/products` | `ProductListPage` | `GET /api/catalog/products` + `GET /api/catalog/brands` |
| `/c/:categorySlug` | `ProductListPage` | `GET /api/catalog/categories/:slug` + products with implicit category + brands |
| `/p/:productSlug` | `ProductDetailPage` | `GET /api/catalog/products/:slug` |
| `/login`, `/register`, `/account`, `/admin` | unchanged | unchanged |

There is no `/search` route. Search is `/products?q=…`.

There is no `/brands/:slug` route. Brand is a list filter.

`StorefrontLayout` stays the chrome. It additionally:

- Loads `GET /api/catalog/settings` for store name (and logo if
  `logoUrl` is non-null).
- Loads `GET /api/catalog/categories` for primary nav (top-level
  categories only in the header; children appear on the category page
  as sub-nav).
- Adds links: Shop (`/products`), category slugs, existing auth links.
- Does **not** add Cart or Wishlist links.

Unknown `/p/:slug` or `/c/:slug` render the page-level not-found
`ErrorState` (HTTP 404 from the API), not the React error boundary.

---

## API contracts

All catalog endpoints are `GET`, JSON, `{ error: { code, message } }`
on failure via the existing `errorHandler`. Success bodies are
explicit objects (no `{ data: ... }` envelope — matches auth).

Query and params are validated with `validate(schema, 'query' |
'params')` using the shared Zod schemas in
`shared/src/schemas/catalog.ts`. Express query values are strings (or
`string[]` if a key is repeated). Repeated keys that arrive as arrays
fail validation (400 `VALIDATION_ERROR`). Booleans accept only the
exact strings `true` and `false` (not `1`, `yes`, `TRUE`). Numbers are
**not** parsed with IEEE coerce-from-garbage: they must match a
bounded numeric pattern (see query schema).

Every successful catalog JSON body is described by a named Zod object
exported from `/shared`. The client must `safeParse` that schema
before rendering.

---

## Shared Zod / TypeScript contracts

File: `shared/src/schemas/catalog.ts`. Re-export from `shared/src/index.ts`.
`ContentBlockType` already exists in `shared/src/enums.ts`.

```ts
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
```

Unknown query keys fail (`.strict()`). `TRUE`, `yes`, `1` for
`inStock` fail. `page=1.5`, `page=-1`, `pageSize=49`, `sort=popular`,
`q=a` (length 1), `q` of 81 chars, `minPrice=abc`, and
`minPrice=10&maxPrice=5` all fail with 400.

---

## Category + descendant resolution

Used when `GET /api/catalog/products?category=:slug` (and the client
category page). **One** Postgres round-trip. No per-child `findMany`.

```sql
WITH RECURSIVE tree AS (
  SELECT id, "parentId", 1 AS depth
  FROM "Category"
  WHERE slug = $1
  UNION ALL
  SELECT c.id, c."parentId", tree.depth + 1
  FROM "Category" c
  INNER JOIN tree ON c."parentId" = tree.id
  WHERE tree.depth < 8
)
SELECT id FROM tree;
```

Rules:

- Bind `$1` (never interpolate the slug).
- Depth is bounded at 8 so a cycle cannot recurse forever (the schema
  does not forbid cycles).
- Empty result → `NotFoundError` (unknown slug), **not** an empty
  product list.
- The product filter is `Product.categoryId IN (SELECT id FROM tree)`
  (self + descendants).
- `GET /api/catalog/categories` does **not** use this CTE: it loads
  every category in **one** `findMany` and builds the tree in memory,
  children and roots ordered by `name ASC, id ASC`.
- `GET /api/catalog/categories/:slug` is one `findUnique` plus the
  already-loaded parent/children from that query’s `include` (still
  one round-trip).

---

## API endpoints (bodies match the Zod schemas above)

### `GET /api/catalog/settings` → `storeSettingsDtoSchema`

404 if the singleton row is missing.

### `GET /api/catalog/home` → `homeResponseSchema`

- `hero`: `heroContentSchema.safeParse(StoreSettings.heroContent)`.
  Failure or empty object → `null`.
- `blocks`: active `ContentBlock` rows ordered `position ASC, id ASC`.
  For each row, parse `payload` with
  `contentBlockPayloadSchemaByType[type]`. Failure → omit the block
  (log). `FEATURED_COLLECTION` slugs resolve to `ProductCardDto[]`
  in **stored slug order**, dropping missing/non-ACTIVE. If zero
  products remain, omit the block. Featured collection `payload` in
  the **response** is `{ title }` only — never the raw slug list, never
  the raw JSON column.
- `featured`: `ACTIVE AND featured`, ordered `createdAt DESC, id ASC`,
  max 8.

### `GET /api/catalog/categories` → `categoriesResponseSchema`

### `GET /api/catalog/categories/:slug` → `categoryDetailDtoSchema`

404 if missing. Children ordered `name ASC, id ASC`.

### `GET /api/catalog/brands` → `brandsResponseSchema`

Brands with ≥1 `ACTIVE` product, ordered `name ASC, id ASC`.

### `GET /api/catalog/products` → `productListResponseSchema`

Query: `productListQuerySchema`. Filter AND semantics. `q` matches
name **or** description **or** any variant SKU via escaped `ILIKE
'%' || escaped(q) || '%'`. Escape `\`, `%`, and `_` in `q` before
wrapping.

Effective variant price: `COALESCE(priceOverride, product.basePrice)`.
Price filter: at least one variant in range; zero-variant products
use `basePrice`.

`inStock` filter uses the availability formula above (SQL:
`("stockQty" - "reservedQty") > 0`).

Sort (always final `"Product"."id" ASC`):

| `sort` | primary |
|---|---|
| `newest` (default) | `"createdAt" DESC` |
| `name_asc` | `"name" ASC` |
| `name_desc` | `"name" DESC` |
| `price_asc` | `MIN(effective price) ASC` |
| `price_desc` | `MIN(effective price) DESC` |

Out-of-range `page` → 200, `items: []`, honest `meta`.
`totalPages` is `0` when `total` is 0, otherwise
`ceil(total / pageSize)`.

Unknown `category` or `brand` slug → 404.

### `GET /api/catalog/products/:slug` → `productDetailResponseSchema`

404 if missing or not `ACTIVE`. Images: `position ASC, id ASC`.
Variants: `createdAt ASC, id ASC`.
`product.inStock` is the product rollup (same formula as cards).
Each `variant.inStock` is `availableQty > 0` for **that** row.

The server does **not** read `?variant=`. Variant selection is
client URL state, validated against `product.variants` only.

---

## Locked JSON column payloads

Database JSON is parsed **only** through the per-type Zod schemas
above (`heroContentSchema`, `bannerPayloadSchema`,
`announcementPayloadSchema`, `featuredCollectionPayloadSchema`,
`variantAttributesSchema`). Homepage components receive
`HomeBlockDto` / `HeroContent` after that parse — never
`block.payload` as `unknown` / `Record<string, unknown>`.

Seed must write payloads that already satisfy those schemas.

Variant `attributes` keys are lowercase. Seed uses `color` on every
variant; a second key (`impedance` or `length`) is allowed. The
client renders every key/value as text; show `color` first when
present.

## Product / variant mapping rules

`Money` is produced by a server helper from Prisma `Decimal` (always
two fractional digits). Client formats with
`Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`.
Never `Number(price)` for money math on the client.

If `priceFrom === priceTo`, UI shows a single price; otherwise a
range.

Public identity: product/category/brand → slug; variant → SKU. Those
DTOs must not include Prisma UUIDs. `ContentBlock.id` is the
exception (no slug column).

A product with zero variants is a seed bug. The API still returns it;
`priceFrom`/`priceTo` are `basePrice`; `inStock` is false; PDP shows
`EmptyState` for the variant picker (“This product is unavailable”).

---

## Query / filter / search / pagination semantics (summary)

- Default sort: `newest`. Default page size: 24 (cap 48).
- Search `q` is AND-combined with filters; OR internally across
  name/description/SKU. Substring `ILIKE` only; metacharacters
  escaped. No search engine. No speculative indexes.
- Category filter is self + descendants via the bounded CTE.
- `inStock` uses `availableQty = stockQty - reservedQty` on every
  surface (filter, card, PDP product, PDP variant).
- No relevance ranking.
- Empty `q` after normalize is omitted. Length 1 is 400.
- Every list/home/tree/gallery/variant ordering ends with `id ASC`.

---

## URL state rules

The listing URL is the single source of truth. Component state is
derived from `useSearchParams`; writing filters writes the URL.

| Change | History | Params | Page |
|---|---|---|---|
| Search committed (debounce 300ms **or** submit) | `replace` | set/omit `q` | **reset to 1** (omit `page`) |
| `category` / `brand` / `minPrice` / `maxPrice` / `inStock` / `sort` | `replace` | only non-defaults | **reset to 1** |
| `pageSize` | `replace` | omit if 24 | **reset to 1** |
| Pagination | `push` | `page` omitted when `1` | keep |
| Clear filters | `replace` | drop all list params | **reset to 1** |

Defaults **must not** appear in the URL (`sort=newest`, `page=1`,
`pageSize=24` omitted).

On `/c/:categorySlug`, `category` is **not** duplicated in the query
string; it is implied by the path. The fetch still sends
`category=:slug`. Changing category navigates to another `/c/:slug`
(or `/products` when “all”) and resets page.

On `/p/:productSlug`, selected variant is `?variant=:sku` via
`replace`. Resolution:

```
skus = set of product.variants[].sku          // current PDP only
if (param is in skus) select that variant
else select first variant with inStock === true
else select variants[0]
else none (empty picker)
```

A SKU that exists on **another** product is **not** in `skus` and
must be ignored — never fetched, never displayed, never used to
change which product is shown. Do not 404 the PDP for a bad
`variant` query; ignore it and `replace` the URL to the valid
selected SKU (or omit if none).

Search input: local draft while typing; URL `q` updates after 300ms
debounce (and resets page). Abort in-flight list requests when params
change.

If `totalPages > 0 && page > totalPages` after a 200, `replace` URL
to `page=totalPages` (or omit if last page is 1).

---

## Catalog caching / data-fetching strategy

**Server** — `publicCatalogCache` middleware on `catalogRouter` only:

| Condition | `Cache-Control` |
|---|---|
| status ≥ 400 | `no-store` |
| `Authorization` header present **or** `refreshToken` cookie present | `private, max-age=15` |
| otherwise (anonymous success) | `public, max-age=15, stale-while-revalidate=60` |

Never set public cache on `/api/auth` or `/api/admin`. Catalog
handlers must not read `req.user` or include user-specific fields.
ETags are not required. No Redis.

**Client**

- No catalog context and no extra dependency.
- `apiFetch` then `schema.safeParse`; parse failure is treated as
  a server error (`ErrorState` + retry), not rendered.
- Each page fetches on mount and whenever its URL inputs change.
- `AbortController` cancelled on unmount / param change.
- Homepage: one `GET /api/catalog/home`.
- Layout chrome: settings + categories in parallel; chrome failure
  must not block the outlet (store name falls back to `"Aurelia Audio"`,
  category nav omits extra links).
- On list param change, show listing skeletons until the new request
  settles (do not keep a stale filtered grid).

---

## Loading, empty, and error states

Every catalog async boundary uses Phase 1 primitives.

| Situation | UI |
|---|---|
| First load / param change (list, home, detail) | `Skeleton` placeholders shaped like the layout (grid of cards, hero block, gallery). `LoadingState` is acceptable only for a full-page block with no layout skeleton yet. |
| Home with no featured, no blocks, no hero | Still 200. Show store name and a short empty catalog message with a Shop link — not a generic crash. |
| List `total === 0`, no filters/`q` | `EmptyState` title “No products yet”, description that the catalog is empty. |
| List `total === 0`, filters or `q` active | `EmptyState` “No matching products” + a Button that clears filters. |
| API 404 on detail/category | `ErrorState` “Product not found” / “Category not found”, no retry (retry cannot succeed). Link back to `/products`. |
| API 4xx/5xx other | `ErrorState` with `onRetry` re-running the fetch. |
| Partial home block skipped | Remaining blocks still render. |

`aria-busy` on the listing region while a replacement fetch is in
flight. Announce result count with an `aria-live="polite"` summary
(“24 products”) after load.

No blank screens. No unhandled rejections.

---

## Image strategy

- Images are HTTPS URLs stored in `ProductImage.url`. Phase 2 does
  not upload files and does not put product photos in `/client/public`
  as the catalog source.
- Seed URLs must be deterministic (stable per product slug +
  position), e.g. `https://picsum.photos/seed/{slug}-{position}/800/800`.
  `altText` is a real phrase (“Aurelia Nova over-ear headphones in
  midnight black”), never empty, never “image1”.
- Listing: one thumbnail (`loading="lazy"`, `decoding="async"`,
  explicit `width`/`height` to limit CLS).
- Home hero / PDP primary image: `fetchpriority="high"`, not lazy.
- Gallery: remaining images lazy. Clicking a thumbnail changes the
  primary image (client state only).
- Broken image: `onError` swaps to a local CSS surface placeholder
  (not a hardcoded product photo) and keeps `altText`.
- Helmet’s default CSP already allows `https:` images; do not tighten
  it in this phase in a way that breaks seed URLs.

---

## Design-system usage

Reuse Phase 1 primitives only: `Button`, `Input`, `Toast` (unused
unless a fetch retry wants a toast — prefer `ErrorState`), `Skeleton`,
`EmptyState`, `ErrorState`, `LoadingState`. Tokens from
`client/src/styles/tokens.css` via Tailwind (`bg-accent`, `text-ink`,
`text-ink-muted`, `border-border`, `bg-surface`, `rounded-md`,
`duration-snap`, `ease-standard`).

New catalog components (not a second design system):

- `ProductCard` — links to `/p/:slug`.
- `ProductGrid` — responsive grid of cards.
- `Price` — formats `Money` / range.
- `FilterBar` — search, brand, price, in-stock, sort.
- `Pagination` — prev/next when `totalPages > 1`, plus a window of
  page links: first, last, current ± 2. Do not render 50 numbered
  buttons.
- `ImageGallery`
- `VariantPicker` — one control group per attribute key, or a list of
  SKUs if attributes are heterogeneous.

No new color literals, no new font stacks, no `transition` durations
other than the tokenized snap/base. Button press still uses
`active:scale-[0.97]`. Do not add a cart-shaped primary CTA; the PDP
primary content is price + availability. A text link “Continue
browsing” to `/products` is allowed.

---

## Responsive behavior

Breakpoints: Tailwind defaults (`sm` 640, `md` 768, `lg` 1024).

- **Home hero:** full-width image/title stack on small screens;
  two-column from `md`.
- **Product grid:** 1 column default, 2 from `sm`, 3 from `lg`.
- **Filters:** stacked above the grid on small screens; a
  `<details>`/disclosure labelled “Filters” collapsed by default
  below `md`. From `md`, filters stay visible above or beside the
  grid (beside from `lg`).
- **PDP:** image stack then info on small screens; two columns from
  `md` (gallery left, info right).
- Header nav: category links may collapse into a “Shop” menu below
  `md` (native `<details>` or a Button-toggled list). No hamburger
  library.
- Touch targets ≥ 44px for pagination, variant chips, and nav.

---

## Accessibility

- `html` already has `lang="en"`.
- Each page has exactly one `h1`. After navigation, move focus to the
  `h1` (`tabIndex={-1}` + `.focus()`).
- Search field has a visible `<label>` (existing `Input` API).
- `FilterBar` is a `<form>` with an accessible name (“Filter
  products”).
- `Pagination` is `<nav aria-label="Pagination">`; current page
  `aria-current="page"`; disabled prev/next stay in the tab order
  with `aria-disabled`.
- `VariantPicker` uses `role="radiogroup"` per attribute with
  `aria-checked` on the selected chip. Color is never the only
  signal: the chip text is the color name.
- Images always have `alt` from the API.
- `prefers-reduced-motion` already globally shortens transitions —
  do not add uncancellable animations.
- `prefers-contrast: more` already strengthens borders — do not
  reduce contrast on cards.
- Keyboard: listing filters and pagination fully operable; gallery
  thumbnails are buttons, not click-only divs.
- Skip link (“Skip to products”) on list/home targeting the listing
  `id`.

---

## Performance constraints

- One list request per URL state; no per-card fetches.
- Prisma `include` (or equivalent) must not N+1 variants/images.
  Listing DTO mapping happens in memory after a bounded query.
- `pageSize` hard-capped at 48 in Zod (server).
- Home featured capped at 8; collection block capped at 8 slugs.
- Catalog pages stay lazy routes in `App.tsx`.
- Production client build must still emit no `.map` files (Phase 1
  gate).
- No new runtime CSS-in-JS. No unoptimized giant image lists without
  `width`/`height`.
- Do not download every product image on the list page — thumbnail
  only.

---

## Seed-data strategy

Extend `server/prisma/seed.ts` (still refuses `NODE_ENV=production`).
Idempotent on re-run:

- Categories and brands upserted by `slug`.
- Products upserted by `slug`; **update** name, description, prices,
  status, featured, category/brand linkage, seo fields (unlike the
  Phase 1 user upsert `update: {}`).
- Variants upserted by `sku`; images for a product replaced as a set
  (delete existing images for that product, insert canonical rows) so
  positions/URLs stay correct.
- Content blocks: `deleteMany` then insert the canonical active set
  (stable content, not user data).
- `StoreSettings` `update` writes `storeName`, `heroContent`,
  `contactEmail` so a stale empty `heroContent: {}` from Phase 1 is
  replaced.

Scale (minimums):

- ≥ 5 categories with at least one parent/child pair (example:
  Headphones → Over-ear, In-ear; Home audio → DACs, Amplifiers;
  Accessories → Cables).
- ≥ 4 brands.
- ≥ 20 `ACTIVE` products, ≥ 1 `DRAFT`, ≥ 1 `ARCHIVED` (the latter two
  must never appear in any public API).
- Each active product: ≥ 1 variant and ≥ 2 images.
- Mix: in-stock, at least one fully out-of-stock product, at least
  one product with mixed in-stock / OOS variants, at least one
  `priceOverride`, at least 4 `featured: true`.
- ≥ 3 content blocks: one of each `ContentBlockType`, all `active`.
- Copy and prices should read as a high-end audio shop in INR, not
  “Test Product 1”.

Stable slugs/SKUs are part of the contract so tests and Playwright
can assert against them. Required fixtures:

| Kind | Slug / SKU |
|---|---|
| Featured over-ear | `aurelia-nova` |
| In-ear with price override variant | `sable-ion` |
| Out-of-stock product | `northwind-restock` |
| Mixed-stock variants | `helix-lineage` |
| Draft (must 404) | `aurelia-lab-prototype` |
| Archived (must 404) | `helix-classic-v1` |
| Known SKU for search | `NOV-BLK-00` |

---

## Testing strategy

### Unit (Vitest)

- Catalog Zod schemas: defaults; `q` length 1 rejected; whitespace
  normalized; `maxPrice < minPrice` rejected; `pageSize` 49 rejected;
  `sort` unknown rejected; `inStock=TRUE` rejected; `InternalPath`
  rejects `https://evil.example`; response schemas reject extra
  product UUID fields if tests construct them.
- Helpers: effective price, `availableQty` / `inStock`, money
  serialization (`Decimal` → `"10.50"`), ILIKE escape.

### Integration (Vitest + Supertest, `audio_commerce_test`)

Use `resetDb()` then insert fixtures (or invoke seed in a dedicated
test). Assert:

- List returns only `ACTIVE`.
- Draft/archived slugs 404.
- `q` matches name and SKU; does not match a draft.
- `category` includes descendant products (grandchild of a nested
  tree) via **one** CTE (assert with query logging or by structure:
  only the parent slug is passed); unknown slug 404s.
- Two products sharing `createdAt` and `name` still have a stable
  `id ASC` order across pages.
- `brand`, price range, `inStock` filters AND together.
  `inStock=true` includes a product whose only in-stock variant has
  `stockQty=5, reservedQty=4`; excludes `stockQty=1, reservedQty=1`.
- `sort=price_asc` orders by min effective price then `id`.
- Pagination `meta.total` / page slice; out-of-range page is 200
  empty items.
- Home featured omits draft; collection omits missing slugs; invalid
  content-block JSON is omitted; remaining typed blocks return.
- Public catalog GET does not require `Authorization`.
- Anonymous 200 sets `Cache-Control` containing
  `public` and `max-age=15`. The same GET with
  `Authorization: Bearer x` sets `private`, not `public`. 404 sets
  `no-store`.

Auth rate-limiter skip in `NODE_ENV=test` remains; do not attach that
limiter to catalog routes.

### Component (Vitest + Testing Library)

- `ProductCard` links to `/p/:slug` and shows `EmptyState`-safe
  missing thumbnail.
- `ProductListPage`: changing sort writes the URL without `sort` when
  returning to newest **and omits `page`** (reset to 1); changing
  `page` uses history `push`; shows EmptyState + clear action when
  the API returns zero items with `q` set.
- `ProductDetailPage`: variant click updates `?variant=` and displayed
  price; OOS variant is selectable but marked unavailable
  (`inStock === false`); a `?variant=` SKU from another product is
  ignored and replaced with a SKU from the current product.
- `Pagination` uses `push` (mock `useSearchParams` / router).

### E2E (Playwright) — introduced this phase

Small smoke only, against `npm run dev` (Vite + Express) with seed
applied to the **development** database (never `resetDb()` there):

1. Home shows the heading from hero or store name, and a seeded
   featured card `aurelia-nova`.
2. Opening that card reaches `/p/aurelia-nova` and shows SKU
   `NOV-BLK-00`.
3. `/products?q=NOV-BLK` lists `aurelia-nova`.
4. `/p/aurelia-lab-prototype` shows not-found UI.

Playwright is a new root/devDependency. It is not a product feature.
If CI has no browsers, document `npx playwright install` in the plan;
do not skip the tests.

---

## Acceptance criteria

Phase 2 is done when all of the following are true:

1. `npm run lint`, `npm run typecheck`, `npm run test`, `npm run
   build`, `git diff --check` pass from a clean checkout (typecheck
   remains self-contained via the Phase 1 hygiene `build -w shared`
   prefix). Playwright smoke passes locally after seed + `npx
   playwright install`.
2. Homepage, `/products`, `/c/:slug`, `/p/:slug` render from REST
   payloads. Grep of `client/src` finds no product name/price/slug
   literals used as catalog data (test fixtures and route constants
   excepted).
3. Draft and archived seeded products never appear in list, search,
   home, or collection blocks; their detail URL is a not-found page.
4. Search, category (with descendants), brand, price, in-stock, sort,
   and pagination match this spec’s AND semantics; shareable listing
   URLs restore the same results.
5. PDP shows images in `position` order, variant prices including
   `priceOverride`, and `availableQty`-based in-stock state on both
   the product rollup and each variant. `?variant=` only accepts a
   SKU of the current product. There is no add-to-cart or checkout
   control.
6. Production rate limiting, JWT cookie flags, and RBAC middleware
   are unchanged. Catalog routes are public GETs only. Public cache
   is short-lived and never applied to user-specific or auth
   responses.
7. Seed can be re-run safely and leaves the required fixtures above
   in Postgres.
8. Loading, empty, error, reduced-motion, and labelled controls meet
   the UI sections of this spec.
9. No cart, wishlist, order, review, coupon, or admin CRUD endpoints
   or pages are added.

---

## File map (for the later implementation plan)

```
shared/src/schemas/catalog.ts
shared/src/schemas/catalog.test.ts
server/src/modules/catalog/catalog.routes.ts
server/src/modules/catalog/catalog.controller.ts
server/src/modules/catalog/catalog.service.ts
server/src/modules/catalog/categoryTree.ts   # bounded recursive CTE
server/src/modules/catalog/money.ts
server/src/modules/catalog/availability.ts
server/src/modules/catalog/cacheControl.ts
server/src/modules/catalog/mapProduct.ts     # Prisma row → DTO
server/test/catalog.integration.test.ts
server/test/catalog.categories.test.ts
server/prisma/seed.ts                        # extended, not replaced
client/src/lib/parseCatalog.ts               # safeParse helpers
client/src/pages/HomePage.tsx
client/src/pages/ProductListPage.tsx
client/src/pages/ProductDetailPage.tsx
client/src/components/catalog/*
client/src/App.tsx
client/src/layouts/StorefrontLayout.tsx
e2e/catalog.spec.ts
playwright.config.ts
```

Existing auth, inventory decrement, and admin placeholder remain the
Phase 1 implementations.
