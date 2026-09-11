# Phase 1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the npm-workspaces monorepo (client/server/shared), the full Prisma/PostgreSQL schema, JWT+refresh-token auth with rotation and reuse detection, RBAC middleware, the atomic inventory-decrement primitive, the Tailwind design-token foundation, and the React app shell (routing, contexts, primitives, login/register/account/admin placeholder pages) — with tests at every layer — so Phase 2 (storefront) has real, tested infrastructure to build on.

**Architecture:** React 18 + Vite + TS SPA (`/client`) talks to an Express + TS REST API (`/server`) backed by PostgreSQL via Prisma. `/shared` holds Zod schemas/types both sides import, with a build-time guard that it never pulls in Prisma, Express, or Node-only APIs. Auth is JWT access token (in-memory on client) + httpOnly refresh cookie, rotated on every use with reuse detection that revokes the whole token family.

**Tech Stack:** React 18, Vite, TypeScript, React Router v6, Tailwind CSS, Node.js, Express, Prisma, PostgreSQL, Zod, bcrypt, jsonwebtoken, Vitest, Testing Library, Supertest, express-rate-limit, helmet, cookie-parser.

**Spec:** `docs/superpowers/specs/2026-09-11-foundation-design.md`

## Global Constraints

- Frontend is React 18 + Vite + TypeScript + React Router v6 + Tailwind CSS. Never Next.js, never SSR/SSG for this phase or any phase, per spec.
- Backend is Node.js + Express + TypeScript. Database is PostgreSQL via Prisma ORM.
- Package manager is npm; repo is an npm-workspaces monorepo with `/client`, `/server`, `/shared`.
- `/shared` contains only Zod schemas, TS types/interfaces, and enums. It must never import `@prisma/client`, `express`, Node-only built-ins used for secrets/fs, or browser globals, and must never read `process.env`.
- RBAC is a two-value `Role` enum (`CUSTOMER`, `ADMIN`) stored on `User`. No permission tables.
- Access JWT: 15 minute expiry, held in memory on the client, never localStorage.
- Refresh token: cryptographically random, httpOnly + Secure(prod) + SameSite=Strict cookie, raw value never persisted server-side — only `sha256` hash. Every refresh rotates the token; reuse of an already-rotated token revokes the entire token family and forces re-authentication.
- Passwords hashed with bcrypt, cost factor 12.
- Server-side authorization (`requireAuth` + `requireRole`) is the only security boundary. Client-side route guards are UX only.
- No storefront browsing/cart/checkout/order/admin-CRUD business logic in this phase — placeholder pages only, proving the auth/routing/RBAC plumbing works end-to-end.
- Every table gets `createdAt`/`updatedAt` (per spec's per-entity list) and the indexes/unique constraints listed in the spec's Data Model section.
- Inventory stock decrement must use the conditional `updateMany` pattern from the spec (never read-then-write), inside a `$transaction`.

---

## File Structure

```
/package.json                       root workspaces config, shared dev scripts
/.gitignore
/.env.example
/eslint.config.js
/.prettierrc.json
/tsconfig.base.json

/shared/package.json
/shared/tsconfig.json
/shared/src/enums.ts                Role, ProductStatus, OrderStatus, ReviewStatus, CouponType, ContentBlockType
/shared/src/schemas/auth.ts         registerSchema, loginSchema, userDto
/shared/src/index.ts                barrel export
/shared/src/no-forbidden-imports.test.ts   guards the env-agnostic boundary

/server/package.json
/server/tsconfig.json
/server/.env.example
/server/prisma/schema.prisma
/server/prisma/migrations/...       generated + hand-edited check constraints
/server/prisma/seed.ts
/server/src/config/env.ts           zod-validated process.env
/server/src/lib/prisma.ts           PrismaClient singleton
/server/src/errors/AppError.ts      AppError hierarchy
/server/src/middleware/errorHandler.ts
/server/src/middleware/validate.ts  generic zod-body/query/params validator
/server/src/middleware/auth.ts      requireAuth, requireRole
/server/src/auth/password.ts        hashPassword, verifyPassword
/server/src/auth/jwt.ts             signAccessToken, verifyAccessToken
/server/src/auth/refreshToken.ts    generateRefreshToken, hashRefreshToken
/server/src/modules/auth/auth.service.ts
/server/src/modules/auth/auth.controller.ts
/server/src/modules/auth/auth.routes.ts
/server/src/modules/admin/admin.routes.ts   placeholder role-gated route
/server/src/modules/inventory/inventory.service.ts
/server/src/app.ts                  express app assembly (middleware, routes)
/server/src/server.ts               http listen entrypoint
/server/test/setup.ts               test DB reset helper
/server/test/auth.password.test.ts
/server/test/auth.jwt.test.ts
/server/test/errorHandler.test.ts
/server/test/auth.integration.test.ts
/server/test/rbac.integration.test.ts
/server/test/inventory.integration.test.ts

/client/package.json
/client/tsconfig.json
/client/vite.config.ts
/client/index.html
/client/tailwind.config.ts
/client/postcss.config.js
/client/src/main.tsx
/client/src/App.tsx
/client/src/styles/tokens.css
/client/src/styles/index.css
/client/src/lib/apiClient.ts
/client/src/context/AuthContext.tsx
/client/src/context/ToastContext.tsx
/client/src/components/Button.tsx
/client/src/components/Input.tsx
/client/src/components/Toast.tsx
/client/src/components/Skeleton.tsx
/client/src/components/EmptyState.tsx
/client/src/components/ErrorState.tsx
/client/src/components/LoadingState.tsx
/client/src/components/ErrorBoundary.tsx
/client/src/components/ProtectedRoute.tsx
/client/src/layouts/RootLayout.tsx
/client/src/layouts/StorefrontLayout.tsx
/client/src/layouts/AdminLayout.tsx
/client/src/pages/LoginPage.tsx
/client/src/pages/RegisterPage.tsx
/client/src/pages/AccountPage.tsx
/client/src/pages/AdminOverviewPage.tsx
/client/src/test/setup.ts
/client/src/components/Button.test.tsx
/client/src/components/Input.test.tsx
/client/src/components/Toast.test.tsx
/client/src/pages/LoginPage.test.tsx
/client/src/pages/RegisterPage.test.tsx
/client/src/components/ProtectedRoute.test.tsx
```

---

### Task 1: Monorepo scaffold, tooling, env config

**Files:**
- Create: `package.json`, `.gitignore`, `.env.example`, `eslint.config.js`, `.prettierrc.json`, `tsconfig.base.json`

**Interfaces:**
- Produces: root npm scripts (`dev`, `build`, `lint`, `test`, `format`) that all later tasks rely on; `tsconfig.base.json` extended by `client/tsconfig.json` and `server/tsconfig.json`.

- [ ] **Step 1: Create root `package.json`**

```json
{
  "name": "audio-commerce",
  "private": true,
  "workspaces": ["shared", "server", "client"],
  "scripts": {
    "dev": "concurrently -n server,client -c blue,green \"npm run dev -w server\" \"npm run dev -w client\"",
    "build": "npm run build -w shared && npm run build -w server && npm run build -w client",
    "lint": "eslint .",
    "format": "prettier --write .",
    "test": "npm run test -w shared && npm run test -w server && npm run test -w client",
    "typecheck": "npm run typecheck -w shared && npm run typecheck -w server && npm run typecheck -w client"
  },
  "devDependencies": {
    "concurrently": "^9.0.0",
    "eslint": "^9.9.0",
    "@typescript-eslint/eslint-plugin": "^8.5.0",
    "@typescript-eslint/parser": "^8.5.0",
    "prettier": "^3.3.3",
    "typescript": "^5.6.2"
  }
}
```

- [ ] **Step 2: Create `.gitignore`**

```
node_modules/
dist/
build/
.env
*.local
.DS_Store
coverage/
client/dist/
server/dist/
shared/dist/
```

- [ ] **Step 3: Create `.env.example`**

```
# server/.env is the real file consumed at runtime; this documents required vars.
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/audio_commerce
JWT_ACCESS_SECRET=replace-with-a-long-random-string
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
NODE_ENV=development
```

- [ ] **Step 4: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true
  }
}
```

- [ ] **Step 5: Create `eslint.config.js`**

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**'],
  },
);
```

- [ ] **Step 6: Create `.prettierrc.json`**

```json
{ "singleQuote": true, "semi": true, "trailingComma": "all", "printWidth": 100 }
```

- [ ] **Step 7: Install root deps and verify**

