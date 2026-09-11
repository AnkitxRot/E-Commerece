# Phase 2 Public Catalog Storefront Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a public, database-backed Aurelia Audio catalog (home, category/product listing, product detail, search/filter/sort/pagination, realistic seed) with shared Zod contracts and no cart/checkout.

**Architecture:** Public `GET /api/catalog/*` reads the existing Prisma schema (ACTIVE products only). Category descendants resolve in one bounded recursive CTE. List/home/detail DTOs are defined in `/shared` and runtime-parsed on the client. The SPA fetches from the URL; filters replace history and reset `page`; pagination pushes. No new cache library, no search engine, no schema redesign.

**Tech Stack:** React 18, Vite, TypeScript, React Router v6, Tailwind CSS, Node.js, Express, Prisma, PostgreSQL, Zod, Vitest, Testing Library, Supertest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-12-phase2-catalog-storefront-design.md`

## Global Constraints

- Frontend is React 18 + Vite + TypeScript + React Router v6 + Tailwind CSS. Never Next.js, never SSR/SSG.
- Backend is Node.js + Express + TypeScript. Database is PostgreSQL via Prisma. Do not redesign Phase 1 tables. Additive indexes only if a required query is incorrect without them.
- `/shared` contains only Zod schemas, TS types, and enums. Never import Prisma, Express, `fs`, or `process.env`.
- Catalog APIs are public GETs. Do not wrap them in `requireAuth` / `requireRole`. Do not add cart, wishlist, checkout, orders, reviews, coupons, or admin CRUD.
- `inStock` / `availableQty` everywhere: `availableQty = stockQty - reservedQty`; `inStock(variant) = availableQty > 0`; `inStock(product) = some variant inStock`.
- Every catalog `ORDER BY` ends with `"id" ASC`.
- Search is escaped `ILIKE` substring on name, description, SKU. No search engine, no `pg_trgm`, no speculative indexes.
- Client catalog types come from `z.infer` of shared schemas; every payload is `safeParse`d. No parallel response interfaces.
- Changing `q` / `category` / `brand` / `minPrice` / `maxPrice` / `inStock` / `sort` / `pageSize` resets page to 1 and uses `replace`. Pagination uses `push`.
- PDP `?variant=` is accepted only if that SKU is on the current product.
- Anonymous catalog 200: `Cache-Control: public, max-age=15, stale-while-revalidate=60`. Request with `Authorization` or `refreshToken` cookie: `private, max-age=15`. Errors: `no-store`. Never attach this to `/api/auth` or `/api/admin`.
- ContentBlock JSON never reaches the UI raw; parse per `ContentBlockType`.
- Money is a two-decimal string. Currency INR. Access JWT stays in memory. Auth rate limiter stays skipped only when `NODE_ENV=test`.
- Integration tests use `audio_commerce_test` and `resetDb()`. Seed refuses `NODE_ENV=production`.
- Reuse Phase 1 primitives (`Button`, `Input`, `Skeleton`, `EmptyState`, `ErrorState`, `LoadingState`) and tokens. No add-to-cart control.

---

## File Structure

```
shared/src/schemas/catalog.ts
shared/src/schemas/catalog.test.ts
shared/src/index.ts                         # add export

server/src/modules/catalog/money.ts
server/src/modules/catalog/availability.ts
server/src/modules/catalog/ilike.ts
server/src/modules/catalog/categoryTree.ts
server/src/modules/catalog/cacheControl.ts
server/src/modules/catalog/mapProduct.ts
server/src/modules/catalog/catalog.service.ts
server/src/modules/catalog/catalog.controller.ts
server/src/modules/catalog/catalog.routes.ts
server/src/app.ts                           # mount /api/catalog
server/prisma/seed.ts                       # extend
server/test/catalog.helpers.ts              # fixture builders
server/test/catalog.integration.test.ts
server/test/catalog.home.test.ts
server/test/money.test.ts
server/test/categoryTree.test.ts

client/src/lib/parseCatalog.ts
client/src/lib/parseCatalog.test.ts
client/src/lib/listUrl.ts
client/src/lib/listUrl.test.ts
client/src/lib/selectVariant.ts
client/src/lib/selectVariant.test.ts
client/src/components/catalog/Price.tsx
client/src/components/catalog/Price.test.tsx
client/src/components/catalog/ProductCard.tsx
client/src/components/catalog/ProductCard.test.tsx
client/src/components/catalog/ProductGrid.tsx
client/src/components/catalog/FilterBar.tsx
client/src/components/catalog/Pagination.tsx
client/src/components/catalog/Pagination.test.tsx
client/src/components/catalog/ImageGallery.tsx
client/src/components/catalog/VariantPicker.tsx
client/src/pages/HomePage.tsx
client/src/pages/ProductListPage.tsx
client/src/pages/ProductListPage.test.tsx
client/src/pages/ProductDetailPage.tsx
client/src/pages/ProductDetailPage.test.tsx
client/src/layouts/StorefrontLayout.tsx
client/src/App.tsx

playwright.config.ts
e2e/catalog.spec.ts
package.json                                # test:e2e script
```

---

### Task 1: Shared catalog Zod contracts

**Files:**
- Create: `shared/src/schemas/catalog.ts`
- Create: `shared/src/schemas/catalog.test.ts`
- Modify: `shared/src/index.ts`

**Interfaces:**
- Consumes: `ContentBlockType` from `shared/src/enums.ts`
- Produces: every catalog schema/type named in the spec section **Shared Zod / TypeScript contracts**, plus `normalizeSearchQuery`

- [ ] **Step 1: Write the failing tests**

Create `shared/src/schemas/catalog.test.ts`. The implementation file must not exist yet (or export nothing), so these fail.

```ts
import { describe, expect, it } from 'vitest';
import {
  catalogSlugParamSchema,
  homeResponseSchema,
  internalPathSchema,
  moneySchema,
  normalizeSearchQuery,
  productCardDtoSchema,
  productDetailDtoSchema,
  productListQuerySchema,
  productListResponseSchema,
} from './catalog.js';

describe('normalizeSearchQuery', () => {
  it('trims and collapses internal whitespace', () => {
    expect(normalizeSearchQuery('  nova   black  ')).toBe('nova black');
  });
});

