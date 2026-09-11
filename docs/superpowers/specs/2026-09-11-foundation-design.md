# Phase 1: Foundation — Design Spec

Date: 2026-09-11
Status: Approved for implementation planning

## Purpose

Establish the repository, database schema, authentication/RBAC, API
layer conventions, design-token foundation, and app shell that every
later phase (storefront, admin, hardening) builds on. No
storefront/admin business features are implemented in this phase —
only the shell, auth pages (login/register), and schema.

## Stack (locked, do not revisit without explicit re-approval)

- Frontend: React 18 + Vite + TypeScript + React Router v6 + Tailwind
  CSS. Mandatory per college requirement — no Next.js, no SSR/SSG
  migration for SEO convenience. SEO requirements in later phases are
  satisfied by the strongest technique available inside this
  architecture (meta tags via a head-management approach, sitemap/
  robots/llms.txt as static/generated files, JSON-LD injected
  client-side) and anything not achievable without violating the
  React+Vite constraint is marked PARTIAL with an explicit explanation
  — never faked.
- Backend: Node.js + Express + TypeScript.
- Database: PostgreSQL + Prisma ORM.
- Package manager: npm, workspaces monorepo.
- Auth: JWT access token + httpOnly refresh cookie, rotation +
  reuse detection (see below).
- RBAC: simple two-value `Role` enum (`CUSTOMER`, `ADMIN`) on `User`.
  No permission-table indirection — reassess only if a real multi-tier
  admin requirement appears later.
- Styling: Tailwind CSS reading design tokens from CSS custom
  properties defined in one `tokens.css`.

## Repository layout

```
/client          React + Vite + TS app
/server          Express + TS API
/shared          Environment-agnostic contracts (see constraint below)
/docs
package.json     npm workspaces root ("client", "server", "shared")
```

`/shared` constraint: contains ONLY Zod schemas, TypeScript types/
interfaces, and enums shared between client and server request/
response contracts. It must never import Prisma Client, any Node-only
built-in (`fs`, `path`, `crypto` used for secrets, etc.), any
browser-only global, or anything that reads an environment variable or
secret. This keeps it safely importable from both a browser bundle and
a server process. Enforced by: no dependency on `@prisma/client` or
`express` in `shared/package.json`, and a lint rule / CI check (added
in Phase 1 tooling) that fails if `shared/src` imports either.

## Data model

Guiding rule: build a coherent foundation now covering every entity
Phase 2+ features need, so those phases add columns/tables through
normal Prisma migrations rather than a re-architecture — but do not
add speculative fields with no identified consumer. Every entity below
maps to a feature already committed to in the product brief.

All mutable domain tables get `createdAt` (default now) and
`updatedAt` (`@updatedAt`). Tables that are ever read by "list recent
X" or "find X in range" admin views get an index on the relevant
timestamp; called out per-table below.

### User
- `id` (uuid, pk), `email` (citext, **unique**), `passwordHash`,
  `name`, `role` (`Role` enum: `CUSTOMER` | `ADMIN`, default
  `CUSTOMER`), `createdAt`, `updatedAt`.
- Index: `email` (unique index doubles as lookup index for login).

### RefreshToken
- `id` (uuid, pk), `userId` (fk → User), `tokenHash` (sha256 of the
  raw refresh token — raw value never stored), `familyId` (uuid,
  identifies a rotation chain), `expiresAt`, `revokedAt` (nullable),
  `replacedByTokenHash` (nullable, points to the token that rotated
  this one out), `createdAt`.
- Index: `tokenHash` (unique — lookup on refresh), `userId` (revoke-
  all-sessions), `familyId` (reuse-detection sweep).
- Rotation/reuse-detection semantics (amendment 3), see "Auth" below.

### Address
- `id`, `userId` (fk), `label`, `line1`, `line2`, `city`, `state`,
  `postalCode`, `country`, `phone`, `isDefault` (bool), timestamps.
- Index: `userId`.

### Category
- `id`, `slug` (**unique**), `name`, `parentId` (fk → Category,
  nullable, self-referential for nesting), timestamps.
- Index: `parentId`.