Run: `npm install`
Expected: installs without error, creates root `node_modules` and `package-lock.json`.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json .gitignore .env.example eslint.config.js .prettierrc.json tsconfig.base.json
git commit -m "chore: scaffold npm workspaces monorepo and tooling"
```

---

### Task 2: `/shared` package — enums, auth schemas, env-agnostic guard

**Files:**
- Create: `shared/package.json`, `shared/tsconfig.json`, `shared/src/enums.ts`, `shared/src/schemas/auth.ts`, `shared/src/index.ts`, `shared/src/no-forbidden-imports.test.ts`

**Interfaces:**
- Produces: `Role`, `ProductStatus`, `OrderStatus`, `ReviewStatus`, `CouponType`, `ContentBlockType` enums; `registerSchema: ZodSchema<{email, password, name}>`, `loginSchema: ZodSchema<{email, password}>`, `UserDto` type `{id: string, email: string, name: string, role: Role}` — consumed by `server/src/modules/auth/*` and `client/src/context/AuthContext.tsx` in later tasks.

- [ ] **Step 1: `shared/package.json`**

```json
{
  "name": "@audio-commerce/shared",
  "version": "0.0.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "typescript": "^5.6.2",
    "vitest": "^2.1.1"
  }
}
```

- [ ] **Step 2: `shared/tsconfig.json`**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```

- [ ] **Step 3: `shared/src/enums.ts`**

```ts
export enum Role {
  CUSTOMER = 'CUSTOMER',
  ADMIN = 'ADMIN',
}

export enum ProductStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export enum ReviewStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum CouponType {
  PERCENT = 'PERCENT',
  FIXED = 'FIXED',
}

export enum ContentBlockType {
  BANNER = 'BANNER',
  FEATURED_COLLECTION = 'FEATURED_COLLECTION',
  ANNOUNCEMENT = 'ANNOUNCEMENT',
}
```

- [ ] **Step 4: `shared/src/schemas/auth.ts`**

```ts
import { z } from 'zod';
import { Role } from '../enums.js';

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(72),
  name: z.string().trim().min(1).max(100),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const userDtoSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: z.nativeEnum(Role),
});
export type UserDto = z.infer<typeof userDtoSchema>;

export const authResponseSchema = z.object({
  user: userDtoSchema,
  accessToken: z.string(),
});
export type AuthResponse = z.infer<typeof authResponseSchema>;
```

- [ ] **Step 5: `shared/src/index.ts`**

```ts
export * from './enums.js';
export * from './schemas/auth.js';
```

- [ ] **Step 6: Write the failing guard test — `shared/src/no-forbidden-imports.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const FORBIDDEN = ['@prisma/client', 'express', "from 'fs'", "from 'node:fs'", 'process.env'];

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [full] : [];
  });
}

describe('shared package stays environment-agnostic', () => {
  it('never imports Prisma, Express, Node fs, or process.env', () => {
    const files = walk(join(import.meta.dirname, '.'));
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      for (const banned of FORBIDDEN) {
        expect(content.includes(banned), `${file} contains forbidden "${banned}"`).toBe(false);
      }
    }
  });
});
```

- [ ] **Step 7: Install shared deps and run the test**

Run: `npm install` (root, picks up new workspace) then `npm run test -w shared`
Expected: PASS — no forbidden imports exist yet, confirming the guard itself works on a clean tree.

- [ ] **Step 8: Typecheck and build**

Run: `npm run typecheck -w shared && npm run build -w shared`
Expected: no errors; `shared/dist/index.js` and `.d.ts` files produced.

- [ ] **Step 9: Commit**

```bash
git add shared/
git commit -m "feat(shared): add enums, auth zod schemas, and env-agnostic import guard"
```

---

### Task 3: Prisma schema, migration, check constraints, seed

**Files:**
- Create: `server/package.json`, `server/tsconfig.json`, `server/.env.example`, `server/prisma/schema.prisma`, `server/prisma/seed.ts`
- Generated: `server/prisma/migrations/<timestamp>_init/migration.sql` (hand-edited in this task)

**Interfaces:**
- Produces: the full Prisma Client model set (`prisma.user`, `prisma.refreshToken`, `prisma.productVariant`, etc.) that every later server task imports from `server/src/lib/prisma.ts` (Task 4).

- [ ] **Step 1: `server/package.json`**

```json
{
  "name": "@audio-commerce/server",
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "prisma:migrate": "prisma migrate dev",
    "prisma:generate": "prisma generate",
    "prisma:seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "@audio-commerce/shared": "*",
    "@prisma/client": "^5.19.1",
    "express": "^4.21.0",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "cookie-parser": "^1.4.6",
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2",
    "express-rate-limit": "^7.4.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "prisma": "^5.19.1",
    "typescript": "^5.6.2",
    "tsx": "^4.19.1",
    "vitest": "^2.1.1",
    "supertest": "^7.0.0",
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "@types/cookie-parser": "^1.4.7",
    "@types/bcrypt": "^5.0.2",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/supertest": "^6.0.2",
    "@types/node": "^22.5.5"
  }
}
```

- [ ] **Step 2: `server/tsconfig.json`**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src", "module": "NodeNext", "moduleResolution": "NodeNext" },
  "include": ["src"]
}
```

- [ ] **Step 3: `server/.env.example`** (copy of root `.env.example`; this is the file actually read by `server/.env` in dev)

- [ ] **Step 4: `server/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  CUSTOMER
  ADMIN
}

enum ProductStatus {
  DRAFT
  ACTIVE
  ARCHIVED
}

enum OrderStatus {
  PENDING
  CONFIRMED
  PROCESSING
  SHIPPED
  DELIVERED
  CANCELLED
  REFUNDED
}

enum ReviewStatus {
  PENDING
  APPROVED
  REJECTED
}

enum CouponType {
  PERCENT
  FIXED
}

enum ContentBlockType {
  BANNER
  FEATURED_COLLECTION
  ANNOUNCEMENT
}

model User {
  id           String         @id @default(uuid())
  email        String         @unique
  passwordHash String
  name         String
  role         Role           @default(CUSTOMER)
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
  refreshTokens RefreshToken[]
  addresses    Address[]
  cart         Cart?
  wishlist     Wishlist?
  orders       Order[]
  reviews      Review[]
  auditLogs    AuditLog[]
}

model RefreshToken {
  id                  String    @id @default(uuid())
  userId              String
  user                User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash           String    @unique
  familyId            String
  expiresAt           DateTime
  revokedAt           DateTime?
  replacedByTokenHash String?
  createdAt           DateTime  @default(now())

  @@index([userId])
  @@index([familyId])
}

model Address {
  id         String   @id @default(uuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  label      String
  line1      String
  line2      String?
  city       String
  state      String
  postalCode String
  country    String
  phone      String
  isDefault  Boolean  @default(false)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([userId])
}

model Category {
  id        String     @id @default(uuid())
  slug      String     @unique
  name      String
  parentId  String?
  parent    Category?  @relation("CategoryTree", fields: [parentId], references: [id])
  children  Category[] @relation("CategoryTree")
  products  Product[]
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt

  @@index([parentId])
}

model Brand {
  id        String    @id @default(uuid())
  slug      String    @unique
  name      String
  logoUrl   String?
  products  Product[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

model Product {
  id             String           @id @default(uuid())
  slug           String           @unique
  name           String
  description    String
  categoryId     String
  category       Category         @relation(fields: [categoryId], references: [id])
  brandId        String?
  brand          Brand?           @relation(fields: [brandId], references: [id])
  basePrice      Decimal          @db.Decimal(10, 2)
  status         ProductStatus    @default(DRAFT)
  featured       Boolean          @default(false)
  seoTitle       String?
  seoDescription String?
  variants       ProductVariant[]
  images         ProductImage[]
  wishlistItems  WishlistItem[]
  orderItems     OrderItem[]
  reviews        Review[]
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt

  @@index([categoryId])
  @@index([brandId])
  @@index([status])
  @@index([status, featured])
}

model ProductVariant {
  id                String     @id @default(uuid())
  productId         String
  product           Product    @relation(fields: [productId], references: [id], onDelete: Cascade)
  sku               String     @unique
  attributes        Json
  priceOverride     Decimal?   @db.Decimal(10, 2)
  stockQty          Int        @default(0)
  lowStockThreshold Int        @default(5)
  reservedQty       Int        @default(0)
  cartItems         CartItem[]
  createdAt         DateTime   @default(now())
  updatedAt         DateTime   @updatedAt

  @@index([productId])
}

model ProductImage {
  id        String   @id @default(uuid())
  productId String
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  url       String
  altText   String
  position  Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([productId])
}

model Cart {
  id        String     @id @default(uuid())
  userId    String     @unique
  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  items     CartItem[]
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
}

model CartItem {
  id        String         @id @default(uuid())
  cartId    String
  cart      Cart           @relation(fields: [cartId], references: [id], onDelete: Cascade)
  variantId String
  variant   ProductVariant @relation(fields: [variantId], references: [id])
  qty       Int
  createdAt DateTime       @default(now())
  updatedAt DateTime       @updatedAt

  @@unique([cartId, variantId])
  @@index([cartId])
}

model Wishlist {
  id        String         @id @default(uuid())
  userId    String         @unique
  user      User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  items     WishlistItem[]
  createdAt DateTime       @default(now())
  updatedAt DateTime       @updatedAt
}

model WishlistItem {
  id         String   @id @default(uuid())
  wishlistId String
  wishlist   Wishlist @relation(fields: [wishlistId], references: [id], onDelete: Cascade)
  productId  String
  product    Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  createdAt  DateTime @default(now())

  @@unique([wishlistId, productId])
  @@index([wishlistId])
}

model Order {
  id              String      @id @default(uuid())
  userId          String
  user            User        @relation(fields: [userId], references: [id])
  status          OrderStatus @default(PENDING)
  currency        String      @default("INR")
  subtotal        Decimal     @db.Decimal(10, 2)
  discountTotal   Decimal     @db.Decimal(10, 2) @default(0)
  shippingTotal   Decimal     @db.Decimal(10, 2) @default(0)
  taxTotal        Decimal     @db.Decimal(10, 2) @default(0)
  grandTotal      Decimal     @db.Decimal(10, 2)
  couponCode      String?
  shippingAddress Json
  billingAddress  Json?
  items           OrderItem[]
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  @@index([userId])
  @@index([status])
  @@index([createdAt])
}

model OrderItem {
  id                String   @id @default(uuid())
  orderId           String
  order             Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId         String?
  product           Product? @relation(fields: [productId], references: [id], onDelete: SetNull)
  productName       String
  variantSku        String
  variantAttributes Json
  unitPrice         Decimal  @db.Decimal(10, 2)
  qty               Int
  lineTotal         Decimal  @db.Decimal(10, 2)
  createdAt         DateTime @default(now())

  @@index([orderId])
}

model Review {
  id        String       @id @default(uuid())
  productId String
  product   Product      @relation(fields: [productId], references: [id], onDelete: Cascade)
  userId    String
  user      User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  rating    Int
  body      String
  status    ReviewStatus @default(PENDING)
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  @@unique([productId, userId])
  @@index([productId])
  @@index([status])
}

model Coupon {
  id         String     @id @default(uuid())
  code       String     @unique
  type       CouponType
  value      Decimal    @db.Decimal(10, 2)
  expiresAt  DateTime
  usageLimit Int?
  timesUsed  Int        @default(0)
  active     Boolean    @default(true)
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt
}

model StoreSettings {
  id           String   @id @default("singleton")
  storeName    String
  logoUrl      String?
  faviconUrl   String?
  contactEmail String
  contactPhone String?
  socialLinks  Json     @default("{}")
  heroContent  Json     @default("{}")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model ContentBlock {
  id        String           @id @default(uuid())
  type      ContentBlockType
  position  Int
  payload   Json
  active    Boolean          @default(true)
  createdAt DateTime         @default(now())
  updatedAt DateTime         @updatedAt

  @@index([active, position])
}

model AuditLog {
  id         String   @id @default(uuid())
  actorId    String?
  actor      User?    @relation(fields: [actorId], references: [id], onDelete: SetNull)
  action     String
  entityType String
  entityId   String
  diff       Json
  createdAt  DateTime @default(now())

  @@index([createdAt])
  @@index([actorId])
}
```

- [ ] **Step 5: Copy `.env.example` to `.env` and point at a real local Postgres**

Run: `cp .env.example .env` (in `server/`), edit `DATABASE_URL` to a reachable local database (e.g. `audio_commerce`, created with `createdb audio_commerce` or via your Postgres client).
Expected: `server/.env` exists with a valid connection string. (`.env` is gitignored.)

- [ ] **Step 6: Create the migration without applying it, so check constraints can be added**

Run: `cd server && npx prisma migrate dev --name init --create-only`
Expected: `server/prisma/migrations/<timestamp>_init/migration.sql` is generated, not yet applied.

- [ ] **Step 7: Append check constraints to the generated `migration.sql`**

Prisma's schema language has no native `CHECK` constraint support, so these are added as raw SQL at the end of the generated file:

```sql
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_stockQty_check" CHECK ("stockQty" >= 0);
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_reservedQty_check" CHECK ("reservedQty" >= 0 AND "reservedQty" <= "stockQty");
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_qty_check" CHECK ("qty" > 0);
ALTER TABLE "Review" ADD CONSTRAINT "Review_rating_check" CHECK ("rating" >= 1 AND "rating" <= 5);
ALTER TABLE "StoreSettings" ADD CONSTRAINT "StoreSettings_singleton_check" CHECK ("id" = 'singleton');
```

- [ ] **Step 8: Apply the migration**

Run: `npx prisma migrate dev`
Expected: migration applies cleanly, `npx prisma validate` reports the schema is valid.

- [ ] **Step 9: Generate Prisma Client**

Run: `npx prisma generate`
Expected: `@prisma/client` types regenerated, importable as `import { PrismaClient } from '@prisma/client'`.

- [ ] **Step 10: Verify constraints actually reject bad data**

Run a one-off check (not a permanent test file — this is a manual sanity check before writing the real seed):
`npx prisma db execute --stdin <<< "INSERT INTO \"ProductVariant\" (id, \"productId\", sku, attributes, \"stockQty\") VALUES ('x','x','x','{}', -1);"`
Expected: fails with a check-constraint violation (this will also fail on the missing FK first if run against an empty DB — the point is confirming the constraint clause parsed and attached; a full behavioral test happens in Task 6's inventory test).

- [ ] **Step 11: `server/prisma/seed.ts`** — creates one demo admin and one demo customer (both clearly labeled, no business data yet — catalog seeding is Phase 2's job)

```ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('DemoPass123!', 12);

  await prisma.user.upsert({
    where: { email: 'admin@audiocommerce.demo' },
    update: {},
    create: {
      email: 'admin@audiocommerce.demo',
      passwordHash,
      name: 'Demo Admin',
      role: 'ADMIN',
    },
  });

  await prisma.user.upsert({
    where: { email: 'customer@audiocommerce.demo' },
    update: {},
    create: {
      email: 'customer@audiocommerce.demo',
      passwordHash,
      name: 'Demo Customer',
      role: 'CUSTOMER',
    },
  });

  await prisma.storeSettings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      storeName: 'Aurelia Audio',
      contactEmail: 'hello@aureliaaudio.demo',
    },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
```

- [ ] **Step 12: Run the seed**

Run: `npm run prisma:seed -w server`
Expected: completes without error; `SELECT * FROM "User";` shows the two demo rows; `SELECT * FROM "StoreSettings";` shows exactly one row.

- [ ] **Step 13: Commit**

```bash
git add server/package.json server/tsconfig.json server/prisma
git commit -m "feat(server): add Prisma schema, check-constraint migration, and demo seed"
```

---

### Task 4: Env config, Prisma singleton, AppError hierarchy, error middleware

**Files:**
- Create: `server/src/config/env.ts`, `server/src/lib/prisma.ts`, `server/src/errors/AppError.ts`, `server/src/middleware/errorHandler.ts`
- Test: `server/test/errorHandler.test.ts`

**Interfaces:**
- Produces: `env: {DATABASE_URL, JWT_ACCESS_SECRET, PORT, CLIENT_ORIGIN, NODE_ENV}`; `prisma: PrismaClient`; `AppError`, `ValidationError`, `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError` classes each with `.statusCode: number` and `.code: string`; `errorHandler: ErrorRequestHandler` — consumed by every controller/middleware in later tasks.

- [ ] **Step 1: `server/src/config/env.ts`**

```ts
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  PORT: z.coerce.number().default(4000),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export const env = envSchema.parse(process.env);
```

- [ ] **Step 2: `server/src/lib/prisma.ts`**

```ts
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
```

- [ ] **Step 3: `server/src/errors/AppError.ts`**

```ts
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Invalid input') {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have access to this resource') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Request conflicts with current state') {
    super(message, 409, 'CONFLICT');
  }
}
```

- [ ] **Step 4: Write the failing test — `server/test/errorHandler.test.ts`**

```ts
import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { NotFoundError, ValidationError } from '../src/errors/AppError.js';

function mockRes() {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('errorHandler', () => {
  it('maps a known AppError to its status and code', () => {
    const res = mockRes();
    errorHandler(new NotFoundError('missing'), {} as Request, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: { code: 'NOT_FOUND', message: 'missing' } });
  });

  it('maps ValidationError to 400', () => {
    const res = mockRes();
    errorHandler(new ValidationError('bad body'), {} as Request, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: { code: 'VALIDATION_ERROR', message: 'bad body' } });
  });

  it('maps an unknown error to a generic 500 with no stack leakage', () => {
    const res = mockRes();
    errorHandler(new Error('db exploded'), {} as Request, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npm run test -w server`
Expected: FAIL — `errorHandler.js` does not exist yet.

- [ ] **Step 6: `server/src/middleware/errorHandler.ts`**

```ts
import type { ErrorRequestHandler } from 'express';
import { AppError } from '../errors/AppError.js';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
};
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm run test -w server`
Expected: PASS (3 tests).

- [ ] **Step 8: Commit**

```bash
git add server/src/config server/src/lib server/src/errors server/src/middleware/errorHandler.ts server/test/errorHandler.test.ts
git commit -m "feat(server): add env validation, Prisma singleton, AppError hierarchy, error middleware"
```

---

### Task 5: Password hashing, JWT access tokens, refresh token generation

**Files:**
- Create: `server/src/auth/password.ts`, `server/src/auth/jwt.ts`, `server/src/auth/refreshToken.ts`
- Test: `server/test/auth.password.test.ts`, `server/test/auth.jwt.test.ts`

**Interfaces:**
- Produces: `hashPassword(plain: string): Promise<string>`, `verifyPassword(plain: string, hash: string): Promise<boolean>`; `signAccessToken(payload: {sub: string, role: Role}): string`, `verifyAccessToken(token: string): {sub: string, role: Role}` (throws on invalid/expired); `generateRefreshToken(): string` (raw, URL-safe), `hashRefreshToken(raw: string): string` — consumed by `auth.service.ts` (Task 6) and `middleware/auth.ts` (Task 7).

- [ ] **Step 1: Write failing tests — `server/test/auth.password.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/auth/password.js';

describe('password hashing', () => {
  it('hashes a password and verifies it correctly', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).not.toEqual('correct horse battery staple');
    await expect(verifyPassword('correct horse battery staple', hash)).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    await expect(verifyPassword('wrong password', hash)).resolves.toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -w server`
Expected: FAIL — module not found.

- [ ] **Step 3: `server/src/auth/password.ts`**

```ts
import bcrypt from 'bcrypt';

const COST_FACTOR = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST_FACTOR);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -w server`
Expected: PASS.

- [ ] **Step 5: Write failing tests — `server/test/auth.jwt.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { signAccessToken, verifyAccessToken } from '../src/auth/jwt.js';
import { generateRefreshToken, hashRefreshToken } from '../src/auth/refreshToken.js';

describe('access token', () => {
  it('round-trips subject and role', () => {
    const token = signAccessToken({ sub: 'user-1', role: 'ADMIN' });
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe('user-1');
    expect(payload.role).toBe('ADMIN');
  });

  it('throws on a tampered token', () => {
    const token = signAccessToken({ sub: 'user-1', role: 'CUSTOMER' });
    expect(() => verifyAccessToken(token + 'x')).toThrow();
  });
});

describe('refresh token', () => {
  it('generates a unique raw token and a deterministic hash', () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a).not.toEqual(b);
    expect(hashRefreshToken(a)).toEqual(hashRefreshToken(a));
    expect(hashRefreshToken(a)).not.toEqual(hashRefreshToken(b));
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `npm run test -w server`
Expected: FAIL — modules not found.

- [ ] **Step 7: `server/src/auth/jwt.ts`**

```ts
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { Role } from '@audio-commerce/shared';

export interface AccessTokenPayload {
  sub: string;
  role: Role;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}
```

- [ ] **Step 8: `server/src/auth/refreshToken.ts`**

```ts
import { randomBytes, createHash } from 'node:crypto';

export function generateRefreshToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashRefreshToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
```

- [ ] **Step 9: Run to verify it passes**

Run: `npm run test -w server`
Expected: PASS (all auth unit tests).

- [ ] **Step 10: Commit**

```bash
git add server/src/auth server/test/auth.password.test.ts server/test/auth.jwt.test.ts
git commit -m "feat(server): add password hashing, JWT access tokens, refresh token primitives"
```

---

### Task 6: Inventory atomic decrement primitive + concurrent stock test

**Files:**
- Create: `server/src/modules/inventory/inventory.service.ts`, `server/test/setup.ts`
- Test: `server/test/inventory.integration.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 4), `ConflictError` (Task 4).
- Produces: `decrementStock(variantId: string, qty: number, tx: Prisma.TransactionClient): Promise<void>` (throws `ConflictError` on insufficient stock) — consumed by checkout logic in Phase 4, exercised directly here since checkout UI doesn't exist yet.

This task requires a real Postgres test database (same instance as dev is fine for Phase 1; `server/test/setup.ts` truncates relevant tables between tests rather than requiring a second database).

- [ ] **Step 1: `server/test/setup.ts`** — shared helper other integration tests (Task 8) also import

```ts
import { prisma } from '../src/lib/prisma.js';

export async function resetDb() {
  await prisma.$transaction([
    prisma.refreshToken.deleteMany(),
    prisma.cartItem.deleteMany(),
    prisma.productVariant.deleteMany(),
    prisma.product.deleteMany(),
    prisma.category.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

export async function createTestCategory() {
  return prisma.category.create({ data: { slug: `cat-${Date.now()}-${Math.random()}`, name: 'Test Category' } });
}

export async function createTestVariant(stockQty: number) {
  const category = await createTestCategory();
  const product = await prisma.product.create({
    data: {
      slug: `prod-${Date.now()}-${Math.random()}`,
      name: 'Test Headphones',
      description: 'test',
      categoryId: category.id,
      basePrice: '99.00',
      status: 'ACTIVE',
    },
  });
  return prisma.productVariant.create({
    data: {
      productId: product.id,
      sku: `sku-${Date.now()}-${Math.random()}`,
      attributes: { color: 'black' },
      stockQty,
    },
  });
}
```

- [ ] **Step 2: Write the failing tests — `server/test/inventory.integration.test.ts`**

```ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { decrementStock } from '../src/modules/inventory/inventory.service.js';
import { ConflictError } from '../src/errors/AppError.js';
import { resetDb, createTestVariant } from './setup.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('decrementStock', () => {
  it('decrements stock when enough is available', async () => {
    const variant = await createTestVariant(10);
    await prisma.$transaction((tx) => decrementStock(variant.id, 3, tx));
    const updated = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(updated.stockQty).toBe(7);
  });

  it('throws ConflictError and does not go negative when stock is insufficient', async () => {
    const variant = await createTestVariant(2);
    await expect(prisma.$transaction((tx) => decrementStock(variant.id, 5, tx))).rejects.toThrow(ConflictError);
    const updated = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(updated.stockQty).toBe(2);
  });

  it('allows exactly one of two concurrent requests for the last unit to succeed', async () => {
    const variant = await createTestVariant(1);

    const attempt = () => prisma.$transaction((tx) => decrementStock(variant.id, 1, tx));
    const results = await Promise.allSettled([attempt(), attempt()]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);

    const updated = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(updated.stockQty).toBe(0);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm run test -w server`
Expected: FAIL — `inventory.service.js` not found.

- [ ] **Step 4: `server/src/modules/inventory/inventory.service.ts`**

```ts
import type { Prisma } from '@prisma/client';
import { ConflictError } from '../../errors/AppError.js';

export async function decrementStock(
  variantId: string,
  qty: number,
  tx: Prisma.TransactionClient,
): Promise<void> {
  const result = await tx.productVariant.updateMany({
    where: { id: variantId, stockQty: { gte: qty } },
    data: { stockQty: { decrement: qty } },
  });
  if (result.count === 0) {
    throw new ConflictError(`Insufficient stock for variant ${variantId}`);
  }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm run test -w server`
Expected: PASS (3 tests). The conditional `updateMany` means Postgres's row-level locking serializes the two concurrent transactions in the third test — the second one re-reads a `stockQty` of `0` and its `WHERE stockQty >= 1` clause matches zero rows.

- [ ] **Step 6: Commit**

```bash
git add server/src/modules/inventory server/test/setup.ts server/test/inventory.integration.test.ts
git commit -m "feat(server): add atomic inventory decrement with concurrent-request test"
```

---

### Task 7: Auth service — register, login, refresh rotation, reuse detection, logout

**Files:**
- Create: `server/src/modules/auth/auth.service.ts`

**Interfaces:**
- Consumes: `prisma`, `hashPassword`/`verifyPassword`, `signAccessToken`, `generateRefreshToken`/`hashRefreshToken`/`REFRESH_TOKEN_TTL_MS`, `ConflictError`/`UnauthorizedError` (all prior tasks).
- Produces: `register(input: RegisterInput): Promise<{user, accessToken, refreshToken}>`, `login(input: LoginInput): Promise<{user, accessToken, refreshToken}>`, `refresh(rawToken: string): Promise<{accessToken, refreshToken}>`, `logout(rawToken: string): Promise<void>` — consumed by `auth.controller.ts` (Task 9). `refreshToken` here is always the new **raw** value the controller must set as the cookie.

No new tests in this task — `auth.service.ts` is exercised through the HTTP integration tests in Task 9, which test real client-visible behavior (status codes, cookies) rather than internals.

- [ ] **Step 1: `server/src/modules/auth/auth.service.ts`**

```ts
import { randomUUID } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { hashPassword, verifyPassword } from '../../auth/password.js';
import { signAccessToken } from '../../auth/jwt.js';
import { generateRefreshToken, hashRefreshToken, REFRESH_TOKEN_TTL_MS } from '../../auth/refreshToken.js';
import { ConflictError, UnauthorizedError } from '../../errors/AppError.js';
import type { RegisterInput, LoginInput, UserDto } from '@audio-commerce/shared';

function toUserDto(user: { id: string; email: string; name: string; role: 'CUSTOMER' | 'ADMIN' }): UserDto {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

async function issueTokenPair(userId: string, role: 'CUSTOMER' | 'ADMIN', familyId: string) {
  const accessToken = signAccessToken({ sub: userId, role });
  const rawRefreshToken = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashRefreshToken(rawRefreshToken),
      familyId,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });
  return { accessToken, refreshToken: rawRefreshToken };
}

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new ConflictError('An account with this email already exists');

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: { email: input.email, passwordHash, name: input.name },
  });
  const tokens = await issueTokenPair(user.id, user.role, randomUUID());
  return { user: toUserDto(user), ...tokens };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new UnauthorizedError('Invalid email or password');
  }
  const tokens = await issueTokenPair(user.id, user.role, randomUUID());
  return { user: toUserDto(user), ...tokens };
}

export async function refresh(rawToken: string) {
  const tokenHash = hashRefreshToken(rawToken);
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!existing) throw new UnauthorizedError('Invalid refresh token');
  if (existing.expiresAt < new Date()) throw new UnauthorizedError('Refresh token expired');

  if (existing.revokedAt) {
    // Reuse of an already-rotated token: assume compromise, kill the whole family.
    await prisma.refreshToken.updateMany({
      where: { familyId: existing.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new UnauthorizedError('Session invalid, please log in again');
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: existing.userId } });
  const newRawToken = generateRefreshToken();
  const newTokenHash = hashRefreshToken(newRawToken);

  // Conditional revoke: if two requests race on the same not-yet-revoked token,
  // only one succeeds here; the loser's `count === 0` means someone already
  // rotated this token, so it is treated the same as replay-of-a-revoked-token.
  const rotated = await prisma.refreshToken.updateMany({
    where: { id: existing.id, revokedAt: null },
    data: { revokedAt: new Date(), replacedByTokenHash: newTokenHash },
  });
  if (rotated.count === 0) {
    await prisma.refreshToken.updateMany({
      where: { familyId: existing.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new UnauthorizedError('Session invalid, please log in again');
  }

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: newTokenHash,
      familyId: existing.familyId,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });

  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  return { accessToken, refreshToken: newRawToken };
}

export async function logout(rawToken: string) {
  const tokenHash = hashRefreshToken(rawToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getUserById(id: string): Promise<UserDto> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id } });
  return toUserDto(user);
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck -w server`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add server/src/modules/auth/auth.service.ts
git commit -m "feat(server): add auth service with refresh rotation and reuse detection"
```

---

### Task 8: requireAuth / requireRole middleware + generic zod validator

**Files:**
- Create: `server/src/middleware/auth.ts`, `server/src/middleware/validate.ts`

**Interfaces:**
- Consumes: `verifyAccessToken` (Task 5), `UnauthorizedError`/`ForbiddenError`/`ValidationError` (Task 4).
- Produces: `requireAuth: RequestHandler` (sets `req.user = {id, role}`), `requireRole(role: Role): RequestHandler`, `validate(schema, location: 'body'|'query'|'params'): RequestHandler` — consumed by `auth.routes.ts` and `admin.routes.ts` (Task 9).

- [ ] **Step 1: `server/src/middleware/auth.ts`**

```ts
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { verifyAccessToken } from '../auth/jwt.js';
import { UnauthorizedError, ForbiddenError } from '../errors/AppError.js';
import type { Role } from '@audio-commerce/shared';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: Role };
    }
  }
}

export const requireAuth: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(new UnauthorizedError());
  try {
    const payload = verifyAccessToken(header.slice('Bearer '.length));
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(new UnauthorizedError());
  }
};

export function requireRole(role: Role): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new UnauthorizedError());
    if (req.user.role !== role) return next(new ForbiddenError());
    next();
  };
}
```

- [ ] **Step 2: `server/src/middleware/validate.ts`**

```ts
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodSchema } from 'zod';
import { ValidationError } from '../errors/AppError.js';

export function validate(schema: ZodSchema, location: 'body' | 'query' | 'params' = 'body'): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[location]);
    if (!result.success) {
      return next(new ValidationError(result.error.issues.map((i) => i.message).join(', ')));
    }
    req[location] = result.data;
    next();
  };
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck -w server`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add server/src/middleware/auth.ts server/src/middleware/validate.ts
git commit -m "feat(server): add requireAuth/requireRole middleware and generic zod validator"
```

---

### Task 9: Auth routes/controller, admin placeholder route, Express app assembly

**Files:**
- Create: `server/src/modules/auth/auth.controller.ts`, `server/src/modules/auth/auth.routes.ts`, `server/src/modules/admin/admin.routes.ts`, `server/src/app.ts`, `server/src/server.ts`
- Test: `server/test/auth.integration.test.ts`, `server/test/rbac.integration.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 4, 7, 8.
- Produces: `app: Express` (exported for Supertest, no `listen()` call inside it) — the HTTP surface every later phase's routes mount onto.

- [ ] **Step 1: `server/src/modules/auth/auth.controller.ts`**

```ts
import type { Request, Response } from 'express';
import * as authService from './auth.service.js';
import { UnauthorizedError } from '../../errors/AppError.js';

const REFRESH_COOKIE = 'refreshToken';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 30 * 24 * 60 * 60 * 1000,
  path: '/api/auth',
};

export async function registerHandler(req: Request, res: Response) {
  const { user, accessToken, refreshToken } = await authService.register(req.body);
  res.cookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTIONS);
  res.status(201).json({ user, accessToken });
}

export async function loginHandler(req: Request, res: Response) {
  const { user, accessToken, refreshToken } = await authService.login(req.body);
  res.cookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTIONS);
  res.status(200).json({ user, accessToken });
}

export async function refreshHandler(req: Request, res: Response) {
  const raw = req.cookies?.[REFRESH_COOKIE];
  if (!raw) throw new UnauthorizedError('No refresh token provided');
  try {
    const { accessToken, refreshToken } = await authService.refresh(raw);
    res.cookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTIONS);
    res.status(200).json({ accessToken });
  } catch (err) {
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    throw err;
  }
}

export async function logoutHandler(req: Request, res: Response) {
  const raw = req.cookies?.[REFRESH_COOKIE];
  if (raw) await authService.logout(raw);
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  res.status(204).send();
}

export async function meHandler(req: Request, res: Response) {
  const user = await authService.getUserById(req.user!.id);
  res.status(200).json({ user });
}
```

- [ ] **Step 2: `server/src/modules/auth/auth.routes.ts`**

```ts
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { registerSchema, loginSchema } from '@audio-commerce/shared';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import * as controller from './auth.controller.js';

const asyncHandler =
  (fn: (req: any, res: any) => Promise<void>) => (req: any, res: any, next: any) =>
    fn(req, res).catch(next);

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

export const authRouter = Router();

authRouter.post('/register', authLimiter, validate(registerSchema), asyncHandler(controller.registerHandler));
authRouter.post('/login', authLimiter, validate(loginSchema), asyncHandler(controller.loginHandler));
authRouter.post('/refresh', authLimiter, asyncHandler(controller.refreshHandler));
authRouter.post('/logout', asyncHandler(controller.logoutHandler));
authRouter.get('/me', requireAuth, asyncHandler(controller.meHandler));
```

- [ ] **Step 3: `server/src/modules/admin/admin.routes.ts`** (backs the Phase 1 admin placeholder page)

```ts
import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';

export const adminRouter = Router();

adminRouter.get('/overview', requireAuth, requireRole('ADMIN' as const), (_req, res) => {
  res.status(200).json({ message: 'Admin area placeholder' });
});
```

- [ ] **Step 4: `server/src/app.ts`**

```ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);

app.use(errorHandler);
```

- [ ] **Step 5: `server/src/server.ts`**

```ts
import { app } from './app.js';
import { env } from './config/env.js';

app.listen(env.PORT, () => {
  console.log(`Server listening on http://localhost:${env.PORT}`);
});
```

- [ ] **Step 6: Write the failing tests — `server/test/auth.integration.test.ts`**

```ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { resetDb } from './setup.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

function extractRefreshCookie(res: request.Response): string {
  const raw = res.headers['set-cookie']?.[0] as string;
  return raw.split(';')[0];
}

describe('auth flows', () => {
  it('registers a user and returns an access token plus a refresh cookie', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'new@example.com', password: 'password123', name: 'New User' });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('new@example.com');
    expect(res.body.accessToken).toBeTypeOf('string');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('rejects duplicate registration email with 409', async () => {
    await request(app).post('/api/auth/register').send({ email: 'dup@example.com', password: 'password123', name: 'A' });
    const res = await request(app).post('/api/auth/register').send({ email: 'dup@example.com', password: 'password123', name: 'B' });
    expect(res.status).toBe(409);
  });

  it('logs in with correct credentials and rejects wrong password with 401', async () => {
    await request(app).post('/api/auth/register').send({ email: 'login@example.com', password: 'password123', name: 'L' });
    const ok = await request(app).post('/api/auth/login').send({ email: 'login@example.com', password: 'password123' });
    expect(ok.status).toBe(200);
    const bad = await request(app).post('/api/auth/login').send({ email: 'login@example.com', password: 'wrong' });
    expect(bad.status).toBe(401);
  });

  it('refreshes an access token and rotates the refresh cookie', async () => {
    const registerRes = await request(app).post('/api/auth/register').send({ email: 'rot@example.com', password: 'password123', name: 'R' });
    const cookie = extractRefreshCookie(registerRes);

    const refreshRes = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).toBeTypeOf('string');
    const newCookie = extractRefreshCookie(refreshRes);
    expect(newCookie).not.toEqual(cookie);
  });

  it('detects replay of an already-rotated refresh token and revokes the family', async () => {
    const registerRes = await request(app).post('/api/auth/register').send({ email: 'replay@example.com', password: 'password123', name: 'P' });
    const originalCookie = extractRefreshCookie(registerRes);

    const firstRefresh = await request(app).post('/api/auth/refresh').set('Cookie', originalCookie);
    expect(firstRefresh.status).toBe(200);
    const rotatedCookie = extractRefreshCookie(firstRefresh);

    // Replay the original (now-revoked) token.
    const replay = await request(app).post('/api/auth/refresh').set('Cookie', originalCookie);
    expect(replay.status).toBe(401);

    // The legitimately-rotated token must now also be dead — whole family revoked.
    const secondUse = await request(app).post('/api/auth/refresh').set('Cookie', rotatedCookie);
    expect(secondUse.status).toBe(401);
  });

  it('rejects refresh with no cookie', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
  });

  it('returns the current user from /me when authenticated', async () => {
    const registerRes = await request(app).post('/api/auth/register').send({ email: 'me@example.com', password: 'password123', name: 'M' });
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${registerRes.body.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('me@example.com');
  });

  it('rejects /me with no token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 7: Write the failing tests — `server/test/rbac.integration.test.ts`**

```ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { resetDb } from './setup.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('admin route RBAC', () => {
  it('rejects unauthenticated access with 401', async () => {
    const res = await request(app).get('/api/admin/overview');
    expect(res.status).toBe(401);
  });

  it('rejects an authenticated CUSTOMER with 403', async () => {
    const registerRes = await request(app).post('/api/auth/register').send({ email: 'cust@example.com', password: 'password123', name: 'C' });
    const res = await request(app).get('/api/admin/overview').set('Authorization', `Bearer ${registerRes.body.accessToken}`);
    expect(res.status).toBe(403);
  });

  it('allows an ADMIN through', async () => {
    const registerRes = await request(app).post('/api/auth/register').send({ email: 'admin2@example.com', password: 'password123', name: 'A' });
    await prisma.user.update({ where: { email: 'admin2@example.com' }, data: { role: 'ADMIN' } });
    // The token minted at register time still carries the CUSTOMER role claim,
    // so re-authenticate to get a token that reflects the updated role.
    const loginRes = await request(app).post('/api/auth/login').send({ email: 'admin2@example.com', password: 'password123' });
    const res = await request(app).get('/api/admin/overview').set('Authorization', `Bearer ${loginRes.body.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Admin area placeholder');
  });

  it('rejects a malformed bearer token with 401', async () => {
    const res = await request(app).get('/api/admin/overview').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 8: Run to verify all new tests fail first, then pass**

Run: `npm run test -w server`
Expected: initial run FAILs (routes/app not wired), then after Steps 1-5 are in place, PASS for all files (unit + integration).

- [ ] **Step 9: Manual smoke test of the running server**

Run: `npm run dev -w server` in one terminal, then in another: `curl http://localhost:4000/health`
Expected: `{"status":"ok"}`.

- [ ] **Step 10: Commit**

```bash
git add server/src/modules/auth/auth.controller.ts server/src/modules/auth/auth.routes.ts server/src/modules/admin server/src/app.ts server/src/server.ts server/test/auth.integration.test.ts server/test/rbac.integration.test.ts
git commit -m "feat(server): wire auth/admin routes, assemble Express app, add integration tests"
```

---

### Task 10: Client scaffold (Vite + React + TS)

**Files:**
- Create: `client/package.json`, `client/tsconfig.json`, `client/vite.config.ts`, `client/index.html`, `client/src/main.tsx`, `client/src/App.tsx`

**Interfaces:**
- Produces: a building, running Vite dev server and a `dist/` production build — the shell every later client task mounts into.

- [ ] **Step 1: `client/package.json`**

```json
{
  "name": "@audio-commerce/client",
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "typecheck": "tsc -b --noEmit",
    "test": "vitest run",
    "preview": "vite preview"
  },
  "dependencies": {
    "@audio-commerce/shared": "*",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.2"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.4.6",
    "typescript": "^5.6.2",
    "tailwindcss": "^3.4.11",
    "postcss": "^8.4.47",
    "autoprefixer": "^10.4.20",
    "vitest": "^2.1.1",
    "@testing-library/react": "^16.0.1",
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/user-event": "^14.5.2",
    "jsdom": "^25.0.0",
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0"
  }
}
```

- [ ] **Step 2: `client/tsconfig.json`**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "noEmit": true,
    "types": ["vite/client"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: `client/vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
});
```

`sourcemap: false` satisfies the spec's "no production source maps" requirement (dev server sourcemaps remain enabled by default, unaffected by this build-only setting).

- [ ] **Step 4: `client/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Aurelia Audio</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: `client/src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.js';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
```

- [ ] **Step 6: `client/src/App.tsx`** (temporary — replaced with real routing in Task 15)

```tsx
export default function App() {
  return <div>Aurelia Audio — Phase 1 scaffold</div>;
}
```

- [ ] **Step 7: `client/src/styles/index.css`** (placeholder — replaced in Task 12)

```css
body {
  margin: 0;
  font-family: system-ui, sans-serif;
}
```

- [ ] **Step 8: Install, build, and smoke-test**

Run: `npm install` then `npm run build -w client`
Expected: `client/dist/` produced with no errors.

Run: `npm run dev -w client`
Expected: dev server starts on `http://localhost:5173`, page shows the scaffold text.

- [ ] **Step 9: Commit**

```bash
git add client/package.json client/tsconfig.json client/vite.config.ts client/index.html client/src/main.tsx client/src/App.tsx client/src/styles/index.css
git commit -m "chore(client): scaffold Vite + React + TypeScript app"
```

---

### Task 11: Design tokens + Tailwind integration

**Files:**
- Create: `client/tailwind.config.ts`, `client/postcss.config.js`, `client/src/styles/tokens.css`
- Modify: `client/src/styles/index.css`

**Interfaces:**
- Produces: CSS custom properties consumed by every component built from Task 13 onward; Tailwind utility classes resolving to those properties (e.g. `bg-surface`, `text-ink`, `rounded-md`, `duration-snap`).

- [ ] **Step 1: `client/postcss.config.js`**

```js
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

- [ ] **Step 2: `client/src/styles/tokens.css`** — per apple-design.md's typography (size-specific tracking/leading), motion (critically-damped default), and reduced-motion/transparency/contrast guidance

```css
:root {
  /* Color — light */
  --color-bg: #ffffff;
  --color-surface: #f5f5f7;
  --color-ink: #1d1d1f;
  --color-ink-muted: #6e6e73;
  --color-border: #d2d2d7;
  --color-accent: #0071e3;
  --color-danger: #d70015;
  --color-success: #1d7a3c;

  /* Spacing — 4px base scale */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;
  --space-16: 4rem;

  /* Typography */
  --font-sans:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  --tracking-display: -0.02em;
  --tracking-body: 0em;
  --leading-display: 1.05;
  --leading-body: 1.5;

  /* Radius / shadow */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.06);
  --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.08);

  /* Motion — critically damped default per apple-design.md */
  --duration-snap: 150ms;
  --duration-base: 300ms;
  --ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #000000;
    --color-surface: #1c1c1e;
    --color-ink: #f5f5f7;
    --color-ink-muted: #98989d;
    --color-border: #38383a;
  }
}

