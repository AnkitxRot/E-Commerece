# Customer Reviews + Admin Moderation — Design Spec

## Objective

Complete the review feature vertical. The `Review` model, `ReviewStatus` enum, and the public read path (approved reviews on the PDP) already exist. What's missing: an authenticated customer write path, and an admin moderation queue. This spec covers only that gap.

## Existing architecture reused

- **Schema**: `Review` (`server/prisma/schema.prisma`) already has `rating`, `body`, `status` (`PENDING`/`APPROVED`/`REJECTED`, default `PENDING`), and `@@unique([productId, userId])`. No migration needed — the write path was simply never built.
- **Cached aggregates**: `Product.ratingAvg` / `Product.reviewCount` already exist on the schema and are already *read* everywhere (`mapProduct.ts`, catalog sort/related-products queries) but are never *written* anywhere in the codebase. This spec adds the missing write: recomputed on approval, inside the same transaction as the status change.
- **Server pattern**: route → controller → service → Prisma, copied from `server/src/modules/wishlist/*` (customer write, slug-addressed, `requireAuth`) and `server/src/modules/admin/orders/*` (admin list/detail + status-transition mutation with `recordAudit`).
- **Client pattern**: `apiFetch`/`parseCatalog`, `Button`/`Input`/`Toast`/`ErrorState`/`EmptyState`/`Skeleton`, `ProtectedRoute` for the admin route, `AdminLayout` nav for the moderation page.

## Business rules (derived from the existing schema, not invented)

