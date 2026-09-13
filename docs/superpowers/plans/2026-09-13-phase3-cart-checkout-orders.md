# Phase 3 Implementation Plan — Cart, Checkout & Order History

Status: Complete (verified and landed this session; see
[design spec](../specs/2026-09-13-phase3-cart-checkout-orders-design.md)).

## Verification performed before landing

1. `npm run lint` — PASS
2. `npm run typecheck` — PASS
3. `npm run test` — 191/191 PASS (14 shared, 87 server, 90 client)
4. `npm run prisma:seed -w server` — reseeded dev DB so seeded fixtures
   (specs/ratings/compareAtPrice) matched the updated seed script
5. `npm run test:e2e` — 6/6 PASS after reseeding

## Tasks (as found, already implemented)

- [x] Prisma migration: `Product.specs/ratingAvg/reviewCount`,
      `ProductVariant.compareAtPrice`
- [x] `shared/src/schemas/cart.ts`, `shared/src/schemas/orders.ts`
- [x] `server/src/modules/cart/*` (service/controller/routes), mounted at
      `/api/cart` behind `requireAuth`
- [x] `server/src/modules/orders/*` (service/controller/routes), mounted at
      `/api/orders` behind `requireAuth`
- [x] `server/test/cart.integration.test.ts`,
      `server/test/orders.integration.test.ts`
- [x] Client `CartContext`, `CartPage`, `CheckoutPage`,
      `OrderHistoryPage`, `OrderDetailPage` + their tests
- [x] `e2e/cart-checkout.spec.ts`
- [x] Supporting UI: `Breadcrumbs`, `QuantityStepper`, `RatingStars`,
      `TrustBadges`, `CategoryTile`, `SpecsTable`, `Footer`,
      `ImageCreditsPage` + `commonsImageMap.ts`
- [x] `README.md` (setup instructions for the monorepo)

## Follow-up (not this phase)

- Wishlist, reviews (write path), coupons — future phases
- Admin order status transitions — Admin milestone (next)
