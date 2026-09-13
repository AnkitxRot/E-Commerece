# Category + Brand Management — Design Spec

Date: 2026-09-14
Status: Implemented and verified this session.

## Objective

The 2026-09-13 admin management milestone explicitly scoped Category/Brand
CRUD *out* ("lookups only — creating/renaming them isn't needed to
demonstrate the milestone"). Since then, categories and brands remain
seed-managed only: the only server-side surface is a pair of `{id, name}`
lookup endpoints powering the product form's dropdowns. This milestone
gives admins real create/edit/deactivate control over both, enabling actual
catalog self-service instead of direct database/seed edits.

## Current-state findings (before implementation)

- `Category` and `Brand` Prisma models already exist with slug/name
  (Category also has `parentId`/`parent`/`children` for hierarchy, Brand
  has `logoUrl`). Neither model had an active/inactive flag.
- `GET /api/admin/categories` and `GET /api/admin/brands`
  (`lookups.{routes,controller,service}.ts`) returned bare `{id, name}`
  lists with no create/update/deactivate/delete.
- Public catalog already had a bounded recursive-CTE category tree
  (`categoryTree.ts`, `MAX_CATEGORY_DEPTH = 8`) and brand listing
  (`getBrands()`, filtered to brands with at least one ACTIVE product).
- No admin UI existed for either entity beyond the product form's
  dropdowns.

## Scope

In scope:

- `Category`/`Brand` gain an `isActive` boolean (`@default(true)`, so
  every existing row stays active — non-breaking migration).
- Admin CRUD for both: list (all rows, admin sees inactive too),
  create, update (name/slug/parent for Category; name/slug/logoUrl for
  Brand), activate/deactivate, and a safe delete that is refused with
  `409 Conflict` when the row is still referenced (by a product, or —
  for Category — by a child category).
- Category hierarchy: `parentId` on create/update, with server-side
  cycle prevention (a category can never become its own ancestor) and
  a depth check reusing the existing `MAX_CATEGORY_DEPTH` bound.
- Slug validation reusing the existing `slugSchema`; uniqueness
  enforced with `409 Conflict` on collision, independent of casing
  since the schema already only accepts lowercase kebab-case.
- Product admin form now shows *all* categories/brands (including
  inactive ones, labeled "(inactive)") so editing a product that
  already references a since-deactivated category/brand keeps working;
  newly assigning an inactive category/brand to a product is rejected
  server-side.
- Public catalog: an inactive category is excluded from the public
  category tree, its own detail lookup, and `?category=slug` filtering
  by its own slug (mirroring how `Product.status !== ACTIVE` already
  hides products) — and, since the tree assembly only descends into a
  node's children once that node itself is included, an inactive
  category's descendants also drop out of tree navigation even though
  each descendant remains independently resolvable by its own slug if
  it is itself still active (deactivation isn't an ancestor-cascading
  flag — only the row you deactivate stops being browsable/filterable
  directly). An inactive brand is excluded from `GET
  /api/catalog/brands` and from `?brand=slug` filtering. Existing
  products keep their classification either way — nothing about a
  product is changed by deactivating its category/brand.
- Audit logging for every category/brand create/update/
  activate/deactivate/delete.

Out of scope (explicitly, for this milestone):

- Destructive cascade delete (deleting a category/brand that is still
  referenced). Deactivation is the primary lifecycle control; delete
  is a secondary, guarded action for genuinely-unused rows only.
- A drag-and-drop or visual hierarchy editor for categories — the
  admin form is a flat list with a "Parent category" select.
- Category/brand image management beyond the existing `Brand.logoUrl`
  URL field (no upload UI — same limitation the product image model
  already has).
- Bulk operations, CSV import/export.

## Database impact

One additive migration: `isActive Boolean @default(true) @@index` on
`Category` and `Brand`. No data loss, no existing-row impact, no
change to `Product.categoryId`/`Product.brandId` semantics.

## API endpoints

New, under `/api/admin`, behind the same router-level
`requireAuth` + `requireRole(ADMIN)`:

- `GET /categories` — full list (superset of the old lookup shape:
  `{id, name}` is still present, so nothing that read the old response
  breaks).
- `POST /categories` — create `{slug, name, parentId?}`.
- `PATCH /categories/:id` — update `{name?, slug?, parentId?,
  isActive?}`.
- `DELETE /categories/:id` — `409` if any product or child category
  references it, else deletes.
- `GET /brands`, `POST /brands`, `PATCH /brands/:id`,
  `DELETE /brands/:id` — mirrors Category, without hierarchy.

The old flat `lookups.*` module is removed; its two GET routes are now
served by the fuller `categories`/`brands` modules (folder-per-feature,
matching `admin/orders` and `admin/reviews`).

## Request/response contracts

`shared/src/schemas/admin.ts` gains
`createCategoryInputSchema`/`updateCategoryInputSchema`/
`adminCategoryDtoSchema`/`adminCategoryListResponseSchema` and the
Brand equivalents. The old lookup-only `adminOptionDtoSchema`/
`AdminCategoriesResponse`/`AdminBrandsResponse` (bare `{id, name}`,
used only by the product form) are removed — the product form now
consumes the same full `AdminCategoryDto`/`AdminBrandDto` list the new
management pages use, so there is exactly one category/brand list
contract, not two. `{id, name}` remain present on the full DTO, so the
existing `admin.products.test.ts` assertions against those fields
still pass unchanged.

## Validation

- `createCategoryInputSchema`/`updateCategoryInputSchema`: `slug` via
  the existing `slugSchema`; `parentId` is `z.string().uuid().nullable()`.
  Service-layer checks (can't be expressed in Zod alone): parent must
  exist, parent can't be the category itself, parent can't be a
  descendant of the category (cycle), resulting depth can't exceed
  `MAX_CATEGORY_DEPTH`.
- Slug/name collisions: `409 Conflict`, matching the existing
  Product-slug and Variant-SKU conflict pattern.
- Product mutation now validates `categoryId`/`brandId` existence
  *and* `isActive` — but only for fields the caller is actually
  changing, never re-validating an untouched existing reference (so
  deactivating a category doesn't retroactively break unrelated edits
  to products already classified under it).

## Authorization

Same router-level `requireAuth` + `requireRole(Role.ADMIN)` as every
other `/api/admin/*` route. No new authorization pattern introduced.

## Frontend routes

- `/admin/categories` — list + inline create/edit/activate-deactivate
  (`AdminCategoriesPage`).
- `/admin/brands` — same shape (`AdminBrandsPage`).

Both nested under the existing `AdminLayout`, added to its nav.

## State/data flow

Same `useState` + `useEffect` fetch-on-mount pattern as every other
admin page — no new client cache library.

## Error handling / loading / empty states

Same `Skeleton`/`ErrorState`/`EmptyState`/`Toast`/per-field `Input`
`error` conventions as the rest of the admin area.

## Accessibility

Every control has an associated `<label>` or `aria-label`; status/
error messages use `role="alert"`; no custom keyboard widgets.

## Testing

- Server: `admin.categories.test.ts`, `admin.brands.test.ts` — RBAC
  (401/403), CRUD, validation failures, slug conflicts, cycle/depth
  rejection, delete blocked while referenced, delete allowed once
  unreferenced, audit rows written.
- `admin.products.test.ts` gains cases for inactive category/brand
  rejection on create/update.
- `catalog.integration.test.ts` / `categoryTree.test.ts` gain cases
  for inactive category/brand exclusion from public endpoints.
- Client: `AdminCategoriesPage.test.tsx`, `AdminBrandsPage.test.tsx` —
  loading/error/empty/success, create form validation, activate/
  deactivate action, product form rendering inactive options.
- E2E: extends `e2e/admin.spec.ts` — admin creates a category and a
  brand, uses both in a new product, then deactivates the category and
  confirms it no longer appears in the public category tree.

## Non-goals

Multi-level drag hierarchy editing, category/brand imagery beyond the
existing URL fields, bulk import/export, real deletion of referenced
rows.
