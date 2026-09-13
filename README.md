# Audio Commerce

A demo storefront (npm workspaces monorepo: `shared/`, `server/`, `client/`) — Express + Prisma + PostgreSQL API,
Vite + React + TypeScript storefront. This is a demonstration project: no real payments are processed.

## Requirements

- Node.js 20 or later
- A local PostgreSQL server (any recent version)

## Setup

1. **Install dependencies** (also generates the Prisma client via `postinstall`):

   ```bash
   npm install
   ```

2. **Create two Postgres databases** — one for development, one for the test suite:

   ```bash
   createdb audio_commerce
   createdb audio_commerce_test
   ```

3. **Configure environment variables.** Copy the example files and adjust if your Postgres credentials differ
   from the defaults (`postgres`/`postgres` on `localhost:5432`):

   ```bash
   cp server/.env.example server/.env
   cp server/.env.test.example server/.env.test
   ```

   `server/.env` is the file actually read at runtime. Key variables:

   | Variable | Purpose |
   | --- | --- |
   | `DATABASE_URL` | Postgres connection string for the dev database |
   | `JWT_ACCESS_SECRET` | Signing secret for access tokens — use a long random string |
   | `PORT` | API server port (default `4000`) |
   | `CLIENT_ORIGIN` | Origin allowed by CORS (default `http://localhost:5173`, Vite's default port) |
   | `SEED_ADMIN_PASSWORD` / `SEED_CUSTOMER_PASSWORD` | Optional overrides for the seeded demo accounts' passwords (see below) |

   `server/.env.test` configures the separate test database and is only used when running the test suite.

4. **Apply database migrations:**

   ```bash
   npm run prisma:migrate -w server
   ```

   This runs `prisma migrate dev`, which is meant for authoring schema changes during development. If you
   already have a migration history and just want to bring an existing database up to date without being
   prompted about drift, use `npx prisma migrate deploy -w server` instead — `migrate dev` can offer to reset
   (drop and recreate) the database when it detects drift or a divergent history, which is the most likely
   cause if your local dev database has ever unexpectedly come up empty.

5. **Seed the catalog and demo accounts:**

   ```bash
   npm run prisma:seed -w server
   ```

   The seed is idempotent — safe to re-run any time you want to reset catalog data back to its seeded state.

6. **Run the app:**

   ```bash
   npm run dev
   ```

   This starts the API on `http://localhost:4000` and the Vite dev server on `http://localhost:5173`
   concurrently.

## Demo login credentials

The seed script creates two accounts for manual testing:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@audiocommerce.demo` | `ChangeMe!Dev123` (or your `SEED_ADMIN_PASSWORD`) |
| Customer | `customer@audiocommerce.demo` | `ChangeMe!Dev123` (or your `SEED_CUSTOMER_PASSWORD`) |

These are development-only credentials, clearly not suitable for any shared or production environment.

## Common scripts (run from the repo root)

| Command | Description |
| --- | --- |
| `npm run dev` | Start API + client together |
| `npm run build` | Build `shared`, `server`, then `client` |
| `npm run lint` | Lint the whole repo |
| `npm run typecheck` | Type-check all workspaces |
| `npm run test` | Run unit/integration tests for `shared`, `server`, `client` |
| `npm run test:e2e` | Run Playwright end-to-end tests (requires the dev servers' ports to be free; Playwright starts them itself per `playwright.config.ts`) |
| `npm run prisma:migrate -w server` | Apply/author Prisma migrations against the dev database |
| `npm run prisma:seed -w server` | Seed the catalog and demo accounts |

Running just the server tests requires the test database to have migrations applied first:

```bash
npm run prisma:migrate:test -w server
```

## Project layout

- `shared/` — Zod schemas and types shared between client and server
- `server/` — Express API, Prisma schema/migrations/seed
- `client/` — Vite + React storefront
- `e2e/` — Playwright end-to-end specs
- `docs/superpowers/` — internal design/planning notes from earlier development phases (not user-facing setup docs)
