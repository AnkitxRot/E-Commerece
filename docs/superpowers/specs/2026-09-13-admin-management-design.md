# Admin Management — Design Spec

Date: 2026-09-13
Status: Implemented and verified this session.

## Objective

Replace the `/api/admin` placeholder (a single `GET /overview` route
returning `{ message: 'Admin area placeholder' }`) with real store
management: a dashboard, product CRUD with stock/pricing control, and
order status management — the highest-value missing capability
identified by inspecting the current repository (customer storefront,
cart, checkout, and order history were already implemented and
tested; admin was not).

## Scope

In scope:

- Dashboard: product/order counts, recognized revenue, low-stock
  count, recent orders.
- Products: list (search + status filter + pagination), detail,
  create (with an initial variant), update (name/description/
  category/brand/price/status/featured/SEO/specs), and per-variant
  stock/threshold/price updates.
- Orders: list (status filter + pagination), detail, and status
  transitions constrained to a fixed transition graph.
- Category/brand `{id, name}` lookups powering the product form's
  dropdowns.
- Audit logging (`AuditLog`) for every product/variant/order mutation.

Out of scope (explicitly, for this milestone):

- Category/Brand CRUD (lookups only — creating/renaming them isn't
  needed to demonstrate the milestone and the public catalog's
  category tree is curated content, not a bulk-editable list here).
- Coupon management, review moderation, store settings/content block
  editing — real models exist for these but none were prioritized
  over dashboard/products/orders for a first admin milestone.
- Adding new variants to an *existing* product through the UI (only
  at product-creation time). The API's `updateVariant` only edits an
  existing variant.
- Order cancellation/refund UI beyond what the status-transition
  control already allows (CANCELLED/REFUNDED are reachable states in
  the transition graph).
- Editing a product's `slug` after creation (avoids silently breaking
  any external link to `/p/:slug`).

## Existing functionality reused

- `requireAuth` / `requireRole(Role.ADMIN)` middleware (already
  existed and was already tested via `rbac.integration.test.ts`).
- The `route → controller → service → Prisma` layering, `validate`
  middleware, `AppError` hierarchy, and `toMoney`/`toMoneyNullable`
  helpers from the catalog module.
- `inventory`'s `availableQty`/stock concepts (low-stock is computed
  the same way: `stockQty - reservedQty <= lowStockThreshold`).
- The `Cart`/`Order`/`Review`/`Coupon`/`AuditLog` Prisma models —
  already defined in the Phase 1 schema, unused until now.
- The design system (`Button`, `Input`, `Skeleton`, `EmptyState`,
  `ErrorState`, design tokens) and the `apiFetch` + `parseCatalog`
  client data-fetching pattern.

## Database impact

None. No new models or fields — this milestone reads and writes
existing `Product`, `ProductVariant`, `Order`, `Category`, `Brand`,
and `AuditLog` rows only.

## API endpoints

All under `/api/admin`, behind `requireAuth` + `requireRole(ADMIN)`
applied once at the router level (`admin.routes.ts`):

- `GET /overview` — dashboard summary.
- `GET /categories`, `GET /brands` — `{id, name}` options.
- `GET /products` — `?page&pageSize&status&q`.
- `POST /products` — create (with `variants: [...]`, min 1).
- `GET /products/:id` — full detail (for the edit form).
- `PATCH /products/:id` — partial update.
- `PATCH /products/:id/variants/:variantId` — stock/threshold/price.
- `GET /orders` — `?page&pageSize&status`.
- `GET /orders/:id` — full detail incl. customer and items.
- `PATCH /orders/:id/status` — `{ status }`, transition-checked.

## Request/response contracts

`shared/src/schemas/admin.ts` — every request body/query and response
shape is a Zod schema shared by server (`validate` middleware) and
client (`parseCatalog` at every fetch site). No duplicated DTOs.

## Validation

- `createProductInputSchema` / `updateProductInputSchema`: money
  fields via the existing `moneySchema` (`"1234.00"` string, never
  floating point), `categoryId`/`brandId` existence checked in the
  service (404-equivalent `ValidationError`, 400), slug and SKU
  uniqueness checked before insert (`ConflictError`, 409).
- `updateOrderStatusInputSchema`: `status` must be a valid
  `OrderStatus` enum member; the *transition* itself
  (e.g. `PENDING → CONFIRMED` is legal, `PENDING → DELIVERED` is not)
  is checked in `orders.service.ts` against an explicit transition
  map, independent of the enum-membership check — never an arbitrary
  jump.

## Authorization

- Every `/api/admin/*` route requires a valid JWT **and** the ADMIN
  role — enforced once at the router (`adminRouter.use(requireAuth,
  requireRole(Role.ADMIN))`), so no individual route can accidentally
  skip it.
- The client's `ProtectedRoute` role check is UX-only (redirects a
  non-admin before they see a 403); the server independently
  re-verifies on every request. Client-supplied role claims are never
  trusted for anything.
- Order detail reuses the existing ownership pattern from the
  customer orders module (owner or ADMIN); the admin list/detail
  routes have no ownership constraint since ADMIN sees every order.

## Frontend routes

- `/admin` — dashboard (`AdminOverviewPage`)
- `/admin/products` — list (`AdminProductsPage`)
- `/admin/products/new`, `/admin/products/:id` — create/edit
  (`AdminProductFormPage`)
- `/admin/orders` — list (`AdminOrdersPage`)
- `/admin/orders/:id` — detail + status control (`AdminOrderDetailPage`)

All nested under `AdminLayout` (sidebar nav) behind
`<ProtectedRoute role={Role.ADMIN} />`.

## State/data flow

Each page: local `useState` + `useEffect` fetch-on-mount (matching
the existing `CartPage`/`OrderHistoryPage` pattern) — no new client
cache library, consistent with the Phase 2 constraint that's still
honored throughout this codebase.

## Error handling / loading / empty states

- Loading: `Skeleton` placeholders.
- Error: `ErrorState` with a retry action.
- Empty: `EmptyState` (no products / no orders found).
- Form validation errors render per-field via the existing `Input`
  `error` prop (`role="alert"`); server errors render as a single
  alert paragraph above the submit button.

## Accessibility

- Every form control has an associated `<label>` (or `aria-label` for
  the compact per-row variant stock/threshold inputs).
- Status/error messages use `role="alert"`.
- Keyboard navigation: standard form controls and links, no custom
  widgets requiring bespoke key handling.

## Testing

- Server: `admin.dashboard.test.ts`, `admin.products.test.ts`,
  `admin.orders.test.ts` — RBAC (401/403), successful CRUD, validation
  failures (400), conflicts (409/slug+SKU), audit log rows written,
  order transition graph (valid chain + rejected invalid jump).
- Client: one test file per page — loading/error/empty/success states,
  a filter changing the fetched query, a create-product form
  submission (validated payload, correct request body, navigation on
  success), a validation-blocked submission, and an edit-mode variant
  stock update.
- E2E (`e2e/admin.spec.ts`): admin dashboard + order status transition
  end-to-end; admin product creation end-to-end.

## Non-goals

Analytics beyond the dashboard's simple counts/sums, real-time
updates, bulk operations, CSV import/export, image upload for admin-
created products (reuses the same `ProductImage` model but this
milestone doesn't add an image-management UI — a genuinely separate,
sizeable piece of work).
