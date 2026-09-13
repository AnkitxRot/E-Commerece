# Admin Management Implementation Plan

Status: Complete (implemented and verified this session; see
[design spec](../specs/2026-09-13-admin-management-design.md)).

## Verification performed before landing

1. `npm run lint` — PASS
2. `npm run typecheck` — PASS
3. `npm run test` — 14 shared + 97 server + 102 client = 213/213 PASS
4. `npm run build` — PASS
5. `npm run prisma:seed -w server` — reseeded dev DB
6. `npm run test:e2e` — 8/8 PASS (4 catalog + 2 cart/checkout + 2 admin)

## Tasks

- [x] `shared/src/schemas/admin.ts` — product/order/dashboard/lookup
      contracts
- [x] `server/src/modules/admin/{dashboard,products,lookups}.*` +
      `admin/orders/*` (route → controller → service → Prisma),
      mounted at `/api/admin` behind `requireAuth` +
      `requireRole(ADMIN)` at the router level
- [x] `server/src/modules/admin/audit.ts` — `recordAudit` helper used
      by every mutation
- [x] `server/test/admin.{dashboard,products,orders}.test.ts` — RBAC,
      CRUD, validation, conflicts, transition graph, audit rows
- [x] Updated `server/test/rbac.integration.test.ts` (the placeholder
      response shape it asserted on no longer exists)
- [x] Fixed `server/prisma/seed.ts`'s `??` → `||` bug (empty-string
      env var never fell back to the documented demo password)
- [x] `client/src/layouts/AdminLayout.tsx` — sidebar nav
- [x] `client/src/pages/Admin{Overview,Products,ProductForm,Orders,
      OrderDetail}Page.tsx` + one test file each
- [x] Wired routes into `App.tsx`
- [x] `e2e/admin.spec.ts` — dashboard/order-status and product-creation
      smoke flows
- [x] `playwright.config.ts`: `workers: 1` (every spec shares one dev
      server, one Postgres database, and one IP-keyed auth rate
      limiter — mirrors `vitest.config.ts`'s existing
      `fileParallelism: false` for the same reason)

## Follow-up (not this milestone)

- Category/Brand CRUD, coupon management, review moderation, store
  settings/content block editing — real models already exist, no UI
  yet.
- Adding new variants to an existing product (only supported at
  product-creation time).
- Image upload/management for admin-created products.