- **Rating**: integer 1–5 (matches the existing `reviewSummaryDtoSchema.rating`).
- **Body**: 1–2000 chars, trimmed (matches the existing `reviewSummaryDtoSchema.body`).
- **No title field** — not in the schema.
- **No anonymous reviews** — `authorName` is always derived server-side from `req.user!.id` → `User.name`, exactly like the existing read path derives it from `review.user.name`. The client never supplies identity.
- **Auth required**: `requireAuth`; 401 otherwise.
- **One review per user per product**: enforced by the existing DB unique constraint. A second attempt → 409 `CONFLICT`, not a raw Prisma error.
- **No verified-purchase requirement**: the schema has no link between `Review` and `Order`/`OrderItem`. Adding one would mean a migration for a rule the schema doesn't currently express — out of scope for this milestone. Documented as a non-goal below.
- **Moderation is mandatory**: every new review is created `PENDING` (schema default).
- **Visibility**: only `APPROVED` reviews are public — already enforced by `getProductBySlug`'s `status: 'APPROVED'` filter. `PENDING`/`REJECTED` are never returned to the storefront.
- **Moderation transitions**: `PENDING → APPROVED` or `PENDING → REJECTED` only, one-directional (mirrors `ORDER_STATUS_TRANSITIONS`). A review already decided cannot be re-moderated → 409. This keeps the aggregate recompute simple: a rating is added to the product's average exactly once, on its one approval.
- **Product must be `ACTIVE`** to be reviewed (mirrors wishlist's `findActiveProductBySlug`) — 404 for missing/inactive.
- **No customer edit/delete** in this milestone — smallest correct implementation; see non-goals.

## API

### Customer — `POST /api/products/:slug/reviews`

A new top-level mount (`app.use('/api/products/:slug/reviews', reviewsRouter)`), separate from `/api/catalog/products` because catalog routes are deliberately public/cached (`publicCatalogCache`) and read-only; review creation is authenticated and mutating.

```
POST /api/products/:slug/reviews
Authorization: Bearer <token>
{ "rating": 1-5, "body": "1-2000 chars" }
-> 201 { review: ReviewSummaryDto }   // status will be PENDING
```

- 401 unauthenticated.
- 400 malformed `rating`/`body`.
- 404 unknown or non-`ACTIVE` product slug.
- 409 the user already reviewed this product.

The response includes the created review (with its `PENDING` status is implied — the client already knows it just submitted) so the PDP can show an immediate "submitted, pending approval" confirmation without a separate "my reviews" endpoint.

### Admin — `server/src/modules/admin/reviews/*`, mounted at `/api/admin/reviews`

```
GET   /api/admin/reviews?status=PENDING&page=1&pageSize=20  -> { items: AdminReviewSummaryDto[], meta }
PATCH /api/admin/reviews/:id/status   { status: 'APPROVED' | 'REJECTED' }  -> { review: AdminReviewSummaryDto }
```

- `requireAuth` + `requireRole(ADMIN)` (already applied at the `adminRouter` level).
- List defaults to no filter (all statuses) so admins can see history, but the moderation UI defaults its own query param to `PENDING`.
- Each row includes enough to moderate without a drill-down: product name + slug, reviewer name + email, rating, body, status, createdAt.
- `PATCH` validates the transition (`PENDING` only), applies it, and — only for `APPROVED` — recomputes `Product.ratingAvg`/`reviewCount` from `prisma.review.aggregate` over that product's `APPROVED` reviews, all inside one `$transaction`. Records an audit log entry (`review.approve` / `review.reject`) via the existing `recordAudit` helper.
- Invalid transition (already `APPROVED`/`REJECTED`) → 409.
- Unknown id → 404.

## DTOs (`shared/src/schemas/reviews.ts`, new file, exported from `shared/src/index.ts`)

```ts
createReviewInputSchema = { rating: int 1-5, body: string 1-2000 }.strict()
// reviewSummaryDtoSchema already exists in catalog.ts — reused as the create response shape

adminReviewSummaryDtoSchema = {
  id, rating, body, status: ReviewStatus, createdAt,
  product: { slug, name },
  reviewer: { name, email },
}.strict()
adminReviewListQuerySchema = paginationQuerySchema.extend({ status: ReviewStatus.optional() })
adminReviewListResponseSchema = { items: adminReviewSummaryDtoSchema[], meta: paginationMetaSchema }
updateReviewStatusInputSchema = { status: z.enum([APPROVED, REJECTED]) }  // PENDING is never a target
adminReviewResponseSchema = { review: adminReviewSummaryDtoSchema }
```

## Frontend

- **`ReviewForm`** (`client/src/components/reviews/ReviewForm.tsx`): star-rating input (radio-group semantics: `role="radiogroup"`, 5 buttons with `aria-checked`, arrow-key navigation, visible focus, label "Rate this product") + a `<textarea>` (reusing `Input`-style label/error/`aria-describedby` conventions) + submit `Button`. On success, replaces itself with a confirmation message ("Thanks — your review is awaiting approval.") rather than resetting to a blank form (a user cannot submit twice anyway, per the one-review-per-product rule).
- **`ProductDetailPage.tsx`**: below the existing reviews list, show `ReviewForm` for a logged-in user who hasn't already reviewed this product; a "You already reviewed this product" note if `product.reviews` (only approved ones are visible, so this can't detect a pending review from the read model) — see the note below on how "already reviewed" is actually determined.
  - Since the public PDP payload only ever contains *approved* reviews, the client cannot infer "have I already submitted a pending one" from `product.reviews`. Simplest correct approach: attempt the POST; a 409 response is caught and rendered as the "already reviewed" state inline (same pattern as the wishlist's error-toast-on-failure, but here it's an expected, non-error outcome so it gets its own inline message, not a toast). This avoids adding a new read endpoint just to answer one boolean.
  - Unauthenticated visitors see a "Log in to write a review" prompt linking to `/login` (same convention as `WishlistButton`'s unauthenticated redirect).
- **`AdminReviewsPage.tsx`** (`client/src/pages/AdminReviewsPage.tsx`): table modeled directly on `AdminOrdersPage.tsx` — status filter `<select>` (defaults to `PENDING`), paginated rows (product, reviewer, rating as static stars, body truncated with full text on hover/`title`, status, Approve/Reject buttons shown only when `status === 'PENDING'`). No drill-down detail page — a review has no sub-resources worth a separate route, so inline actions keep this focused (Phase 12: avoid an unnecessary generic dashboard template).
- **`AdminLayout.tsx`**: add a "Reviews" nav item.
- **`App.tsx`**: add `admin/reviews` route (lazy-loaded, inside the existing `ProtectedRoute role={Role.ADMIN}` block).

## Accessibility

- Star rating input: `role="radiogroup"` with an accessible group label, five `role="radio"` buttons with `aria-checked`, full keyboard operability (Tab to the group, Arrow keys to change selection — native radio semantics), never conveyed by color alone (filled/outline icon + `aria-checked` + a visible numeric label "3 of 5").
- Textarea: real `<label>`, `aria-invalid` + `aria-describedby` on validation failure (same as `Input.tsx`).
- Submit button: `aria-busy` + disabled while in flight (same as `Button.tsx`/`WishlistButton.tsx`).
- Admin Approve/Reject buttons: real `<button>`s with accessible names including context (e.g. `aria-label="Approve review by {name} for {product}"`) so the action is unambiguous when read out of table-row context.
- Status is never color-only: each row also prints the status word.

## Testing

### Shared
`createReviewInputSchema` / `updateReviewStatusInputSchema`: valid input, invalid rating (0, 6, non-integer), invalid body (empty, >2000 chars), malformed payload (extra/missing fields — `.strict()`).

### Server (`server/test/reviews.integration.test.ts`, `server/test/admin.reviews.test.ts`)
1. unauthenticated create → 401
2. authenticated valid review → 201, `status: PENDING`
3. invalid rating → 400
4. invalid/empty body → 400
5. nonexistent product slug → 404
6. inactive (DRAFT) product → 404
7. duplicate review by the same user → 409
8. customer hitting admin moderation routes → 403
9. admin can list the moderation queue, filter by status
10. admin can approve → `Product.ratingAvg`/`reviewCount` recomputed correctly
11. admin can reject → product aggregates unchanged
12. rejected review never appears in `GET /api/catalog/products/:slug`
13. pending review never appears in `GET /api/catalog/products/:slug`
14. approved review appears in `GET /api/catalog/products/:slug` and counts toward `ratingAvg`/`reviewCount`
15. re-moderating an already-decided review → 409
16. user isolation: user B's create doesn't affect user A's ability to review the same product

### Client
`ReviewForm` (rating selection via click and keyboard, validation errors, submit loading state, success confirmation, 409 → "already reviewed" message, other errors → toast, unauthenticated → login prompt), `AdminReviewsPage` (loading/empty/error/populated, status filter, approve/reject updates the row, pagination).

### E2E (`e2e/reviews.spec.ts`)
Customer login → open a product → submit a review → sees "awaiting approval" confirmation → admin login → `/admin/reviews` → the pending review is visible → approve it → back on the product page (as a new/logged-out visitor) the approved review is now visible in the reviews list.

## Non-goals

- Verified-purchase gating (no schema support; would need a migration).
- Customer edit/delete of their own review.
- Un-approving/un-rejecting a decided review.
- A "my reviews" account page.
- Review helpfulness voting, images in reviews, or admin free-text moderation notes.
