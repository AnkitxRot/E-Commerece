# Phase 2: Public Catalog Storefront — Design Spec

Date: 2026-09-12
Status: Ready for review (not approved for implementation planning until this file is accepted)

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
- Contracts: Zod schemas in `/shared`, imported by server (authoritative)
  and client (UX validation / typing only).
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

Variant availability is computed, never stored as a new column:

```
availableQty = stockQty - reservedQty
inStock      = availableQty > 0
```

Do not expose `stockQty`, `reservedQty`, or `lowStockThreshold` on
public DTOs.

**Accepted schema limitations (not blockers):**

- `ProductImage` is product-scoped. Changing variant does not swap the
  gallery. Color is communicated with the variant attribute label.
- `ContentBlock.payload` and `StoreSettings.heroContent` are untyped
  JSON. This spec locks their shapes; invalid payloads are skipped,
  not migrated.
- No `pg_trgm` / tsvector. Search is case-insensitive substring match
  at seed scale (tens of products, not millions).

A Prisma migration is allowed only if implementation discovers a
concrete blocker (for example a missing index that makes a required
query incorrect, not merely slower). Additive indexes are permitted;
new tables, renamed columns, and variant-image FKs are not.

---

## Decisions (alternatives considered)

**Pagination — offset `page` + `pageSize` with a total count**
(not cursor, not infinite scroll). Listing URLs must be shareable as
`?page=2`. Cursor pagination fights numbered pagination and filter
chips. Catalog size is small; `OFFSET` is acceptable.

**Search — Postgres `ILIKE` via Prisma `contains` + `mode:
'insensitive'`** on product name, description, and variant SKU (not
Elasticsearch, not `pg_trgm` in this phase). A search index would be a
schema/ops expansion without a demonstrated scale need.

**Client data fetching — route-driven `apiFetch` + `AbortController`**
(not TanStack Query, not a global catalog store). Phase 1 has no
client cache library. The URL is the source of truth for list state.
Adding a cache library would be a new runtime architecture.

**Server cache — short public `Cache-Control` on catalog GETs**
(not Redis). Listings can go slightly stale on stock; Phase 2 does
not sell, so a 15-second public cache is enough. Authenticated
`/api/auth/*` behavior is unchanged.

---

## Architecture

Route → controller → service → Prisma. Same as auth.

New server module: `server/src/modules/catalog/`
(`catalog.routes.ts`, `catalog.controller.ts`, `catalog.service.ts`).
No writes except the existing seed script.

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
'params')`. Express query values are strings; schemas **coerce**
numbers and booleans. A repeated query key that arrives as `string[]`
fails validation (400 `VALIDATION_ERROR`).

### `GET /api/catalog/settings`

Public store chrome.

```
{
  storeName: string,
  logoUrl: string | null,
  contactEmail: string
}
```

404 if the singleton row is missing (seed always creates it).

### `GET /api/catalog/home`

```
{
  hero: HeroDto | null,
  blocks: HomeBlockDto[],
  featured: ProductCardDto[]
}
```

- `hero` is `StoreSettings.heroContent` parsed against `heroContentSchema`.
  If parse fails or the object is empty, `hero` is `null`.
- `blocks` are `ContentBlock` rows with `active = true`, ordered by
  `position` ascending, `id` ascending. Each row is parsed against the
  payload schema for its `type`. Invalid payloads are omitted (logged
  server-side), not returned as errors.
- `featured` is `Product.status = ACTIVE AND featured = true`, ordered
  by `createdAt` desc, `id` desc, **maximum 8** cards. No pagination
  meta.

`HomeBlockDto` (content blocks have no slug; `id` is the only stable
key and is allowed here):

```
{ id: string, type: 'BANNER', position: number, payload: BannerPayload }
| { id: string, type: 'ANNOUNCEMENT', position: number, payload: AnnouncementPayload }
| { id: string, type: 'FEATURED_COLLECTION', position: number,
    payload: { title: string }, products: ProductCardDto[] }