@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

@media (prefers-contrast: more) {
  :root {
    --color-border: #000000;
  }
}
```

- [ ] **Step 3: `client/tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        ink: 'var(--color-ink)',
        'ink-muted': 'var(--color-ink-muted)',
        border: 'var(--color-border)',
        accent: 'var(--color-accent)',
        danger: 'var(--color-danger)',
        success: 'var(--color-success)',
      },
      fontFamily: { sans: ['var(--font-sans)'] },
      borderRadius: { sm: 'var(--radius-sm)', md: 'var(--radius-md)', lg: 'var(--radius-lg)' },
      boxShadow: { sm: 'var(--shadow-sm)', md: 'var(--shadow-md)' },
      transitionDuration: { snap: '150ms', base: '300ms' },
      transitionTimingFunction: { standard: 'var(--ease-standard)' },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 4: Update `client/src/styles/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import './tokens.css';

body {
  background-color: var(--color-bg);
  color: var(--color-ink);
  font-family: var(--font-sans);
  line-height: var(--leading-body);
  letter-spacing: var(--tracking-body);
}
```

- [ ] **Step 5: Verify Tailwind resolves tokens**

Modify `client/src/App.tsx` temporarily to `<div className="bg-surface text-ink p-4 rounded-md">Aurelia Audio — Phase 1 scaffold</div>`, run `npm run dev -w client`, confirm in the browser the box has the `--color-surface` background and rounded corners. Revert this temporary change (Task 15 replaces `App.tsx` for real).

