# Phase 3: Cart, Checkout & Order History — Design Spec

Date: 2026-09-13
Status: Implemented (documented retroactively — the implementation existed
in the working tree, uncommitted, at the start of this session; this spec
records what was built and verified before landing it on `master`).

## Purpose

Let a signed-in customer add products to a cart, check out, and view their
own order history/detail. This phase makes the storefront sellable (against
a demo, no-real-payment checkout).

## Stack

Unchanged from Phase 1/2: Express + Prisma + PostgreSQL, React + Vite +
TypeScript + Tailwind, Zod contracts in `shared/` as the only client/server
DTO shapes, INR money via `Decimal`/`toMoney` — never floating point.

## In scope

- Per-user `Cart` (1:1 with `User`) with `CartItem` lines keyed on
  `(cartId, variantId)`.
- Add / update qty / remove / clear cart, all under `/api/cart` and
  `requireAuth`.
- Stock-aware cart mutations: adding/increasing qty is rejected with a
  `ConflictError` when requested qty exceeds `availableQty` (reusing the
  Phase 2 `availableQty`/`variantInStock` formulas).
- Checkout: `POST /api/orders` converts the caller's cart into an `Order`
  inside a single Prisma transaction — validates product status is
  `ACTIVE`, decrements stock via the existing `inventory.service`
  (atomic, never read-then-write), snapshots item name/SKU/attributes/price
  onto `OrderItem` (so later catalog edits don't rewrite history), computes
  subtotal/shipping/tax/discount/grand total, then clears the cart.
- Flat shipping: free at/above ₹999 subtotal, else a flat ₹79 fee. No tax,
  no discounts yet (`taxTotal`/`discountTotal` are present on the DTO and
  always `0` — real coupon/tax logic is a future phase, not invented here).
- Order history (`GET /api/orders`) and order detail
  (`GET /api/orders/:orderId`) for the authenticated user; detail enforces
  ownership (`order.userId === req.user.id`) unless the caller is `ADMIN`.
- Client: `CartContext` (client-side cart-count/UI convenience only — the
  server cart is the source of truth), `CartPage`, `CheckoutPage` (shipping
  address form), `OrderHistoryPage`, `OrderDetailPage`.
- Supporting catalog/content polish shipped alongside this phase: product
  `specs` (JSON) + `ratingAvg`/`reviewCount` display via `SpecsTable` /
  `RatingStars`, `compareAtPrice` strike-through pricing, `Breadcrumbs`,
  `QuantityStepper`, `TrustBadges`, `CategoryTile`, a storefront `Footer`,
  and an `ImageCreditsPage` + `commonsImageMap.ts` attributing the
  Wikimedia Commons photography used by the seed.

## Out of scope (unchanged from prior phases unless noted)

Wishlist, reviews (write path), coupons, admin CRUD, real payment
processing, order cancellation/refunds, order status transitions beyond
`CONFIRMED` (that lands with Admin order management), multi-address book
management (checkout takes a one-off shipping address), tax calculation.

## Database

Additive only — `Cart`, `CartItem`, `Order`, `OrderItem` already existed in
the Phase 1 schema. This phase adds, via migration
`20260912040841_add_specs_ratings_compare_price`:

- `Product.specs Json @default("{}")`, `Product.ratingAvg Decimal(2,1) @default(0)`,
  `Product.reviewCount Int @default(0)`
- `ProductVariant.compareAtPrice Decimal(10,2)?`

No destructive changes; existing rows default cleanly.

## API contracts (shared Zod schemas)

- `shared/src/schemas/cart.ts`: `addCartItemSchema`, `updateCartItemSchema`,
  `CartDto`/`CartItemDto`.
- `shared/src/schemas/orders.ts`: `createOrderInputSchema`
  (`ShippingAddressInput`), `OrderDto`/`OrderItemDto`.

All cart/order routes validate body/params with these schemas via the
existing `validate` middleware; server and client both import the same
types — no duplicated DTOs.

## Authorization

- Every `/api/cart/*` and `/api/orders/*` route requires `requireAuth`
  (JWT). There is no anonymous/guest cart in this phase.
- Cart operations are always scoped to `req.user.id` — a user cannot
  reference another user's cart or item IDs (item lookups are
  `findFirst({ id, cartId })`, never a bare `id`).
- `GET /api/orders/:orderId` checks `order.userId === req.user.id` and
  throws `ForbiddenError` otherwise, with an `ADMIN` bypass for future
  admin order lookups.

## Error handling

Reuses the existing `AppError` hierarchy (`NotFoundError`, `ConflictError`,
`ForbiddenError`, `ValidationError`) and the shared `errorHandler` — no new
error shapes.

## Loading / empty states (client)

`CartPage` shows an empty-cart state with a continue-shopping action;
`CheckoutPage` redirects to the cart when the cart is empty;
`OrderHistoryPage` shows an empty state with no orders; `OrderDetailPage`
shows a "just placed" confirmation banner when arriving from checkout.

## Testing

- Server integration: `server/test/cart.integration.test.ts` (isolation
  per user, stock-limit rejection, qty update/remove/clear),
  `server/test/orders.integration.test.ts` (checkout creates an order,
  decrements stock, clears the cart; order history ordering; ownership
  enforcement).
- Client: `CartPage.test.tsx`, `CheckoutPage.test.tsx`,
  `OrderHistoryPage.test.tsx`, `OrderDetailPage.test.tsx`.
- E2E: `e2e/cart-checkout.spec.ts` — register, add an in-stock product,
  complete demo checkout; cart requires login.

## Non-goals

Re-architecting the money/availability model, inventing tax/coupon logic,
guest checkout, admin-side order management (that's the Admin milestone).