```

`FEATURED_COLLECTION` slugs that are missing, draft, or archived are
dropped. Remaining products keep the **stored slug order**. If none
remain, the block is omitted.

### `GET /api/catalog/categories`

```
{ categories: CategoryTreeNode[] }
```

`CategoryTreeNode`: `{ slug, name, children: CategoryTreeNode[] }`.
The array contains **root** categories (`parentId` null). Every
category row is included (empty categories are allowed; their listing
page shows `EmptyState`).

### `GET /api/catalog/categories/:slug`

```
{
  slug: string,
  name: string,
  parent: { slug: string, name: string } | null,
  children: { slug: string, name: string }[]
}
```

404 `NOT_FOUND` if the slug does not exist.

### `GET /api/catalog/brands`

```
{ brands: { slug: string, name: string, logoUrl: string | null }[] }
```

Only brands that have at least one `ACTIVE` product, ordered by name
ascending.

### `GET /api/catalog/products`

List query (all optional except defaults):

| Param | Rule |
|---|---|
| `q` | Trimmed; if present, min 2 and max 80 chars. |
| `category` | Category slug. On `/c/:categorySlug` the client **must** send this param matching the path. Include the category and **all descendants**. Unknown slug → 404 (not an empty list). |
| `brand` | Brand slug. Unknown slug → 404. |
| `minPrice` | Inclusive minimum effective price (rupees). Coerced number, `>= 0`, max 1_000_000. |
| `maxPrice` | Inclusive maximum effective price. If both set, `maxPrice >= minPrice`. |
| `inStock` | `true` or `false`. `true` = at least one variant with `availableQty > 0`. `false` = every variant `availableQty === 0`. |
| `sort` | `newest` (default), `price_asc`, `price_desc`, `name_asc`, `name_desc`. |
| `page` | 1-indexed integer, default `1`, min `1`. |
| `pageSize` | default `24`, min `1`, max `48`. |

A product matches **all** provided filters (AND). `q` matches if the
term appears in `name` **or** `description` **or** any variant `sku`
(case-insensitive substring).

Effective unit price of a variant: `priceOverride ?? product.basePrice`.

Price filter: the product matches if **at least one** variant’s
effective price is inside `[minPrice, maxPrice]` (missing bound =
unbounded). A product with zero variants is compared using `basePrice`
as its sole effective price.

Sort keys:

- `newest`: `createdAt DESC`, `id DESC`.
- `name_*`: `name`, then `id`.
- `price_*`: `MIN(effective variant price)` across **all** variants of
  that product (not only in-stock), then `id`. Zero-variant products
  sort by `basePrice`.

Response:

```
{
  items: ProductCardDto[],
  meta: {
    page: number,
    pageSize: number,
    total: number,
    totalPages: number   // 0 when total is 0
  }
}
```

Out-of-range `page` (e.g. page 9 of 2) returns **200** with `items:
[]` and honest `meta`. The client, if `totalPages > 0 && page >
totalPages`, replaces the URL to `page=totalPages`.

### `GET /api/catalog/products/:slug`

200 `{ product: ProductDetailDto }` or 404 if missing / not `ACTIVE`.

---

## Locked JSON payload shapes

These are application contracts for JSON columns. They are **not**
Prisma migrations.

`heroContentSchema`:

```
{
  title: string,              // 1–80
  subtitle?: string,          // max 200
  imageUrl?: string,          // https URL
  ctaLabel?: string,          // max 40
  ctaHref?: InternalPath      // see below
}
```

`BannerPayload`: same fields as hero.

`AnnouncementPayload`: `{ message: string, href?: InternalPath }`.

`FeaturedCollectionPayload` (stored): `{ title: string, productSlugs:
string[] }` with 1–8 slugs. The API response replaces slugs with
resolved `products: ProductCardDto[]`.

`InternalPath`: string starting with `/`, not starting with `//`, no
`http:`/`https:` scheme. This blocks open redirects in seed/content
CTAs. Allowed examples: `/products`, `/c/over-ear`,
`/p/aurelia-nova`.

Variant `attributes` JSON is `Record<string, string>` with stable
lowercase keys. Seed uses `color` on every variant; a second key
(`impedance` or `length`) is allowed where it is real. The client
renders every key/value as text; it does not assume a closed key set
beyond showing `color` first when present.

---

## Product / variant response shapes

`Money` = string matching `/^\d+\.\d{2}$/`.

`ImageDto`: `{ url: string, altText: string, position: number }`.

`ProductCardDto` (list, featured, collection):

```
{
  slug: string,
  name: string,
  brand: { slug: string, name: string } | null,
  category: { slug: string, name: string },
  priceFrom: Money,          // min effective variant price
  priceTo: Money,            // max effective variant price
  thumbnail: ImageDto | null, // lowest position image, else null
  inStock: boolean,           // any variant availableQty > 0
  featured: boolean
}
```

If `priceFrom === priceTo`, the UI shows a single price; otherwise a
range (“₹A – ₹B”).

`VariantDto`:

```
{
  sku: string,
  attributes: Record<string, string>,
  price: Money,               // effective price
  inStock: boolean,
  availableQty: number
}
```

`ProductDetailDto`:

```
{
  slug: string,
  name: string,
  description: string,
  seoTitle: string | null,
  seoDescription: string | null,
  brand: { slug: string, name: string, logoUrl: string | null } | null,
  category: { slug: string, name: string },
  featured: boolean,
  images: ImageDto[],          // ordered by position asc, id asc
  variants: VariantDto[],      // stable order: createdAt asc, sku asc
  priceFrom: Money,
  priceTo: Money
}
```

Public identity for products, categories, and brands is slug; for
variants it is SKU. Those DTOs must not include Prisma UUIDs.
`ContentBlock.id` is the exception (no slug column).

A product with zero variants is a seed bug. The API still returns it;
`priceFrom`/`priceTo` are the `basePrice`; `inStock` is false;
detail shows `EmptyState` for the variant picker (“This product is
unavailable”).

---

## Query / filter / search / pagination semantics (summary)