### Brand
- `id`, `slug` (**unique**), `name`, `logoUrl` (nullable), timestamps.

### Product
- `id`, `slug` (**unique**), `name`, `description`, `categoryId` (fk),
  `brandId` (fk, nullable), `basePrice` (decimal), `status`
  (`ProductStatus` enum: `DRAFT` | `ACTIVE` | `ARCHIVED`), `featured`
  (bool, default false), `seoTitle`, `seoDescription`, timestamps.
- Index: `slug` (unique), `categoryId`, `brandId`, `status`, and a
  composite `(status, featured)` for the homepage featured query.

### ProductVariant
- `id`, `productId` (fk), `sku` (**unique**), `attributes` (jsonb —
  e.g. `{color, size}`), `priceOverride` (decimal, nullable — falls
  back to `Product.basePrice`), `stockQty` (int, `>= 0` enforced by DB
  check constraint, not just app logic), `lowStockThreshold` (int,
  default), `reservedQty` (int, default 0 — see inventory design),
  timestamps.
- Index: `sku` (unique), `productId`.
- Check constraint: `stockQty >= 0` and `reservedQty >= 0` and
  `reservedQty <= stockQty`.

### ProductImage
- `id`, `productId` (fk), `url`, `altText`, `position` (int, ordering),
  timestamps.
- Index: `productId`.

### Cart
- `id`, `userId` (fk, **unique** — one cart per user), timestamps.

### CartItem
- `id`, `cartId` (fk), `variantId` (fk → ProductVariant), `qty` (int,
  `> 0` check constraint), timestamps.
- **Unique composite**: `(cartId, variantId)` — adding an already-
  present variant increments qty, never duplicates the row.
- Index: `cartId`.

### Wishlist
- `id`, `userId` (fk, **unique** — one wishlist per user), timestamps.

### WishlistItem
- `id`, `wishlistId` (fk), `productId` (fk), timestamps.
- **Unique composite**: `(wishlistId, productId)`.
- Index: `wishlistId`.

### Order
- `id`, `userId` (fk), `status` (`OrderStatus` enum: `PENDING` |
  `CONFIRMED` | `PROCESSING` | `SHIPPED` | `DELIVERED` | `CANCELLED` |
  `REFUNDED`), `currency` (string, e.g. `INR`), `subtotal`,
  `discountTotal`, `shippingTotal`, `taxTotal`, `grandTotal` (all
  decimal, snapshotted at order-creation time — never recomputed from
  live product data for historical display), `couponCode` (nullable,
  snapshot of code used, not a live fk to `Coupon`), `shippingAddress`
  (jsonb snapshot — full address fields copied at order time, not a fk
  to `Address`, so a later address edit/delete never alters history),
  `billingAddress` (jsonb snapshot, nullable if same as shipping),
  timestamps.
- Index: `userId`, `status`, `createdAt` (admin "recent orders" /
  date-range queries).

### OrderItem
- `id`, `orderId` (fk), `productId` (fk, for catalog navigation back
  to a still-existing product — nullable-safe, see below),
  `productName` (snapshot string), `variantSku` (snapshot string),
  `variantAttributes` (jsonb snapshot, e.g. `{color, size}`),
  `unitPrice` (decimal snapshot), `qty` (int), `lineTotal` (decimal
  snapshot = `unitPrice * qty`), timestamps.
- `productId` uses `onDelete: SetNull` — if a product is later deleted,
  the historical order line still renders correctly from its own
  snapshot fields; it just loses the "view live product" link.
- Index: `orderId`.

### Review
- `id`, `productId` (fk), `userId` (fk), `rating` (int 1–5, check
  constraint), `body`, `status` (`ReviewStatus` enum: `PENDING` |
  `APPROVED` | `REJECTED`), timestamps.
- **Unique composite**: `(productId, userId)` — one review per
  customer per product (business rule: prevent duplicate reviews).
- Index: `productId`, `status`.

### Coupon
- `id`, `code` (**unique**), `type` (`CouponType` enum: `PERCENT` |
  `FIXED`), `value` (decimal), `expiresAt`, `usageLimit` (int,
  nullable = unlimited), `timesUsed` (int, default 0), `active` (bool),
  timestamps.
