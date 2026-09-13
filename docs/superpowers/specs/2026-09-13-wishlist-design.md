# Wishlist — Design Spec

## Objective

Give authenticated customers a persistent, private wishlist: save products for later, see saved state on product cards and the PDP, and manage the list from a dedicated page.

## Existing architecture reused

- **Schema**: `Wishlist` / `WishlistItem` models already exist (`server/prisma/schema.prisma`), one `Wishlist` per `User`, `WishlistItem` unique on `(wishlistId, productId)` — product-level, not variant-level. No migration needed.
- **Server pattern**: route → controller → service → Prisma, copied from `server/src/modules/cart/*`. `requireAuth` middleware, `validate` middleware, `AppError` subclasses, shared Zod contracts in `shared/src/schemas`.
- **Card mapping**: reuse `toCard()` from `server/src/modules/catalog/mapProduct.ts` and the `productListInclude` Prisma include (exported from `catalog.service.ts`) so wishlist product cards are byte-identical in shape/logic to catalog product cards — no duplicate pricing/availability logic.
- **Client pattern**: a `WishlistContext` modeled directly on `CartContext.tsx` (same load/refresh/error shape), `apiFetch`/`parseCatalog` for requests, `Button`/`EmptyState`/`ErrorState`/`Skeleton`/`Breadcrumbs`/`ToastContext` for UI, `ProtectedRoute` for the page route.

## Identity: product-level, addressed by slug

Catalog DTOs (`ProductCardDto`, `ProductDetailDto`) deliberately never expose the internal `Product.id` to the client — only `slug`. Rather than adding `id` to those public contracts (a wider, unrelated change), the wishlist API is addressed by **slug**: `POST /api/wishlist/items { slug }` and `DELETE /api/wishlist/items/:slug`. The server resolves slug → `Product.id` internally before touching `WishlistItem`. This keeps the wishlist feature additive and leaves existing catalog contracts untouched.

## API

All routes under `/api/wishlist`, mounted in `server/src/app.ts`, and require `requireAuth` (401 if missing/invalid token). The identity used for every operation is `req.user!.id` — no user id ever comes from the client, so there is no IDOR surface (identical to how `cart` scopes everything off `req.user!.id`).

```
GET    /api/wishlist              -> WishlistDto
POST   /api/wishlist/items        body: { slug }   -> WishlistDto
DELETE /api/wishlist/items/:slug                    -> WishlistDto
```