- [ ] **Step 6: Build check**

Run: `npm run build -w client`
Expected: succeeds, CSS output contains the compiled utility classes.

- [ ] **Step 7: Commit**

```bash
git add client/tailwind.config.ts client/postcss.config.js client/src/styles
git commit -m "feat(client): add design token foundation and Tailwind integration"
```

---

### Task 12: API client with in-memory access token and transparent refresh

**Files:**
- Create: `client/src/lib/apiClient.ts`
- Test: `client/src/test/setup.ts`, `client/src/lib/apiClient.test.ts`

**Interfaces:**
- Produces: `setAccessToken(token: string | null): void`, `apiFetch<T>(path: string, options?: RequestInit): Promise<T>` (throws `ApiError` with `{status, code, message}` on non-2xx; on a 401 from a non-auth endpoint, attempts one `/api/auth/refresh` and retries once) — consumed by `AuthContext` (Task 13) and every later data-fetching hook.

- [ ] **Step 1: `client/src/test/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 2: Write the failing tests — `client/src/lib/apiClient.test.ts`**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, setAccessToken, ApiError } from './apiClient.js';

describe('apiFetch', () => {
  beforeEach(() => {
    setAccessToken(null);
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it('attaches the in-memory access token as a Bearer header', async () => {
    setAccessToken('token-123');
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    await apiFetch('/api/auth/me');
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer token-123');
  });

  it('throws ApiError with the server-provided code and message on failure', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'missing' } }), { status: 404 }),
    );
    await expect(apiFetch('/api/whatever')).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
      message: 'missing',
    });
  });

  it('retries once after a successful silent refresh on a 401', async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'expired' } }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ accessToken: 'new-token' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ user: { id: '1' } }), { status: 200 }));

    const result = await apiFetch<{ user: { id: string } }>('/api/auth/me');
    expect(result.user.id).toBe('1');
    expect(fetchMock).toHaveBeenCalledTimes(3); // original, refresh, retry
  });

  it('does not attempt refresh when the failing call is the refresh endpoint itself', async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'no cookie' } }), { status: 401 }));
    await expect(apiFetch('/api/auth/refresh', { method: 'POST' })).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm run test -w client`