describe('productListQuerySchema', () => {
  it('applies defaults', () => {
    const q = productListQuerySchema.parse({});
    expect(q.sort).toBe('newest');
    expect(q.page).toBe(1);
    expect(q.pageSize).toBe(24);
    expect(q.q).toBeUndefined();
  });

  it('normalizes q and rejects length 1', () => {
    expect(productListQuerySchema.parse({ q: '  nova  ' }).q).toBe('nova');
    expect(productListQuerySchema.safeParse({ q: 'a' }).success).toBe(false);
    expect(productListQuerySchema.safeParse({ q: 'x'.repeat(81) }).success).toBe(false);
  });

  it('rejects repeated query keys represented as arrays', () => {
    expect(productListQuerySchema.safeParse({ sort: ['newest', 'name_asc'] }).success).toBe(false);
  });

  it('accepts only exact true/false for inStock', () => {
    expect(productListQuerySchema.parse({ inStock: 'true' }).inStock).toBe(true);
    expect(productListQuerySchema.parse({ inStock: 'false' }).inStock).toBe(false);
    expect(productListQuerySchema.safeParse({ inStock: 'TRUE' }).success).toBe(false);
    expect(productListQuerySchema.safeParse({ inStock: '1' }).success).toBe(false);
    expect(productListQuerySchema.safeParse({ inStock: 'yes' }).success).toBe(false);
  });

  it('bounds prices and requires min <= max', () => {
    expect(productListQuerySchema.parse({ minPrice: '10.5' }).minPrice).toBe(10.5);
    expect(productListQuerySchema.safeParse({ minPrice: 'abc' }).success).toBe(false);
    expect(productListQuerySchema.safeParse({ minPrice: '-1' }).success).toBe(false);
    expect(productListQuerySchema.safeParse({ minPrice: '20', maxPrice: '10' }).success).toBe(false);
    expect(productListQuerySchema.parse({ minPrice: '10', maxPrice: '20' }).maxPrice).toBe(20);
  });

  it('bounds page and pageSize and rejects unknown sort', () => {
    expect(productListQuerySchema.safeParse({ page: '1.5' }).success).toBe(false);
    expect(productListQuerySchema.safeParse({ page: '-1' }).success).toBe(false);
    expect(productListQuerySchema.safeParse({ pageSize: '49' }).success).toBe(false);
    expect(productListQuerySchema.safeParse({ sort: 'popular' }).success).toBe(false);
    expect(productListQuerySchema.parse({ sort: 'price_asc' }).sort).toBe('price_asc');
  });

  it('rejects unknown query keys', () => {
    expect(productListQuerySchema.safeParse({ foo: '1' }).success).toBe(false);
  });
});

describe('internalPathSchema', () => {
  it('allows root-relative paths and rejects open redirects', () => {
    expect(internalPathSchema.parse('/products')).toBe('/products');
    expect(internalPathSchema.safeParse('https://evil.example').success).toBe(false);
    expect(internalPathSchema.safeParse('//evil.example').success).toBe(false);
  });
});

describe('money and list response', () => {
  it('rejects non two-decimal money', () => {
    expect(moneySchema.safeParse('10').success).toBe(false);
    expect(moneySchema.parse('10.50')).toBe('10.50');
  });

  it('parses a list envelope and rejects product UUIDs', () => {
    const card = {
      slug: 'aurelia-nova',
      name: 'Nova',
      brand: { slug: 'aurelia', name: 'Aurelia' },
      category: { slug: 'over-ear', name: 'Over-ear' },
      priceFrom: '19999.00',
      priceTo: '24999.00',
      thumbnail: null,
      inStock: true,
      featured: true,
    };
    expect(productCardDtoSchema.parse(card).slug).toBe('aurelia-nova');
    expect(productCardDtoSchema.safeParse({ ...card, id: 'not-allowed' }).success).toBe(false);
    const list = productListResponseSchema.parse({
      items: [card],
      meta: { page: 1, pageSize: 24, total: 1, totalPages: 1 },
    });
    expect(list.meta.total).toBe(1);
  });
});