- Index: `code` (unique).

### StoreSettings
- `id` (fixed literal `"singleton"` string pk — the only value ever
  inserted; enforced by application code always querying/upserting
  that exact id, plus a check constraint `id = 'singleton'`), `storeName`,
  `logoUrl`, `faviconUrl`, `contactEmail`, `contactPhone`, `socialLinks`
  (jsonb), `heroContent` (jsonb), timestamps.

### ContentBlock
- `id`, `type` (`ContentBlockType` enum: `BANNER` | `FEATURED_
  COLLECTION` | `ANNOUNCEMENT`), `position` (int, ordering), `payload`
  (jsonb — shape depends on type), `active` (bool), timestamps.
- Index: `(active, position)` for the homepage render query.

### AuditLog
- `id`, `actorId` (fk → User, nullable if system action), `action`
  (string, e.g. `product.update`), `entityType`, `entityId`, `diff`
  (jsonb — before/after), `createdAt`.
- Index: `createdAt` (recent-activity feed), `actorId`.

## Inventory correctness (amendment 2)

Overselling under concurrent checkout is a correctness bug, not an
edge case to shrug at. Design:

- `ProductVariant.stockQty` is the source of truth; `reservedQty`
  tracks quantity held by carts/in-flight orders that has not yet been
  decremented from `stockQty`.
- Stock decrement at order placement happens inside a single Prisma
  `$transaction`, using a conditional update — not a naive read-then-
  write:
  ```sql
  UPDATE "ProductVariant"
  SET "stockQty" = "stockQty" - :qty
  WHERE id = :variantId AND "stockQty" >= :qty
  ```
  Executed via `prisma.productVariant.updateMany({ where: { id, stockQty: { gte: qty } }, data: { stockQty: { decrement: qty } } })`
  and checking the returned `count === 1`; if `count === 0`, the
  transaction is rolled back and the caller receives an
  "insufficient stock" error — never a negative balance. Postgres's
  row-level locking on the `UPDATE` makes two concurrent transactions
  for the same variant serialize correctly instead of both reading a
  stale quantity.
- All `OrderItem` rows for one order are decremented inside the same
  `$transaction` as the `Order`/`OrderItem` inserts — either the whole
  order succeeds with correct stock, or nothing is written.
- Testing (amendment 2): an integration test fires two concurrent
  "place order for the last unit of variant X" requests (`Promise.all`
  against the running test server/transaction) and asserts exactly one
  succeeds and the other receives a deterministic insufficient-stock
  error, and that `stockQty` never goes negative. A second test covers
  the simple insufficient-stock-at-request-time path.

## Authentication (amendment 3: rotation + reuse detection)

- Login issues: (1) a JWT access token, 15 min expiry, returned in the
  response body, held in memory on the client (never localStorage);
  (2) a refresh token, a random 256-bit value, returned only as an
  httpOnly + Secure + SameSite=Strict cookie. The server stores
  `sha256(refreshToken)` in `RefreshToken.tokenHash`, never the raw
  value.
- Every refresh request rotates: the presented token is looked up by
  hash; if found, not expired, and not revoked, a new refresh token is
  issued in the same `familyId`, the old row gets `revokedAt = now()`
  and `replacedByTokenHash` set to the new row's hash, and a new access
  token is issued.
- **Reuse detection**: if the presented refresh token hashes to a row
  that is already `revokedAt IS NOT NULL`, that is a replay of a
  token that was already rotated away — a signal the token was
  stolen. Response: revoke every `RefreshToken` row sharing that
  `familyId` (kill the whole session lineage), clear the refresh
  cookie, and return 401 forcing full re-authentication. This is
  tested explicitly (amendment 3): rotate once, then replay the
  original token, assert the family is fully revoked and a third
  attempt with the second (legitimately-issued) token also fails.
- `requireAuth` Express middleware verifies the access JWT; on
  expiry the client calls `/auth/refresh` (cookie-authenticated) to
  get a new access token transparently.
- `requireRole('ADMIN')` middleware runs after `requireAuth` and is the
  only authorization boundary for admin routes — no client-side check
  is ever trusted server-side.