Expected: FAIL — `apiClient.ts` not found.

- [ ] **Step 4: `client/src/lib/apiClient.ts`**

```ts
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

async function rawFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { code: 'UNKNOWN', message: 'Request failed' } }));
    throw new ApiError(res.status, body.error?.code ?? 'UNKNOWN', body.error?.message ?? 'Request failed');
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  try {
    return await rawFetch<T>(path, options);
  } catch (err) {
    const isRefreshCall = path === '/api/auth/refresh';
    if (err instanceof ApiError && err.status === 401 && !isRefreshCall) {
      const { accessToken: newToken } = await rawFetch<{ accessToken: string }>('/api/auth/refresh', {
        method: 'POST',
      });
      setAccessToken(newToken);
      return rawFetch<T>(path, options);
    }
    throw err;
  }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm run test -w client`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add client/src/lib/apiClient.ts client/src/test/setup.ts client/src/lib/apiClient.test.ts client/vite.config.ts
git commit -m "feat(client): add API client with in-memory access token and transparent refresh"
```

---

### Task 13: AuthContext, ToastContext

**Files:**
- Create: `client/src/context/AuthContext.tsx`, `client/src/context/ToastContext.tsx`

**Interfaces:**
- Consumes: `apiFetch`, `setAccessToken` (Task 12); `UserDto`, `RegisterInput`, `LoginInput` (`@audio-commerce/shared`).
- Produces: `useAuth(): {user: UserDto | null, status: 'idle'|'loading'|'authenticated'|'unauthenticated', login(input), register(input), logout()}`; `useToast(): {show(message: string, variant?: 'success'|'error'): void}` — consumed by `ProtectedRoute`, `LoginPage`, `RegisterPage`, `Toast` component (Tasks 14-16).

- [ ] **Step 1: `client/src/context/AuthContext.tsx`**

```tsx
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { LoginInput, RegisterInput, UserDto } from '@audio-commerce/shared';
import { apiFetch, setAccessToken } from '../lib/apiClient.js';