- `GET`: lazily creates the user's `Wishlist` row if missing (same `getOrCreate` pattern as `cart.service.ts`), returns items newest-first.
- `POST`: looks up the product by `slug` and requires `status === 'ACTIVE'` (mirrors `getProductBySlug` / `assertVariantPurchasable`); 404 if missing or inactive. Adds via `prisma.wishlistItem.upsert` keyed on the `(wishlistId, productId)` unique constraint — this is atomic and race-safe, so concurrent duplicate adds never throw and never create two rows (no "check then insert" TOCTOU gap).
- `DELETE`: `deleteMany({ where: { wishlistId, productId } })` — idempotent, 200 whether or not the item existed (matches cart's `removeItem`).
- Validation: `slug` in the body/param must satisfy the existing `slugSchema`; malformed input → 400 `VALIDATION_ERROR` via the existing `validate` middleware. Unknown/inactive product → 404. All errors go through the existing `errorHandler` (no stack traces leaked).

## DTOs (`shared/src/schemas/wishlist.ts`)

```ts
wishlistItemDtoSchema = { addedAt: string; product: productCardDtoSchema }
wishlistDtoSchema = { items: wishlistItemDtoSchema[] }
addWishlistItemSchema = { slug: slugSchema }
```

## Frontend

- `WishlistContext` (`client/src/context/WishlistContext.tsx`): loads the wishlist once the user is authenticated (mirrors `CartContext`'s `status` gate), exposes `{ items, loading, error, isWishlisted(slug), addProduct(slug), removeProduct(slug), refresh }`. `isWishlisted` is backed by a `Set<string>` derived from `items` for O(1) lookups. Mounted in `RootLayout.tsx` alongside `CartProvider`.
- `WishlistButton` (`client/src/components/WishlistButton.tsx`): a reusable icon button (outline/filled heart) used in both `ProductCard` and `ProductDetailPage` — the single implementation of the toggle behavior. Props: `slug`. Behavior:
  - Unauthenticated click → `navigate('/login')` (same pattern as `handleAddToCart`).
  - Authenticated click → optimistic-free, awaited `addProduct`/`removeProduct` call; `aria-pressed` reflects wishlist state; `aria-label` is "Add to wishlist" / "Remove from wishlist" (never conveyed by icon color alone); disabled + `aria-busy` while its own request is in flight; on failure, shows a toast and state simply doesn't change (no rollback needed since it's not optimistic).
- `ProductCard.tsx`: restructured so the wishlist button is a sibling overlay (`absolute`, top-right of the image) *outside* the `<Link>`, not nested inside it (nesting a `<button>` inside an `<a>` is invalid HTML and breaks keyboard/AT semantics). Click handled with its own `stopPropagation`.
- `ProductDetailPage.tsx`: `WishlistButton` placed next to "Add to cart" / "Buy now".
- `WishlistPage.tsx` (`client/src/pages/WishlistPage.tsx`): new route `/wishlist`, added under the existing `<ProtectedRoute>` block in `App.tsx` next to `/cart`. Lists items as cards (reusing `ProductGrid`/`ProductCard` — the same wishlist button here doubles as "remove"), loading skeleton, empty state ("Your wishlist is empty" + link to `/products`), error state with retry.
- `StorefrontLayout.tsx`: add a "Wishlist" link next to the cart icon (small heart icon, only when the item count is worth showing is not required — a plain link is enough, no badge needed since a badge on the cart already exists as precedent but wishlist doesn't require the same urgency).

## Duplicate / race handling

- Server: `upsert` on the compound unique key is the single source of truth; the client also disables the button while a request is in flight, but that is a UX nicety, not the correctness mechanism.

## Availability semantics

- A product must be `ACTIVE` to be *added*. Once added, if a product later becomes `DRAFT`/`ARCHIVED`, its `WishlistItem` row is left alone (no cascading removal) — the wishlist still lists it (consistent with "this is the user's saved-for-later list, not a live availability feed"). Navigating to its PDP goes through the existing catalog 404 semantics unchanged. This is called out explicitly as intended behavior, not a gap.
- If the underlying `Product` row is hard-deleted, `onDelete: Cascade` on `WishlistItem.product` removes the wishlist row automatically (already declared in the schema).

## Accessibility

- Heart toggle is a real `<button>` with `aria-pressed` + explicit `aria-label`, keyboard-operable (native button semantics), visible focus ring (existing `focus-visible:ring-accent` utility reused), real `disabled` while pending.
- Wishlist page empty/error/loading states reuse existing `EmptyState`/`ErrorState`/`Skeleton` components, already accessible (`role="alert"` on error).

## Testing

- **Shared**: `addWishlistItemSchema` — valid slug, missing field, wrong type, malformed slug.
- **Server** (`server/test/wishlist.integration.test.ts`): unauthenticated → 401; empty wishlist; add valid product; duplicate add stays idempotent (single row, verified via a second `GET`); remove item; remove of an item that was never added (still 200, still empty); add with unknown slug → 404; add with inactive (DRAFT) product → 404; malformed body → 400; user isolation (user B's wishlist unaffected by user A's writes, and user B's `GET` never contains user A's items).
- **Client**: `WishlistButton` (unauthenticated redirect, toggle add/remove, disabled while pending, accessible name changes, API-failure toast), `WishlistPage` (loading/empty/error/populated/remove), `ProductCard`/`ProductDetailPage` wishlist toggle wiring.
- **E2E** (extend `e2e/`): login → open a product → add to wishlist → open `/wishlist` → verify it's listed → remove it → verify empty state.

## Non-goals

- Variant-level wishlisting.
- Sharing/public wishlists.
- "Move to cart" from the wishlist (kept out to avoid scope creep beyond view/add/remove/navigate).
- Price-drop or back-in-stock notifications.
- Any change to `ProductCardDto`/`ProductDetailDto` shape.