describe('params and home envelope exist', () => {
  it('parses slug params', () => {
    expect(catalogSlugParamSchema.parse({ slug: 'over-ear' }).slug).toBe('over-ear');
    expect(catalogSlugParamSchema.safeParse({ slug: 'Over Ear' }).success).toBe(false);
  });

  it('exports home and detail envelopes', () => {
    expect(homeResponseSchema).toBeDefined();
    expect(productDetailDtoSchema).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -w shared`
Expected: FAIL — cannot find `./catalog.js` (or missing exports).

- [ ] **Step 3: Implement `shared/src/schemas/catalog.ts`**

Copy the **entire** TypeScript block from the spec section **Shared Zod / TypeScript contracts** into this file (including `normalizeSearchQuery`, query schema, and all response envelopes). Do not add Prisma types. Do not omit `.strict()` on the list query.

- [ ] **Step 4: Re-export**

`shared/src/index.ts`:

```ts
export * from './enums.js';
export * from './schemas/auth.js';
export * from './schemas/catalog.js';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test -w shared`  
Expected: PASS (existing forbidden-import test still PASS).

- [ ] **Step 6: Commit**

```bash
git add shared/src/schemas/catalog.ts shared/src/schemas/catalog.test.ts shared/src/index.ts
git commit -m "feat(shared): add catalog request and response Zod contracts"
```

---

### Task 2: Money, availability, and ILIKE helpers

**Files:**
- Create: `server/src/modules/catalog/money.ts`
- Create: `server/src/modules/catalog/availability.ts`
- Create: `server/src/modules/catalog/ilike.ts`
- Create: `server/test/money.test.ts`

**Interfaces:**
- Consumes: Prisma `Decimal` (from `@prisma/client/runtime/library` or `decimal.js` already used by Prisma)
- Produces:
  - `toMoney(value: Decimal | string | number): string` — always `/^\d+\.\d{2}$/`
  - `availableQty(stockQty: number, reservedQty: number): number`
  - `variantInStock(stockQty: number, reservedQty: number): boolean`
  - `productInStock(variants: { stockQty: number; reservedQty: number }[]): boolean`
  - `escapeIlike(raw: string): string`

- [ ] **Step 1: Write the failing test**

```ts
import { Decimal } from '@prisma/client/runtime/library';
import { describe, expect, it } from 'vitest';
import { availableQty, productInStock, variantInStock } from '../src/modules/catalog/availability.js';
import { escapeIlike } from '../src/modules/catalog/ilike.js';
import { toMoney } from '../src/modules/catalog/money.js';

describe('toMoney', () => {
  it('serializes Decimal to two fraction digits', () => {
    expect(toMoney(new Decimal('10.5'))).toBe('10.50');
    expect(toMoney(new Decimal(19999))).toBe('19999.00');
  });
});

describe('availability', () => {
  it('is stockQty minus reservedQty and inStock when > 0', () => {
    expect(availableQty(5, 4)).toBe(1);
    expect(variantInStock(5, 4)).toBe(true);
    expect(variantInStock(1, 1)).toBe(false);
    expect(productInStock([{ stockQty: 1, reservedQty: 1 }])).toBe(false);
    expect(productInStock([{ stockQty: 5, reservedQty: 4 }])).toBe(true);
    expect(productInStock([])).toBe(false);
  });
});

describe('escapeIlike', () => {
  it('escapes ILIKE metacharacters', () => {
    expect(escapeIlike('100%_off\\x')).toBe('100\\%\\_off\\\\x');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w server -- test/money.test.ts`  
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement helpers**

`money.ts`:

```ts
import { Decimal } from '@prisma/client/runtime/library';

export function toMoney(value: Decimal | string | number): string {
  return new Decimal(value).toFixed(2);
}
```

`availability.ts`:

```ts
export function availableQty(stockQty: number, reservedQty: number): number {
  return stockQty - reservedQty;
}

export function variantInStock(stockQty: number, reservedQty: number): boolean {
  return availableQty(stockQty, reservedQty) > 0;
}

export function productInStock(variants: { stockQty: number; reservedQty: number }[]): boolean {
  return variants.some((v) => variantInStock(v.stockQty, v.reservedQty));
}
```

`ilike.ts`:

```ts
export function escapeIlike(raw: string): string {
  return raw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -w server -- test/money.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/modules/catalog/money.ts server/src/modules/catalog/availability.ts server/src/modules/catalog/ilike.ts server/test/money.test.ts
git commit -m "feat(server): add catalog money, availability, and ILIKE helpers"
```

---

### Task 3: Bounded recursive category CTE

**Files:**
- Create: `server/src/modules/catalog/categoryTree.ts`
- Create: `server/test/categoryTree.test.ts`
- Modify: `server/test/setup.ts` only if a small fixture helper is added there; prefer `server/test/catalog.helpers.ts`

**Interfaces:**
- Consumes: `prisma`, `NotFoundError`
- Produces:
  - `resolveCategoryAndDescendantIds(slug: string): Promise<string[]>` — one `$queryRaw` CTE, throws `NotFoundError` if empty
  - `MAX_CATEGORY_DEPTH = 8`

- [ ] **Step 1: Write the failing integration test**

```ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { resolveCategoryAndDescendantIds } from '../src/modules/catalog/categoryTree.js';
import { NotFoundError } from '../src/errors/AppError.js';
import { resetDb } from './setup.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('resolveCategoryAndDescendantIds', () => {
  it('returns self and descendants in one CTE and 404s unknown slugs', async () => {
    const root = await prisma.category.create({ data: { slug: 'headphones', name: 'Headphones' } });
    const child = await prisma.category.create({
      data: { slug: 'over-ear', name: 'Over-ear', parentId: root.id },
    });
    const grand = await prisma.category.create({
      data: { slug: 'flagship', name: 'Flagship', parentId: child.id },
    });
    const other = await prisma.category.create({ data: { slug: 'cables', name: 'Cables' } });

    const ids = await resolveCategoryAndDescendantIds('headphones');
    expect(ids.sort()).toEqual([root.id, child.id, grand.id].sort());
    expect(ids).not.toContain(other.id);

    const onlyChild = await resolveCategoryAndDescendantIds('over-ear');
    expect(onlyChild.sort()).toEqual([child.id, grand.id].sort());

    await expect(resolveCategoryAndDescendantIds('missing')).rejects.toBeInstanceOf(NotFoundError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w server -- test/categoryTree.test.ts`  
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the CTE**

```ts
import { prisma } from '../../lib/prisma.js';
import { NotFoundError } from '../../errors/AppError.js';

export const MAX_CATEGORY_DEPTH = 8;

export async function resolveCategoryAndDescendantIds(slug: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    WITH RECURSIVE tree AS (
      SELECT id, "parentId", 1 AS depth
      FROM "Category"
      WHERE slug = ${slug}
      UNION ALL
      SELECT c.id, c."parentId", tree.depth + 1
      FROM "Category" c
      INNER JOIN tree ON c."parentId" = tree.id
      WHERE tree.depth < ${MAX_CATEGORY_DEPTH}
    )
    SELECT id FROM tree
  `;
  if (rows.length === 0) throw new NotFoundError('Category not found');
  return rows.map((r) => r.id);
}
```

Do not query children in a loop. Do not load all categories for this function.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w server -- test/categoryTree.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/modules/catalog/categoryTree.ts server/test/categoryTree.test.ts
git commit -m "feat(server): resolve category descendants with a bounded recursive CTE"
```

---

### Task 4: Catalog cache middleware, settings, categories, brands

**Files:**
- Create: `server/src/modules/catalog/cacheControl.ts`
- Create: `server/src/modules/catalog/catalog.routes.ts`
- Create: `server/src/modules/catalog/catalog.controller.ts`
- Create: `server/src/modules/catalog/catalog.service.ts`
- Modify: `server/src/app.ts` (after `/api/admin`, before `errorHandler`)
- Create: `server/test/catalog.integration.test.ts` (this task’s cases; later tasks append)

**Interfaces:**
- Consumes: `storeSettingsDtoSchema`, `categoriesResponseSchema`, `categoryDetailDtoSchema`, `brandsResponseSchema`, `catalogSlugParamSchema`, `validate`, `NotFoundError`
- Produces: routes
  - `GET /api/catalog/settings`
  - `GET /api/catalog/categories`
  - `GET /api/catalog/categories/:slug`
  - `GET /api/catalog/brands`
- `publicCatalogCache` middleware as specified in the spec **Catalog caching** table
- Category nav tree: **one** `prisma.category.findMany()`, assemble in memory, sort `name ASC, id ASC` at every level

- [ ] **Step 1: Write the failing tests** (in `server/test/catalog.integration.test.ts`)

```ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { resetDb } from './setup.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('GET /api/catalog/settings', () => {
  it('returns the singleton and sets public cache for anonymous requests', async () => {
    await prisma.storeSettings.upsert({
      where: { id: 'singleton' },
      update: { storeName: 'Aurelia Audio', contactEmail: 'hello@aureliaaudio.demo' },
      create: { id: 'singleton', storeName: 'Aurelia Audio', contactEmail: 'hello@aureliaaudio.demo' },
    });
    const res = await request(app).get('/api/catalog/settings');
    expect(res.status).toBe(200);
    expect(res.body.storeName).toBe('Aurelia Audio');
    expect(res.headers['cache-control']).toMatch(/public/);
    expect(res.headers['cache-control']).toMatch(/max-age=15/);
  });

  it('uses private cache when Authorization is present and no-store on 404', async () => {
    const authed = await request(app).get('/api/catalog/settings').set('Authorization', 'Bearer nope');
    expect(authed.headers['cache-control']).toMatch(/private/);
    expect(authed.headers['cache-control']).not.toMatch(/public/);

    await prisma.storeSettings.deleteMany();
    const missing = await request(app).get('/api/catalog/settings');
    expect(missing.status).toBe(404);
    expect(missing.headers['cache-control']).toMatch(/no-store/);
  });
});

describe('GET /api/catalog/categories', () => {
  it('returns a tree sorted by name then id and details by slug', async () => {
    const headphones = await prisma.category.create({ data: { slug: 'headphones', name: 'Headphones' } });
    await prisma.category.create({ data: { slug: 'over-ear', name: 'Over-ear', parentId: headphones.id } });
    await prisma.category.create({ data: { slug: 'accessories', name: 'Accessories' } });
    const tree = await request(app).get('/api/catalog/categories');
    expect(tree.status).toBe(200);
    expect(tree.body.categories.map((c: { slug: string }) => c.slug)).toEqual(['accessories', 'headphones']);
    expect(tree.body.categories[1].children[0].slug).toBe('over-ear');
    const detail = await request(app).get('/api/catalog/categories/headphones');
    expect(detail.status).toBe(200);
    expect(detail.body.children[0].slug).toBe('over-ear');
    const missing = await request(app).get('/api/catalog/categories/nope');
    expect(missing.status).toBe(404);
  });
});

describe('GET /api/catalog/brands', () => {
  it('returns only brands that have an ACTIVE product', async () => {
    const cat = await prisma.category.create({ data: { slug: 'c1', name: 'C1' } });
    const live = await prisma.brand.create({ data: { slug: 'aurelia', name: 'Aurelia' } });
    await prisma.brand.create({ data: { slug: 'ghost', name: 'Ghost' } });
    await prisma.product.create({
      data: {
        slug: 'live-prod',
        name: 'Live',
        description: 'd',
        categoryId: cat.id,
        brandId: live.id,
        basePrice: '10.00',
        status: 'ACTIVE',
      },
    });
    const res = await request(app).get('/api/catalog/brands');
    expect(res.status).toBe(200);
    expect(res.body.brands.map((b: { slug: string }) => b.slug)).toEqual(['aurelia']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -w server -- test/catalog.integration.test.ts`  
Expected: FAIL with 404 (router unmounted).

- [ ] **Step 3: Implement cache + service + routes + mount**

`cacheControl.ts` — wrap `res.json` so status is known:

```ts
import type { NextFunction, Request, Response } from 'express';

export function publicCatalogCache(req: Request, res: Response, next: NextFunction) {
  const original = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (res.statusCode >= 400) {
      res.setHeader('Cache-Control', 'no-store');
    } else if (req.headers.authorization || req.cookies?.refreshToken) {
      res.setHeader('Cache-Control', 'private, max-age=15');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=15, stale-while-revalidate=60');
    }
    return original(body);
  }) as Response['json'];
  next();
}
```

Also set `no-store` on `res.status(404).json` paths that go through `errorHandler`: the catalog router cannot wrap that. Add a tiny companion in `errorHandler` **only if** tests show 404 cache header missing: set `no-store` for every error JSON in `errorHandler`. That is allowed because it is safer for auth errors too (auth should not be publicly cached). Implement `errorHandler` to `res.setHeader('Cache-Control', 'no-store')` before sending error bodies. Do not change auth JSON shape.

Service methods: `getSettings`, `getCategoryTree`, `getCategoryBySlug`, `getBrands`. Tree assembly:

```ts
type Row = { id: string; slug: string; name: string; parentId: string | null };
function assembleTree(rows: Row[]) {
  const byParent = new Map<string | null, Row[]>();
  for (const row of rows) {
    const key = row.parentId;
    const list = byParent.get(key) ?? [];
    list.push(row);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const walk = (parentId: string | null): { slug: string; name: string; children: ReturnType<typeof walk> }[] =>
    (byParent.get(parentId) ?? []).map((row) => ({ slug: row.slug, name: row.name, children: walk(row.id) }));
  return walk(null);
}
```

Copy `asyncHandler` locally in `catalog.routes.ts` (same 4-liner as auth). Apply `publicCatalogCache` to the router. `GET /categories/:slug` uses `validate(catalogSlugParamSchema, 'params')`.

`app.ts` add: `app.use('/api/catalog', catalogRouter);` before `errorHandler`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -w server -- test/catalog.integration.test.ts test/auth.integration.test.ts`  
Expected: PASS (auth still green; errorHandler `no-store` must not break auth).

- [ ] **Step 5: Commit**

```bash
git add server/src/modules/catalog/cacheControl.ts server/src/modules/catalog/catalog.routes.ts server/src/modules/catalog/catalog.controller.ts server/src/modules/catalog/catalog.service.ts server/src/app.ts server/src/middleware/errorHandler.ts server/test/catalog.integration.test.ts
git commit -m "feat(server): add public catalog settings, categories, brands, and cache headers"
```

---

### Task 5: Product list API (search, filters, sort, pagination)

**Files:**
- Modify: `server/src/modules/catalog/catalog.service.ts`
- Modify: `server/src/modules/catalog/catalog.controller.ts`
- Modify: `server/src/modules/catalog/catalog.routes.ts`
- Create: `server/src/modules/catalog/mapProduct.ts`
- Modify: `server/test/catalog.integration.test.ts` (append)

**Interfaces:**
- Consumes: `productListQuerySchema`, `productListResponseSchema`, `resolveCategoryAndDescendantIds`, `toMoney`, `productInStock` / `variantInStock` / `availableQty`, `escapeIlike`, `NotFoundError`
- Produces: `GET /api/catalog/products` → `{ items, meta }`
- `mapProduct.toCard(productWithIncludes): ProductCardDto`

- [ ] **Step 1: Write the failing tests** (append to the integration file)

Create fixtures: category tree `audio` → `dacs`; two brands; products:

| slug | status | featured | category | brand | basePrice | variants |
|---|---|---|---|---|---|---|
| `alpha` | ACTIVE | false | audio | brand-a | 100.00 | sku A1 stock 5/0 |
| `beta` | ACTIVE | false | dacs | brand-b | 200.00 | sku B1 stock 1/1 (OOS), priceOverride 150.00 |
| `gamma` | DRAFT | true | audio | brand-a | 50.00 | sku G1 stock 9/0 |
| `delta` | ACTIVE | false | audio | brand-a | 100.00 | none |

Give `alpha` and `delta` the **same** `createdAt` by creating them then `prisma.product.update` both `{ createdAt: new Date('2026-01-01T00:00:00Z') }` so `newest` order is `id ASC`.

Assert:

1. Default list omits `gamma`; includes `alpha`, `beta`, `delta`.
2. `q=B1` returns only `beta` (SKU substring). `q=a` → 400. `q=gamma` does not return draft.
3. `category=audio` includes `alpha` and descendant `beta`. `category=missing` → 404.
4. `brand=brand-b` only `beta`. `brand=missing` → 404.
5. `minPrice=140&maxPrice=160` returns `beta` (override). `inStock=true` includes `alpha` (5-4 would also pass) and excludes `beta` (1-1). `inStock=true` includes a dedicated product with stock 5 reserved 4.
6. `sort=price_asc` orders by min effective price then `id`.
7. Same `createdAt` pair: page slices are stable `id ASC` on two requests.
8. `pageSize=1&page=9` → 200, `items: []`, `meta.total` honest.
9. `inStock=TRUE` → 400. No `Authorization` required.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -w server -- test/catalog.integration.test.ts`  
Expected: FAIL — `/products` 404.

- [ ] **Step 3: Implement list**

`GET /products` with `validate(productListQuerySchema, 'query')`.

If `query.category`, `categoryIds = await resolveCategoryAndDescendantIds(query.category)`. If `query.brand`, `findUnique` brand by slug or `NotFoundError`.

Build **one** SQL for matching ids + total (window count), using `Prisma.sql` fragments. Pattern:

```sql
WITH matched AS (
  SELECT p.id,
         p."createdAt",
         p.name,
         COALESCE(
           MIN(COALESCE(v."priceOverride", p."basePrice")),
           p."basePrice"
         ) AS min_price
  FROM "Product" p
  LEFT JOIN "ProductVariant" v ON v."productId" = p.id
  WHERE p.status = 'ACTIVE'
    -- AND p."categoryId" = ANY($categoryIds) when present
    -- AND p."brandId" = $brandId when present
    -- AND (p.name ILIKE $q ESCAPE '\' OR p.description ILIKE $q ESCAPE '\'
    --      OR EXISTS (SELECT 1 FROM "ProductVariant" v2
    --                 WHERE v2."productId" = p.id AND v2.sku ILIKE $q ESCAPE '\'))
    -- price EXISTS / zero-variant basePrice
    -- inStock EXISTS (v."stockQty" - v."reservedQty") > 0
  GROUP BY p.id
)
SELECT id, COUNT(*) OVER()::int AS total
FROM matched
ORDER BY <primary>, id ASC
LIMIT $pageSize OFFSET $offset
```

`$q` bound value is `'%' + escapeIlike(query.q) + '%'`.

Then `findMany({ where: { id: { in: ids } }, include: { brand: true, category: true, variants: true, images: { orderBy: [{ position: 'asc' }, { id: 'asc' }] } } })` and **reorder** to SQL id order.

`mapProduct.toCard`: `priceFrom`/`priceTo` from variant effective prices or `basePrice`; `thumbnail` = first image or null; `inStock` via `productInStock`.

`meta.totalPages` = `total === 0 ? 0 : Math.ceil(total / pageSize)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -w server -- test/catalog.integration.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/modules/catalog/catalog.service.ts server/src/modules/catalog/catalog.controller.ts server/src/modules/catalog/catalog.routes.ts server/src/modules/catalog/mapProduct.ts server/test/catalog.integration.test.ts
git commit -m "feat(server): add catalog product listing with search, filters, and pagination"
```

---

### Task 6: Product detail API

**Files:**
- Modify: `server/src/modules/catalog/mapProduct.ts` (`toDetail`)
- Modify: `server/src/modules/catalog/catalog.service.ts` / routes / controller
- Modify: `server/test/catalog.integration.test.ts`

**Interfaces:**
- Consumes: `catalogSlugParamSchema`, `productDetailResponseSchema`
- Produces: `GET /api/catalog/products/:slug` → `{ product: ProductDetailDto }`
- `product.inStock` rollup **and** each `variant.inStock` / `availableQty` use the Task 2 helpers
- Variants ordered `createdAt ASC, id ASC`. Images `position ASC, id ASC`.
- Server ignores `?variant=` (client-only)

- [ ] **Step 1: Write the failing tests**

- ACTIVE slug returns variants with `availableQty` and `inStock`, `price` using `priceOverride` when set.
- DRAFT and ARCHIVED slugs → 404 (same as missing).
- Product-level `inStock` is true if any variant has `stockQty - reservedQty > 0`.
- Response has no product UUID field (`body.product.id` undefined).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w server -- test/catalog.integration.test.ts`  
Expected: FAIL on the new cases.

- [ ] **Step 3: Implement `getProductBySlug`**

`findFirst({ where: { slug, status: 'ACTIVE' }, include: { brand, category, variants: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }, images: { orderBy: [{ position: 'asc' }, { id: 'asc' }] } } })`. Missing → `NotFoundError`. Map with `toDetail`.

Register this route **after** `GET /` list if they share `/products` — list is `GET /products`, detail is `GET /products/:slug`.

- [ ] **Step 4: Run tests to verify they pass**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/modules/catalog server/test/catalog.integration.test.ts
git commit -m "feat(server): add public product detail catalog endpoint"
```

---

### Task 7: Home API and typed content blocks

**Files:**
- Modify: catalog service/controller/routes
- Create: `server/test/catalog.home.test.ts`

**Interfaces:**
- Consumes: `homeResponseSchema`, `heroContentSchema`, `contentBlockPayloadSchemaByType`, `ContentBlockType`
- Produces: `GET /api/catalog/home` → `{ hero, blocks, featured }`
- Featured: `ACTIVE AND featured`, `createdAt DESC, id ASC`, max 8
- Invalid payload → omit block (do not throw). Collection products in stored slug order; drop non-ACTIVE/missing; omit block if none remain. Response collection `payload` is `{ title }` only.

- [ ] **Step 1: Write the failing tests**

- Valid BANNER + ANNOUNCEMENT + FEATURED_COLLECTION return typed `blocks` (discriminated `type`).
- Block with `payload: { nope: true }` is omitted; sibling valid block remains.
- Collection slug `gamma` (DRAFT) dropped; remaining ACTIVE slugs keep seed order.
- Featured omits DRAFT even if `featured: true`.
- `heroContent: {}` → `hero: null`. Valid hero parses.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w server -- test/catalog.home.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Implement `getHome`**

Load settings, active blocks `orderBy: [{ position: 'asc' }, { id: 'asc' }]`, featured products with the same include as cards. Parse payloads with the per-type Zod schema. Resolve collection slugs with `findMany({ where: { slug: { in: slugs }, status: 'ACTIVE' } })` then sort by the slug array index.

- [ ] **Step 4: Run tests to verify they pass**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/modules/catalog server/test/catalog.home.test.ts
git commit -m "feat(server): add catalog home payload with typed content blocks"
```

---

### Task 8: Realistic catalog seed

**Files:**
- Modify: `server/prisma/seed.ts`

**Interfaces:**
- Consumes: existing production guard and user upserts
- Produces: idempotent catalog matching spec **Seed-data strategy** and required fixture table

- [ ] **Step 1: Write a failing assertion test** (in `server/test/catalog.home.test.ts` or a dedicated `server/test/catalog.seed.test.ts`)

Do **not** call seed against the test DB from `resetDb` tests that expect empty tables. Instead add `server/test/catalog.seed-contract.test.ts` that imports helper functions **extracted** from seed:

Extract `server/prisma/catalogSeed.ts` with `seedCatalog(prisma)` used by `seed.ts`. Test calls `resetDb()` then `seedCatalog(prisma)` then:

```ts
expect(await prisma.product.count({ where: { status: 'ACTIVE' } })).toBeGreaterThanOrEqual(20);
expect(await prisma.product.findUnique({ where: { slug: 'aurelia-lab-prototype' } })).toMatchObject({ status: 'DRAFT' });
expect(await prisma.product.findUnique({ where: { slug: 'helix-classic-v1' } })).toMatchObject({ status: 'ARCHIVED' });
const nova = await prisma.productVariant.findUnique({ where: { sku: 'NOV-BLK-00' } });
expect(nova).toBeTruthy();
expect(await request(app).get('/api/catalog/products/aurelia-lab-prototype').status).toBe(404);
expect(await request(app).get('/api/catalog/products?q=NOV-BLK').body.items[0].slug).toBe('aurelia-nova');
```

This test will fail until seed exists.

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL.

- [ ] **Step 3: Implement seed**

Categories (upsert by slug): `headphones` → `over-ear`, `in-ear`; `home-audio` → `dacs`, `amplifiers`; `accessories` → `cables`.  
Brands: `aurelia`, `sable`, `northwind`, `helix`.

Required products (plus enough extra ACTIVE rows to reach ≥20), each with ≥1 variant and ≥2 `https://picsum.photos/seed/{slug}-{n}/800/800` images and real `altText`:

- `aurelia-nova` ACTIVE featured over-ear, SKU `NOV-BLK-00` in stock
- `sable-ion` ACTIVE in-ear, at least one `priceOverride`
- `northwind-restock` ACTIVE, all variants `stockQty = 0`
- `helix-lineage` ACTIVE, mixed in-stock / OOS variants
- `aurelia-lab-prototype` DRAFT
- `helix-classic-v1` ARCHIVED

Upsert products by slug with **non-empty `update`**. Upsert variants by SKU. Replace images per product (deleteMany + create). `contentBlock.deleteMany` then insert one of each type, all `active`, FEATURED_COLLECTION slugs include `aurelia-nova`. Update `StoreSettings` `heroContent` to a valid `heroContentSchema` object (`ctaHref: '/c/headphones'`).

`seed.ts` calls `seedCatalog` after users.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -w server -- test/catalog.seed-contract.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/prisma/seed.ts server/prisma/catalogSeed.ts server/test/catalog.seed-contract.test.ts
git commit -m "feat(server): seed a realistic public audio catalog"
```

---

### Task 9: Client parse helpers, URL helpers, presentational catalog components

**Files:**
- Create: `client/src/lib/parseCatalog.ts` and `.test.ts`
- Create: `client/src/lib/listUrl.ts` and `.test.ts`
- Create: `client/src/lib/selectVariant.ts` and `.test.ts`
- Create: `client/src/components/catalog/Price.tsx` and `.test.tsx`
- Create: `client/src/components/catalog/ProductCard.tsx` and `.test.tsx`
- Create: `client/src/components/catalog/ProductGrid.tsx`
- Create: `client/src/components/catalog/FilterBar.tsx`
- Create: `client/src/components/catalog/Pagination.tsx` and `.test.tsx`
- Create: `client/src/components/catalog/ImageGallery.tsx`
- Create: `client/src/components/catalog/VariantPicker.tsx`

**Interfaces:**
- Consumes: shared catalog schemas, `ApiError`, `Button`, `Input`, `Link`
- Produces:
  - `parseCatalog(schema, data)`
  - `writeListParams(current, patch, mode: 'filter' | 'page'): URLSearchParams`
  - `selectVariantSku(product, requested): string | null`
  - presentational components only (no fetching)

- [ ] **Step 1: Write the failing tests**

`parseCatalog.test.ts`: valid list envelope returns typed data; extra `id` on a card throws `ApiError` with status 500 / code `INVALID_RESPONSE`.

`listUrl.test.ts`:

```ts
it('resets page on filter changes and omits defaults', () => {
  const current = new URLSearchParams('page=3&sort=price_asc');
  const next = writeListParams(current, { sort: 'newest' }, 'filter');
  expect(next.get('page')).toBeNull();
  expect(next.get('sort')).toBeNull();
});
it('pushes page without dropping sort', () => {
  const current = new URLSearchParams('sort=name_asc');
  const next = writeListParams(current, { page: '2' }, 'page');
  expect(next.get('page')).toBe('2');
  expect(next.get('sort')).toBe('name_asc');
});
```

`selectVariant.test.ts`: SKU on the product is kept; SKU `NOV-BLK-00` is ignored when the product’s variants are only `HEL-BLK-01` / `HEL-SLV-01`; falls back to first `inStock` then first variant.

`ProductCard.test.tsx`: render with MemoryRouter; card is a link to `/p/aurelia-nova`.

`Pagination.test.tsx`: clicking page 2 calls `onPage(2)` (or sets search params via a mock). Disabled prev on page 1 has `aria-disabled`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -w client`  
Expected: FAIL — files missing.

- [ ] **Step 3: Implement**

`parseCatalog.ts`:

```ts
import type { ZodType } from 'zod';
import { ApiError } from './apiClient.js';

export function parseCatalog<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ApiError(500, 'INVALID_RESPONSE', 'Unexpected catalog response');
  }
  return result.data;
}
```

`writeListParams`: start from `current`; apply `patch` (delete key when value is `undefined` or `''`); if `mode === 'filter'`, `delete('page')`; then delete defaults `sort=newest`, `page=1`, `pageSize=24`.

`selectVariantSku`:

```ts
import type { ProductDetailDto } from '@audio-commerce/shared';

export function selectVariantSku(product: ProductDetailDto, requested: string | null): string | null {
  const allowed = new Set(product.variants.map((v) => v.sku));
  if (requested && allowed.has(requested)) return requested;
  return product.variants.find((v) => v.inStock)?.sku ?? product.variants[0]?.sku ?? null;
}
```

`Price`: `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`; if `from !== to` show a range.

`ProductCard`: `<Link to={`/p/${product.slug}`}>`; thumbnail `width={800} height={800} loading="lazy"`; `Price`.

`Pagination`: `<nav aria-label="Pagination">`; window first, last, current ± 2; `onPage`; `aria-current="page"`.

`VariantPicker`: `role="radiogroup"` per attribute key; chip text is the value (color name), never color-only.

`FilterBar`: `<form aria-label="Filter products">` with `Input` search, brand `<select>`, min/max price, in-stock checkbox, sort `<select>`. Submit/onChange calls parent. No fetch.

Use token classes only (`text-ink`, `border-border`, `rounded-md`, `duration-snap`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -w client`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/parseCatalog.ts client/src/lib/parseCatalog.test.ts client/src/lib/listUrl.ts client/src/lib/listUrl.test.ts client/src/lib/selectVariant.ts client/src/lib/selectVariant.test.ts client/src/components/catalog
git commit -m "feat(client): add catalog DTO parsing, URL helpers, and presentational components"
```

---

### Task 10: Product listing pages and URL state

**Files:**
- Create: `client/src/pages/ProductListPage.tsx`
- Create: `client/src/pages/ProductListPage.test.tsx`
- Modify: `client/src/App.tsx` (list + category routes only; home/detail may still be placeholders until Task 11)

**Interfaces:**
- Consumes: `apiFetch`, `parseCatalog(productListResponseSchema | categoryDetailDtoSchema | brandsResponseSchema)`, `writeListParams`, `FilterBar`, `ProductGrid`, `Pagination`, `EmptyState`, `ErrorState`, `Skeleton`
- Produces: `ProductListPage` for `/products` and `/c/:categorySlug`
- Fetch: `GET /api/catalog/products?...` with `category` from path when on `/c/:slug`. Abort on param change.
- Filter changes: `setSearchParams(writeListParams(..., 'filter'), { replace: true })`
- Pagination: `setSearchParams(writeListParams(..., 'page'), { replace: false })`

- [ ] **Step 1: Write the failing tests**

Mock `apiFetch` to resolve a valid `productListResponseSchema` object. Render with `MemoryRouter` initial `/products?q=nova&page=3`.

- Changing sort to `newest` results in search params **without** `page` and **without** `sort`.
- Clicking pagination page 2 (when current page is 1 and `totalPages` is 3) results in `page=2` present.
- When API returns `items: []`, `total: 0`, and URL has `q=zzz`, show “No matching products” and a clear-filters button.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w client -- src/pages/ProductListPage.test.tsx`  
Expected: FAIL.

- [ ] **Step 3: Implement `ProductListPage`**

On `/c/:categorySlug`, fetch category detail in parallel; 404 → `ErrorState` “Category not found” without retry, link to `/products`.  
List fetch builds query from search params + implied category (do not put `category` in the URL on `/c/:slug`).  
`document.title` = category name or `Shop`.  
`h1` with `tabIndex={-1}` focused on navigation.  
Skip link “Skip to products” to `#product-grid`.  
Skeleton grid while fetching. `aria-busy` on the region. `aria-live="polite"` count.  
If `meta.totalPages > 0 && meta.page > meta.totalPages`, `replace` to last page.

- [ ] **Step 4: Wire routes in `App.tsx`**

```tsx
const ProductListPage = lazy(() => import('./pages/ProductListPage.js'));
// inside StorefrontLayout:
<Route path="products" element={<ProductListPage />} />
<Route path="c/:categorySlug" element={<ProductListPage />} />
```

Leave index as the Phase 1 placeholder until Task 11.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test -w client`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/ProductListPage.tsx client/src/pages/ProductListPage.test.tsx client/src/App.tsx
git commit -m "feat(client): add catalog listing pages with shareable filter URL state"
```

---

### Task 11: PDP, homepage, storefront chrome

**Files:**
- Create: `client/src/pages/ProductDetailPage.tsx` + `.test.tsx`
- Create: `client/src/pages/HomePage.tsx`
- Modify: `client/src/layouts/StorefrontLayout.tsx`
- Modify: `client/src/App.tsx` (replace index placeholder; add `/p/:productSlug`)

**Interfaces:**
- Consumes: `homeResponseSchema`, `productDetailResponseSchema`, `storeSettingsDtoSchema`, `categoriesResponseSchema`, `selectVariantSku`, `ImageGallery`, `VariantPicker`, `Price`
- Produces: Home from `GET /api/catalog/home` only; PDP from `GET /api/catalog/products/:slug`; layout chrome from settings + categories
- No add-to-cart. `document.title` from `seoTitle ?? name`. Meta description from `seoDescription` when present.
- `?variant=` validated with `selectVariantSku`; if requested SKU is not on this product, `replace` to the resolved SKU

- [ ] **Step 1: Write the failing PDP tests**

Mock `apiFetch` with a `ProductDetailDto` whose variants are `HEL-BLK-01` (inStock true) and `HEL-OOS-01` (`inStock: false`, `availableQty: 0`).

- Render at `/p/helix-lineage?variant=NOV-BLK-00` (foreign SKU). Expect the selected control to be `HEL-BLK-01`, not Nova, and price of `HEL-BLK-01`.
- Clicking the OOS variant updates the URL to `variant=HEL-OOS-01` and shows it as unavailable (`inStock === false` / “Out of stock”).
- No button whose name matches `/cart|buy|checkout/i`.

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL.

- [ ] **Step 3: Implement PDP, Home, layout, routes**

PDP: parse `productDetailResponseSchema`; 404 → “Product not found” without retry. Gallery primary image `fetchpriority="high"`. Variant picker onChange `setSearchParams({ variant: sku }, { replace: true })`. Show `availableQty` and `inStock` for the selected variant; product rollup `inStock` may be used for a single badge. Continue-browsing link to `/products`.

Home: parse `homeResponseSchema`. Switch on `block.type` only (`BANNER` / `ANNOUNCEMENT` / `FEATURED_COLLECTION`). Never pass `payload` through as untyped JSON. Hero CTA uses `ctaHref` from the DTO (already an `InternalPath`). Featured + collection use `ProductGrid`. Empty home: short message + Shop link.

Layout: parallel `GET /api/catalog/settings` and `GET /api/catalog/categories`. On failure, keep the literal `Aurelia Audio` and existing auth links. On success, store name from DTO; header links to `/products` and top-level category slugs (`/c/${slug}`). Below `md`, wrap extra shop links in `<details>`. No cart/wishlist links. `logout()` may stay as today.

`App.tsx` index: `<HomePage />`. Path `p/:productSlug`: `<ProductDetailPage />`.

- [ ] **Step 4: Run client tests to verify they pass**

Run: `npm run test -w client`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/ProductDetailPage.tsx client/src/pages/ProductDetailPage.test.tsx client/src/pages/HomePage.tsx client/src/layouts/StorefrontLayout.tsx client/src/App.tsx
git commit -m "feat(client): add catalog home, product detail, and storefront chrome"
```

---

### Task 12: Playwright smoke and Phase 2 verification

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/catalog.spec.ts`
- Modify: `package.json` (root) add `test:e2e`
- Modify: `.gitignore` add `test-results/` and `playwright-report/`

**Interfaces:**
- Consumes: running Vite (`5173`) + Express (`4000`) with **dev** DB seeded (`npm run prisma:seed -w server`). Never `resetDb()` here.
- Produces: four spec smokes from the design spec

- [ ] **Step 1: Add Playwright as a root devDependency and a failing spec**

```bash
npm install -D playwright @playwright/test
```

`playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:5173' },
  webServer: [
    { command: 'npm run dev -w server', port: 4000, reuseExistingServer: true },
    { command: 'npm run dev -w client', port: 5173, reuseExistingServer: true },
  ],
});
```

`e2e/catalog.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('home shows seeded featured nova', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /nova/i })).toBeVisible();
});

test('product detail shows known SKU', async ({ page }) => {
  await page.goto('/p/aurelia-nova');
  await expect(page.getByText('NOV-BLK-00')).toBeVisible();
});

test('search finds nova by SKU fragment', async ({ page }) => {
  await page.goto('/products?q=NOV-BLK');
  await expect(page.getByRole('link', { name: /nova/i })).toBeVisible();
});

test('draft slug is not found', async ({ page }) => {
  await page.goto('/p/aurelia-lab-prototype');
  await expect(page.getByText(/not found/i)).toBeVisible();
});
```

Root script: `"test:e2e": "playwright test"`. Do **not** add Playwright to `npm run test` (no browsers on that gate).

- [ ] **Step 2: Run e2e to verify failure or missing seed/UI**

Run: `npx playwright install` then `npm run prisma:seed -w server` then `npm run test:e2e`  
Expected: FAIL until Task 8–11 are present; after those tasks, these should be the last reds to fix (selectors).

- [ ] **Step 3: Adjust selectors only if copy differs; do not weaken assertions**

Use roles/text already required by the pages. Do not `test.skip`.

- [ ] **Step 4: Full Phase 2 gate**

```bash
npm run lint
npm run typecheck
npm run test
npm run build
git diff --check
npm run test:e2e
```

Expected: all PASS. Confirm production client build has no `.map`. Confirm `client/src` has no hardcoded catalog product arrays (tests/fixtures/route constants excepted). Confirm no add-to-cart.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts e2e/catalog.spec.ts package.json package-lock.json .gitignore
git commit -m "test(e2e): add Playwright smokes for the public catalog"
```

---

## Self-review (spec coverage)

| Spec requirement | Task |
|---|---|
| Shared Zod for every catalog endpoint; client `safeParse` | 1, 9, 10, 11 |
| Bounded query validation (`q`, prices, min≤max, page, sort, boolean) | 1, 5 |
| Recursive CTE descendants, no N+1 | 3, 5 |
| `id ASC` tie-breaker on every sort | 4 (trees), 5 (list), 6 (detail), 7 (home) |
| `availableQty = stockQty - reservedQty`; consistent `inStock` | 2, 5, 6, 11 |
| Filter/sort/`q` resets page; replace vs push | 9, 10 |
| PDP variant SKU must belong to current product | 9, 11 |
| Per-type ContentBlock schemas; no raw JSON in UI | 1, 7, 11 |
| Substring ILIKE search; no engine/indexes | 2, 5 |
| Short public cache; never public-cache authed-looking requests | 4 |
| Seed fixtures + ACTIVE-only public reads | 8, 5, 6 |
| Playwright smokes | 12 |
| No cart/checkout/admin CRUD | Global + 11 assertion |
| Loading/empty/error/a11y/responsive | 10, 11 (primitives + layout rules) |
