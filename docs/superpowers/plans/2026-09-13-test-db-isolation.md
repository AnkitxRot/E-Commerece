# Test Database Isolation Implementation Plan

Status: Complete (implemented and verified this session; see
[design spec](../specs/2026-09-13-test-db-isolation-design.md)).

## Verification performed before landing

1. `npm run lint` — PASS
2. `npm run typecheck` — PASS (shared build + shared/server/client typecheck)
3. `npm run test` — 32 shared + 127 server + 123 client = 282/282 PASS
   (server count includes 3 new `dbSafety.test.ts` regression tests)
4. `npm run build` — PASS
5. Reproduced the original bug directly: with `DATABASE_URL` exported in
   the shell to the dev DB's value and `NODE_ENV=test`, `env.ts` resolved
   to the dev URL before this fix and to `.env.test`'s test URL after it
   (verified with a throwaway script importing `env.ts` under both
   conditions).
6. `npx playwright test` — 12/12 PASS
7. Confirmed dev DB (`audio_commerce`) row counts before/after the full
   run — untouched aside from the expected inserts the E2E specs
   themselves make (register/create-product flows).

No CI workflows are configured in this repository; local validation was
used for all of the above.

## Tasks

- [x] `server/src/config/env.ts` — `override: true` on the `dotenv`
      `config()` call, closing the actual defect (dotenv never
      overrides an already-set env var).
- [x] `server/src/config/dbSafety.ts` — new pure
      `assertIsolatedTestDatabase(resolvedTestUrl, devDatabaseUrl)`
      helper; throws if the two URLs match.
- [x] `server/test/setup.ts` — `resetDb()` now reads the dev
      `DATABASE_URL` straight from `server/.env` (bypassing
      `process.env` entirely) and calls the helper before deleting any
      rows.
- [x] `server/test/dbSafety.test.ts` — regression coverage for the pure
      helper (throw-on-match, pass-on-mismatch, pass-when-no-dev-url).
- [x] `README.md` — documents the enforced invariant.

## Invariant now enforced

```
TEST SUITE  → test DB only   (dotenv override + runtime assertion)
DEV SERVER  → dev DB only    (unaffected — same file it already used)
PRODUCTION  → prod DB only   (unaffected — no .env file present)
```

## Follow-up (not this milestone)

None — this was a self-contained hardening fix. Next milestone per the
roadmap: Category/Brand admin CRUD (real Prisma models already exist,
unused — see the admin-management plan's follow-up note).