type Status = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  user: UserDto | null;
  status: Status;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [status, setStatus] = useState<Status>('idle');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    apiFetch<{ accessToken: string }>('/api/auth/refresh', { method: 'POST' })
      .then(async ({ accessToken }) => {
        setAccessToken(accessToken);
        const { user } = await apiFetch<{ user: UserDto }>('/api/auth/me');
        if (!cancelled) {
          setUser(user);
          setStatus('authenticated');
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('unauthenticated');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const { user, accessToken } = await apiFetch<{ user: UserDto; accessToken: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    setAccessToken(accessToken);
    setUser(user);
    setStatus('authenticated');
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const { user, accessToken } = await apiFetch<{ user: UserDto; accessToken: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    setAccessToken(accessToken);
    setUser(user);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    setAccessToken(null);
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  return <AuthContext.Provider value={{ user, status, login, register, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

- [ ] **Step 2: `client/src/context/ToastContext.tsx`**

```tsx
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

interface ToastMessage {
  id: number;
  message: string;
  variant: 'success' | 'error';
}

interface ToastContextValue {
  toasts: ToastMessage[];
  show: (message: string, variant?: 'success' | 'error') => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, variant: 'success' | 'error' = 'success') => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, message, variant }]);
      setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );

  return <ToastContext.Provider value={{ toasts, show, dismiss }}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck -w client`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/context
git commit -m "feat(client): add AuthContext and ToastContext"
```

---

### Task 14: Core primitives — Button, Input, Toast, Skeleton, EmptyState, ErrorState, LoadingState

**Files:**
- Create: `client/src/components/Button.tsx`, `Input.tsx`, `Toast.tsx`, `Skeleton.tsx`, `EmptyState.tsx`, `ErrorState.tsx`, `LoadingState.tsx`
- Test: `client/src/components/Button.test.tsx`, `Input.test.tsx`, `Toast.test.tsx`

**Interfaces:**
- Produces: `<Button variant="primary"|"secondary" loading? disabled?>`, `<Input label id error?>` (forwards all native input props), `<Toast>` (renders from `useToast()`), `<Skeleton className?>`, `<EmptyState title description action?>`, `<ErrorState title description onRetry?>`, `<LoadingState label?>` — consumed by every page from Task 16 onward.

- [ ] **Step 1: Write failing test — `client/src/components/Button.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button.js';

describe('Button', () => {
  it('renders its label and calls onClick when pressed', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Add to cart</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('disables the button and shows a loading label while loading', () => {
    render(<Button loading>Add to cart</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('does not call onClick when disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Add to cart
      </Button>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -w client`
Expected: FAIL — `Button.tsx` not found.

- [ ] **Step 3: `client/src/components/Button.tsx`**

```tsx
import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  loading?: boolean;
}

const base =
  'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-transform duration-snap ease-standard active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none';
const variants = {
  primary: 'bg-accent text-white',
  secondary: 'bg-surface text-ink border border-border',
};

export function Button({ variant = 'primary', loading, disabled, className, children, ...props }: ButtonProps) {
  return (
    <button
      className={`${base} ${variants[variant]} ${className ?? ''}`}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading ? 'Please wait…' : children}
    </button>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -w client`
Expected: PASS.

- [ ] **Step 5: Write failing test — `client/src/components/Input.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Input } from './Input.js';

describe('Input', () => {
  it('associates the label with the input via htmlFor/id', () => {
    render(<Input id="email" label="Email" />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('shows an error message and marks the field invalid', () => {
    render(<Input id="email" label="Email" error="Email is required" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Email is required')).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run to verify it fails, then `client/src/components/Input.tsx`**

```tsx
import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function Input({ id, label, error, className, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`rounded-sm border border-border bg-bg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent ${className ?? ''}`}
        {...props}
      />
      {error && (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Run to verify it passes**

Run: `npm run test -w client`
Expected: PASS.

- [ ] **Step 8: Write failing test — `client/src/components/Toast.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ToastProvider, useToast } from '../context/ToastContext.js';
import { Toast } from './Toast.js';

function Trigger() {
  const { show } = useToast();
  return <button onClick={() => show('Saved successfully')}>trigger</button>;
}

describe('Toast', () => {
  it('renders a message pushed via useToast', async () => {
    render(
      <ToastProvider>
        <Trigger />
        <Toast />
      </ToastProvider>,
    );
    await act(async () => screen.getByText('trigger').click());
    expect(screen.getByText('Saved successfully')).toBeInTheDocument();
  });
});
```

- [ ] **Step 9: Run to verify it fails, then `client/src/components/Toast.tsx`**

```tsx
import { useToast } from '../context/ToastContext.js';

export function Toast() {
  const { toasts, dismiss } = useToast();
  return (
    <div aria-live="polite" className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          onClick={() => dismiss(t.id)}
          className={`rounded-md px-4 py-3 text-sm text-white shadow-md cursor-pointer ${
            t.variant === 'error' ? 'bg-danger' : 'bg-success'
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 10: Run to verify it passes**

Run: `npm run test -w client`
Expected: PASS.

- [ ] **Step 11: `client/src/components/Skeleton.tsx`, `EmptyState.tsx`, `ErrorState.tsx`, `LoadingState.tsx`** (no dedicated tests — trivial presentational components exercised indirectly by page tests in Task 16)

```tsx
// Skeleton.tsx
export function Skeleton({ className = 'h-4 w-full' }: { className?: string }) {
  return <div className={`animate-pulse rounded-sm bg-surface ${className}`} aria-hidden="true" />;
}
```

```tsx
// EmptyState.tsx
import type { ReactNode } from 'react';

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <p className="text-sm text-ink-muted max-w-sm">{description}</p>
      {action}
    </div>
  );
}
```

```tsx
// ErrorState.tsx
import { Button } from './Button.js';

export function ErrorState({ title, description, onRetry }: { title: string; description: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-16 text-center">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <p className="text-sm text-ink-muted max-w-sm">{description}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
```

```tsx
// LoadingState.tsx
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center py-16 text-sm text-ink-muted">
      {label}
    </div>
  );
}
```

- [ ] **Step 12: Commit**

```bash
git add client/src/components/Button.tsx client/src/components/Button.test.tsx client/src/components/Input.tsx client/src/components/Input.test.tsx client/src/components/Toast.tsx client/src/components/Toast.test.tsx client/src/components/Skeleton.tsx client/src/components/EmptyState.tsx client/src/components/ErrorState.tsx client/src/components/LoadingState.tsx
git commit -m "feat(client): add Button, Input, Toast, Skeleton, EmptyState, ErrorState, LoadingState primitives"
```

---

### Task 15: ErrorBoundary, ProtectedRoute, layouts, routing shell

**Files:**
- Create: `client/src/components/ErrorBoundary.tsx`, `client/src/components/ProtectedRoute.tsx`, `client/src/layouts/RootLayout.tsx`, `client/src/layouts/StorefrontLayout.tsx`, `client/src/layouts/AdminLayout.tsx`
- Modify: `client/src/App.tsx`
- Test: `client/src/components/ProtectedRoute.test.tsx`

**Interfaces:**
- Consumes: `useAuth` (Task 13), `LoadingState` (Task 14).
- Produces: `<ProtectedRoute role?: 'ADMIN'>` wrapping `<Outlet/>` — role check is UX-only (redirects), never the security boundary; consumed by `App.tsx` route tree.

- [ ] **Step 1: `client/src/components/ErrorBoundary.tsx`**

```tsx
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorState } from './ErrorState.js';

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorState
          title="Something went wrong"
          description="Please refresh the page. If the problem continues, contact support."
          onRetry={() => this.setState({ hasError: false })}
        />
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 2: Write the failing test — `client/src/components/ProtectedRoute.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ProtectedRoute } from './ProtectedRoute.js';
import * as AuthContext from '../context/AuthContext.js';

function renderWithAuth(authValue: Partial<ReturnType<typeof AuthContext.useAuth>>, initialPath = '/account') {
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue(authValue as ReturnType<typeof AuthContext.useAuth>);
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/account" element={<div>Account page</div>} />
        </Route>
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  it('shows a loading state while auth status is loading', () => {
    renderWithAuth({ status: 'loading', user: null });
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders the child route when authenticated', () => {
    renderWithAuth({ status: 'authenticated', user: { id: '1', email: 'a@b.com', name: 'A', role: 'CUSTOMER' } });
    expect(screen.getByText('Account page')).toBeInTheDocument();
  });

  it('redirects to /login when unauthenticated', () => {
    renderWithAuth({ status: 'unauthenticated', user: null });
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('redirects a CUSTOMER away from an ADMIN-only route', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      status: 'authenticated',
      user: { id: '1', email: 'a@b.com', name: 'A', role: 'CUSTOMER' },
    } as ReturnType<typeof AuthContext.useAuth>);
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route element={<ProtectedRoute role="ADMIN" />}>
            <Route path="/admin" element={<div>Admin page</div>} />
          </Route>
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm run test -w client`
Expected: FAIL — `ProtectedRoute.tsx` not found.

- [ ] **Step 4: `client/src/components/ProtectedRoute.tsx`**

```tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { LoadingState } from './LoadingState.js';
import type { Role } from '@audio-commerce/shared';

export function ProtectedRoute({ role }: { role?: Role }) {
  const { status, user } = useAuth();

  if (status === 'idle' || status === 'loading') return <LoadingState label="Checking your session…" />;
  if (status === 'unauthenticated' || !user) return <Navigate to="/login" replace />;
  // UX-only convenience redirect — the API independently enforces this via requireRole.
  if (role && user.role !== role) return <Navigate to="/login" replace />;

  return <Outlet />;
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm run test -w client`
Expected: PASS.

- [ ] **Step 6: `client/src/layouts/RootLayout.tsx`**

```tsx
import { Outlet } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext.js';
import { ToastProvider } from '../context/ToastContext.js';
import { Toast } from '../components/Toast.js';
import { ErrorBoundary } from '../components/ErrorBoundary.js';

export function RootLayout() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <Outlet />
          <Toast />
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
```

- [ ] **Step 7: `client/src/layouts/StorefrontLayout.tsx`**

```tsx
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';

export function StorefrontLayout() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <Link to="/" className="font-semibold text-ink">
          Aurelia Audio
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {user ? (
            <>
              <Link to="/account">Account</Link>
              <button onClick={() => logout()}>Log out</button>
            </>
          ) : (
            <>
              <Link to="/login">Log in</Link>
              <Link to="/register">Create account</Link>
            </>
          )}
        </nav>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 8: `client/src/layouts/AdminLayout.tsx`**

```tsx
import { Outlet } from 'react-router-dom';

export function AdminLayout() {
  return (
    <div className="min-h-screen flex">
      <aside className="w-56 border-r border-border p-4">
        <p className="font-semibold text-ink">Admin</p>
      </aside>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 9: Update `client/src/App.tsx`** with lazy route-level code splitting

```tsx
import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { RootLayout } from './layouts/RootLayout.js';
import { StorefrontLayout } from './layouts/StorefrontLayout.js';
import { AdminLayout } from './layouts/AdminLayout.js';
import { ProtectedRoute } from './components/ProtectedRoute.js';
import { LoadingState } from './components/LoadingState.js';

const LoginPage = lazy(() => import('./pages/LoginPage.js'));
const RegisterPage = lazy(() => import('./pages/RegisterPage.js'));
const AccountPage = lazy(() => import('./pages/AccountPage.js'));
const AdminOverviewPage = lazy(() => import('./pages/AdminOverviewPage.js'));

export default function App() {
  return (
    <Suspense fallback={<LoadingState />}>
      <Routes>
        <Route element={<RootLayout />}>
          <Route element={<StorefrontLayout />}>
            <Route index element={<div className="p-6">Home — Phase 2 builds this</div>} />
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="account" element={<AccountPage />} />
            </Route>
          </Route>
          <Route element={<ProtectedRoute role="ADMIN" />}>
            <Route element={<AdminLayout />}>
              <Route path="admin" element={<AdminOverviewPage />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
```

- [ ] **Step 10: Commit**

```bash
git add client/src/components/ErrorBoundary.tsx client/src/components/ProtectedRoute.tsx client/src/components/ProtectedRoute.test.tsx client/src/layouts client/src/App.tsx
git commit -m "feat(client): add ErrorBoundary, ProtectedRoute, layouts, and lazy routing shell"
```

---

### Task 16: Login, Register, Account, Admin placeholder pages

**Files:**
- Create: `client/src/pages/LoginPage.tsx`, `client/src/pages/RegisterPage.tsx`, `client/src/pages/AccountPage.tsx`, `client/src/pages/AdminOverviewPage.tsx`
- Test: `client/src/pages/LoginPage.test.tsx`, `client/src/pages/RegisterPage.test.tsx`

**Interfaces:**
- Consumes: `useAuth` (Task 13), `Button`/`Input` (Task 14), `loginSchema`/`registerSchema` (`@audio-commerce/shared`).
- Produces: default-exported page components matching the lazy imports in `App.tsx` (Task 15).

- [ ] **Step 1: Write the failing test — `client/src/pages/LoginPage.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import LoginPage from './LoginPage.js';
import * as AuthContext from '../context/AuthContext.js';

describe('LoginPage', () => {
  it('shows a validation error for an invalid email without calling the API', async () => {
    const login = vi.fn();
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ login, status: 'idle' } as ReturnType<typeof AuthContext.useAuth>);
    render(<LoginPage />, { wrapper: MemoryRouter });

    await userEvent.type(screen.getByLabelText('Email'), 'not-an-email');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('calls login with valid credentials and shows a server error on failure', async () => {
    const login = vi.fn().mockRejectedValue(new Error('Invalid email or password'));
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ login, status: 'idle' } as ReturnType<typeof AuthContext.useAuth>);
    render(<LoginPage />, { wrapper: MemoryRouter });

    await userEvent.type(screen.getByLabelText('Email'), 'me@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(login).toHaveBeenCalledWith({ email: 'me@example.com', password: 'password123' });
    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -w client`
Expected: FAIL — `LoginPage.tsx` not found.

- [ ] **Step 3: `client/src/pages/LoginPage.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginSchema } from '@audio-commerce/shared';
import { useAuth } from '../context/AuthContext.js';
import { Button } from '../components/Button.js';
import { Input } from '../components/Input.js';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldError(null);
    setServerError(null);

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      setFieldError(result.error.issues[0]?.message ?? 'Please enter a valid email and password.');
      return;
    }

    setSubmitting(true);
    try {
      await login(result.data);
      navigate('/account');
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Unable to log in right now.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-6 py-16">
      <h1 className="text-2xl font-semibold text-ink mb-6" style={{ letterSpacing: 'var(--tracking-display)' }}>
        Log in
      </h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Input id="email" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {fieldError && (
          <p role="alert" className="text-sm text-danger">
            {fieldError}
          </p>
        )}
        {serverError && (
          <p role="alert" className="text-sm text-danger">
            {serverError}
          </p>
        )}
        <Button type="submit" loading={submitting}>
          Log in
        </Button>
      </form>
      <p className="mt-4 text-sm text-ink-muted">
        No account? <Link to="/register">Create one</Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -w client`
Expected: PASS.

- [ ] **Step 5: Write the failing test — `client/src/pages/RegisterPage.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import RegisterPage from './RegisterPage.js';
import * as AuthContext from '../context/AuthContext.js';

describe('RegisterPage', () => {
  it('rejects a password shorter than 8 characters before calling the API', async () => {
    const register = vi.fn();
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ register, status: 'idle' } as ReturnType<typeof AuthContext.useAuth>);
    render(<RegisterPage />, { wrapper: MemoryRouter });

    await userEvent.type(screen.getByLabelText('Name'), 'Jane Doe');
    await userEvent.type(screen.getByLabelText('Email'), 'jane@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText(/at least 8/i)).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it('submits valid input to register', async () => {
    const register = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ register, status: 'idle' } as ReturnType<typeof AuthContext.useAuth>);
    render(<RegisterPage />, { wrapper: MemoryRouter });

    await userEvent.type(screen.getByLabelText('Name'), 'Jane Doe');
    await userEvent.type(screen.getByLabelText('Email'), 'jane@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(register).toHaveBeenCalledWith({ email: 'jane@example.com', password: 'password123', name: 'Jane Doe' });
  });
});
```

- [ ] **Step 6: Run to verify it fails, then `client/src/pages/RegisterPage.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerSchema } from '@audio-commerce/shared';
import { useAuth } from '../context/AuthContext.js';
import { Button } from '../components/Button.js';
import { Input } from '../components/Input.js';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldError(null);
    setServerError(null);

    const result = registerSchema.safeParse({ email, password, name });
    if (!result.success) {
      setFieldError(result.error.issues[0]?.message ?? 'Please check your details.');
      return;
    }

    setSubmitting(true);
    try {
      await register(result.data);
      navigate('/account');
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Unable to create your account right now.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-6 py-16">
      <h1 className="text-2xl font-semibold text-ink mb-6" style={{ letterSpacing: 'var(--tracking-display)' }}>
        Create account
      </h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Input id="name" label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input id="email" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {fieldError && (
          <p role="alert" className="text-sm text-danger">
            {fieldError}
          </p>
        )}
        {serverError && (
          <p role="alert" className="text-sm text-danger">
            {serverError}
          </p>
        )}
        <Button type="submit" loading={submitting}>
          Create account
        </Button>
      </form>
      <p className="mt-4 text-sm text-ink-muted">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}
```

Note: `registerSchema` in `@audio-commerce/shared` (Task 2) already enforces `min(8)` on password; Zod's default message is `"String must contain at least 8 character(s)"`, which satisfies the test's `/at least 8/i` match.

- [ ] **Step 7: Run to verify it passes**

Run: `npm run test -w client`
Expected: PASS.

- [ ] **Step 8: `client/src/pages/AccountPage.tsx`** (proves the authenticated flow end-to-end; Phase 5 replaces this with real account features)

```tsx
import { useAuth } from '../context/AuthContext.js';

export default function AccountPage() {
  const { user } = useAuth();
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold text-ink">Welcome, {user?.name}</h1>
      <p className="text-ink-muted mt-2">{user?.email}</p>
      <p className="text-sm text-ink-muted mt-8">
        Order history, addresses, and account settings arrive in later phases.
      </p>
    </div>
  );
}
```

- [ ] **Step 9: `client/src/pages/AdminOverviewPage.tsx`** (proves the role-gated flow end-to-end; Phase 6 replaces this with the real dashboard)

```tsx
export default function AdminOverviewPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink">Admin overview</h1>
      <p className="text-sm text-ink-muted mt-2">
        Sales, inventory, and order management dashboards arrive in Phase 6.
      </p>
    </div>
  );
}
```

- [ ] **Step 10: Full client test run**

Run: `npm run test -w client`
Expected: PASS across all client test files.

- [ ] **Step 11: Commit**

```bash
git add client/src/pages
git commit -m "feat(client): add Login, Register, Account, and Admin placeholder pages"
```

---

### Task 17: Phase 1 verification pass

**Files:** none created — this task runs and records evidence.

- [ ] **Step 1: Full workspace install from a clean state**

Run: `rm -rf node_modules client/node_modules server/node_modules shared/node_modules && npm install`
Expected: succeeds with no errors.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: 0 errors (warnings reviewed and fixed if they indicate real problems).

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: 0 errors across `shared`, `server`, `client`.

- [ ] **Step 4: Full test suite**

Run: `npm run test`
Expected: all suites PASS — `shared` (import guard), `server` (unit + integration, including the concurrent-stock and refresh-reuse tests), `client` (component + page tests).

- [ ] **Step 5: Production builds**

Run: `npm run build`
Expected: `shared/dist`, `server/dist`, `client/dist` all produced with no errors. Confirm `client/dist/assets/*.js` has no adjacent `.map` files (source maps disabled per Task 10).

- [ ] **Step 6: Manual end-to-end smoke test**

Run `npm run dev` (starts both server and client). In a browser:
1. Visit `http://localhost:5173/register`, create an account — expect redirect to `/account` showing the name/email.
2. Visit `http://localhost:5173/admin` while logged in as that CUSTOMER — expect redirect to `/login` (client-side UX gate).
3. Log out, log in as `admin@audiocommerce.demo` / `DemoPass123!` (seeded in Task 3) — expect access to `/admin` showing the placeholder.
4. With devtools open, confirm no access token appears in `localStorage`.
5. Directly `curl -i http://localhost:4000/api/admin/overview` with no auth header — expect `401`.

- [ ] **Step 7: git hygiene**

Run: `git status` (confirm no stray files, no `.env` staged), `git diff --check` (confirm no whitespace errors on any staged change).
Expected: clean.

- [ ] **Step 8: Record results and commit any final fixes**

If Steps 2-6 surfaced fixes, commit them individually with scoped messages. Then:

```bash
git add -A
git status
```

Confirm nothing sensitive (`.env`, `node_modules`) is staged before any further commit.

---

## Self-Review Notes

**Spec coverage:** every Data Model entity, the inventory transaction design, refresh rotation/reuse detection, order/address snapshot rules (schema only — populated in Phase 4+), the `/shared` environment-agnostic guard, RBAC, design tokens, and the app shell/placeholder pages from the spec each map to a task above (Tasks 3, 6, 7, 2, 9, 11, 15-16 respectively). Testing infrastructure (Vitest/Testing Library/Supertest) is established throughout rather than deferred.

**Type consistency:** `UserDto`/`RegisterInput`/`LoginInput` (Task 2) are the exact types threaded through `auth.service.ts` (Task 7), `AuthContext` (Task 13), and both auth pages (Task 16). `decrementStock(variantId, qty, tx)` (Task 6) matches its only call site inside `prisma.$transaction` callbacks in its own tests; Phase 4 checkout work will call it the same way. `ApiError` (Task 12) is the error type `LoginPage`/`RegisterPage` catch via `err instanceof Error` (safe, since `ApiError extends Error`).

**Scope:** confirmed no product/cart/order/admin-CRUD UI or business logic appears in any task — only the schema, the reusable inventory primitive (needed as infra, exercised without checkout UI), and placeholder pages proving the auth/RBAC plumbing.
