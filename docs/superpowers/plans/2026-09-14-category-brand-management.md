# Category + Brand Management — Implementation Plan

Date: 2026-09-14
Companion spec: `docs/superpowers/specs/2026-09-14-category-brand-management-design.md`

## Steps

1. **Schema**: add `isActive Boolean @default(true)` to `Category` and
   `Brand` in `server/prisma/schema.prisma`; generate a migration
   (`prisma migrate dev --name add_category_brand_active`); regenerate
   the Prisma client.
2. **Shared contracts** (`shared/src/schemas/admin.ts`): category/brand
   create/update input schemas, DTO schemas, list-response schemas;
   extend `AdminOptionDto` with `isActive`.
3. **Server — category tree bound**: add `isActive = true` to the
   anchor and recursive clauses in `categoryTree.ts`'s CTE (keeps the
   `MAX_CATEGORY_DEPTH` bound untouched).
4. **Server — new modules**: `admin/categories/*` and `admin/brands/*`
   (routes/controller/service), following the `admin/reviews` folder
   shape. Remove `admin/lookups.*`. Wire into `admin.routes.ts`.
5. **Server — products.service.ts**: replace
   `assertCategoryAndBrandExist` with two focused, active-aware
   checks, called only for fields actually being changed.
6. **Server — public catalog.service.ts**: filter `isActive` into
   `getCategoryTree`, `getCategoryBySlug` (including its `children`
   sub-select), `getBrands`, and the brand-slug lookup inside
   `listProducts`.
7. **Server tests**: `admin.categories.test.ts`, `admin.brands.test.ts`;
   extend `admin.products.test.ts`, `catalog.integration.test.ts`,
   `categoryTree.test.ts`.
8. **Client — shared plumbing**: no new library; reuse
   `apiFetch`/`parseCatalog`/`Button`/`Input`/`ErrorState`/
   `EmptyState`/`Skeleton`/`useToast`.
9. **Client — pages**: `AdminCategoriesPage.tsx`, `AdminBrandsPage.tsx`;
   register routes in `App.tsx`; add nav entries in `AdminLayout.tsx`.
10. **Client — AdminProductFormPage.tsx**: switch its category/brand
    fetch to the new list endpoints, render inactive options with a
    suffix.
11. **Client tests**: one file per new page, mirroring
    `AdminReviewsPage.test.tsx`'s structure.
12. **E2E**: extend `e2e/admin.spec.ts`.
13. **Full validation**: lint, typecheck, unit/integration tests,
    build, e2e — from a clean state, then again post-merge on master.
14. **Commit, push, PR, merge, sync, re-validate on master.**