- Default sort: `newest`.
- Default page size: 24 (cap 48).
- Search `q` is AND-combined with filters; OR internally across
  name/description/SKU.
- Category filter is hierarchical (self + descendants).
- `inStock=true` means “purchasable today if cart existed”; it uses
  `availableQty`, not `stockQty`.
- No relevance ranking. `q` + `sort=newest` is valid.
- Empty `q` after trim is treated as omitted.
- `q` of length 1 is 400, not a broad scan.

---

## URL state rules

The listing URL is the single source of truth. Component state is
derived from `useSearchParams`; writing filters writes the URL.

| Change | History | Params written |
|---|---|---|
| Search text committed (debounce 300ms **or** submit) | `replace` | `q`; omit if empty |
| Filter / sort / pageSize | `replace` | only non-default values |
| Pagination | `push` | `page` omitted when `1` |
| Clear filters | `replace` | drop all list params |

Defaults **must not** appear in the URL (`sort=newest`, `page=1`,
`pageSize=24` are omitted).

On `/c/:categorySlug`, `category` is **not** duplicated in the query
string; it is implied by the path. The fetch still sends
`category=:slug` to the API. Changing category navigates to another
`/c/:slug` (or `/products` when “all”).

On `/p/:productSlug`, selected variant is `?variant=:sku` via
`replace`. If the param is missing or unknown, select the first
in-stock variant, else the first variant. Do not 404 the page for a
bad `variant` query; ignore it.

Search input: local draft string while typing; URL `q` updates after
300ms debounce. Abort in-flight list requests when params change.

---

## Catalog caching / data-fetching strategy

**Server**

```
Cache-Control: public, max-age=15, stale-while-revalidate=60
```

on every successful catalog GET. Error responses: `Cache-Control:
no-store`. No `Vary: Cookie` (catalog ignores auth). ETags are not
required.

**Client**

- No catalog context and no extra dependency.
- Each page fetches on mount and whenever its URL inputs change.
- `AbortController` cancelled on unmount / param change.
- Homepage: one `GET /api/catalog/home` (not three waterfalls).
- Layout chrome: settings + categories in parallel; failure of chrome
  fetches must not block the page outlet (store name falls back to
  the literal `"Aurelia Audio"` already in `StorefrontLayout`,
  categories nav simply omits extra links).
- After a successful fetch, render from that response until the next
  fetch settles. Do not keep a stale **filtered** list when params
  change: show listing skeletons while the new request is in flight.

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

- Catalog Zod schemas: defaults, `q` length 1 rejected, `maxPrice <
  minPrice` rejected, `pageSize` 49 rejected, `sort` unknown
  rejected, `InternalPath` rejects `https://evil.example`.
- Helpers: effective price, `availableQty`, hierarchical category id
  expansion, money serialization (`Decimal` → `"10.50"`).

### Integration (Vitest + Supertest, `audio_commerce_test`)

Use `resetDb()` then insert fixtures (or invoke seed in a dedicated
test). Assert:

- List returns only `ACTIVE`.
- Draft/archived slugs 404.
- `q` matches name and SKU; does not match a draft.
- `category` includes descendant products and 404s unknown slugs.
- `brand`, price range, `inStock` filters AND together.
- `sort=price_asc` orders by min effective price.
- Pagination `meta.total` / page slice; out-of-range page is 200
  empty items.
- Home featured omits draft; collection omits missing slugs.
- Invalid content-block payload is omitted, remaining blocks return.
- Public catalog GET does not require `Authorization`.

Auth rate-limiter skip in `NODE_ENV=test` remains; do not attach that
limiter to catalog routes.

### Component (Vitest + Testing Library)

- `ProductCard` links to `/p/:slug` and shows `EmptyState`-safe
  missing thumbnail.
- `ProductListPage`: changing sort writes the URL without `sort` when
  returning to newest; shows EmptyState + clear action when the API
  returns zero items with `q` set.
- `ProductDetailPage`: variant click updates `?variant=` and displayed
  price; OOS variant is selectable but marked unavailable.
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
   `priceOverride`, and `availableQty`-based in-stock state. There is
   no add-to-cart or checkout control.
6. Production rate limiting, JWT cookie flags, and RBAC middleware
   are unchanged. Catalog routes are public GETs only.
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
server/src/modules/catalog/catalog.routes.ts
server/src/modules/catalog/catalog.controller.ts
server/src/modules/catalog/catalog.service.ts
server/src/modules/catalog/money.ts          # Decimal → Money
server/test/catalog.integration.test.ts
server/prisma/seed.ts                        # extended, not replaced
client/src/pages/HomePage.tsx
client/src/pages/ProductListPage.tsx
client/src/pages/ProductDetailPage.tsx
client/src/components/catalog/*              # Card, Grid, Price, FilterBar,
                                             # Pagination, ImageGallery, VariantPicker
client/src/App.tsx                           # new lazy routes
client/src/layouts/StorefrontLayout.tsx      # settings + category nav
```

Existing auth, inventory decrement, and admin placeholder remain the
Phase 1 implementations.