- Passwords hashed with bcrypt, cost factor 12.

## API layer conventions

Route → controller → service → Prisma repository call. Zod validates
every request body/query/params against schemas that live in
`/shared` and are imported by both the controller (server-side
enforcement, authoritative) and the client (form-level validation,
UX only). A central Express error-handling middleware catches thrown
`AppError` subclasses (`ValidationError`, `NotFoundError`,
`UnauthorizedError`, `ForbiddenError`, `ConflictError`) and maps each
to a consistent `{ error: { code, message } }` JSON shape with the
right HTTP status; unhandled exceptions log server-side and return a
generic 500 body with no stack trace in production. Rate limiting
(`express-rate-limit`) applies to `/auth/login`, `/auth/register`,
`/auth/refresh`.

## Design token foundation

`client/src/styles/tokens.css` defines CSS custom properties: color
(`--color-*`, light values on `:root`, dark overrides under
`prefers-color-scheme: dark` and a manual `.dark` class), typography
(`--font-*`, `--tracking-*`, `--leading-*` per the apple-design skill's
size-specific tracking/leading guidance), spacing (`--space-*` on a
4px base scale), radius, shadow, motion (`--duration-*`, `--ease-*`,
plus spring parameters documented as JS constants for Motion/Framer
Motion usage: default `damping 1.0`, momentum interactions `damping
~0.8`, both `response 0.3–0.4`). Tailwind's `theme.extend` reads these
variables rather than hardcoding values, so later phases never
introduce ad hoc magic numbers. `prefers-reduced-motion`,
`prefers-reduced-transparency`, and `prefers-contrast: more` are
handled at the token/primitive level per the apple-design skill, not
per-feature.

## App shell

React Router v6 with lazy route-level code splitting via `React.lazy`.
Layout nesting: `RootLayout` (providers: auth context, toast context,
error boundary) → `StorefrontLayout` (public nav/footer) and
`AdminLayout` (auth+role-gated, redirects non-admins server-verified
via a `/auth/me` check, not just a decoded-locally JWT claim). Shared
primitives built in this phase for reuse everywhere later: `Button`,
`Input`, `Toast`, `Skeleton`, `EmptyState`, `ErrorState`,
`LoadingState`, `ErrorBoundary`. Phase 1 pages: `/login`, `/register`,
a placeholder authenticated `/account` page proving the auth flow
end-to-end, and a `/admin` placeholder proving role-gating end-to-end.
No product/cart/order UI yet.

## Error handling

Every async boundary introduced in this phase (login, register,
refresh, the two placeholder pages) implements loading / success /
error states — no blank screens, no unhandled rejections. This is the
pattern later phases repeat, not a one-off.

## Testing (foundation scope)

- Unit (Vitest): password hashing, JWT sign/verify, Zod schema
  validation, `AppError` → HTTP status mapping.
- Integration (Vitest + Supertest, real test Postgres DB via a
  disposable schema/transaction per test): register, login, refresh
  (including rotation), refresh-token reuse detection (amendment 3),
  role-gate on an admin-only test route, the concurrent-stock-
  decrement scenario (amendment 2) — this last one exercises the
  `ProductVariant` update path even though no checkout UI exists yet,
  because the atomic-decrement primitive is foundation infrastructure.
- Component (Vitest + Testing Library): `Button`, `Input`, `Toast`,
  `LoginForm`, `RegisterForm` — actual behavior (submit, validation
  error display, disabled-while-submitting), not existence checks.
- No E2E (Playwright) in this phase — introduced once real storefront
  pages exist in Phase 2.

## Migrations

Normal Prisma migration history starts here (`prisma migrate dev`) and
is expected to grow normally in every later phase. Nothing in this
schema exists solely to dodge a future migration; every table maps to
a feature already committed to in the product brief.

## Out of scope for Phase 1

Any storefront browsing/cart/checkout/order UI or business logic
beyond the schema and the atomic-decrement primitive; any admin
CRUD UI; reviews/coupons/content UI; SEO artifacts (sitemap/robots/
llms.txt/JSON-LD) — those belong to their respective later phases.
