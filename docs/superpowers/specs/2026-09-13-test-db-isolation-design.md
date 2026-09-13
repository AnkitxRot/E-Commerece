# Test Database Isolation — Design Spec

Date: 2026-09-13
Status: Implemented and verified this session.

## Objective

Eliminate a pre-existing footgun (tracked in local memory, reproduced
independently against unmodified `master`): running the server test
suite can silently wipe the local **development** Postgres database
instead of the isolated **test** database.

## Root cause

`server/src/config/env.ts` loads `.env` or `.env.test` (by
`NODE_ENV`) via `dotenv`'s `config()`, which — critically — **never
overrides a `DATABASE_URL` that is already set** in `process.env`.
If a developer's shell has `DATABASE_URL` exported from an earlier
session (e.g. they ran a one-off command against the dev DB and
forgot to unset it), that shell-level dev value silently wins over
`.env.test`'s test value even though `NODE_ENV=test` is set
correctly. `test/setup.ts`'s existing `resetDb()` guard only checks
`NODE_ENV`, not which physical database `DATABASE_URL` actually
points at, so it does not catch this case. This is a classic dotenv
gotcha, not a Vitest isolation bug — it reproduces with a plain `node`
script outside Vitest entirely once `DATABASE_URL` is exported in the
shell.

## Fix

Two layers, both required:

1. **Close the loophole at the source.** `env.ts` now calls
   `config({ path, override: true })`. Whichever `.env` file
   `NODE_ENV` selects is now the authoritative source for every key
   it defines, regardless of what's already in `process.env`. This
   makes `DATABASE_URL` (and everything else in the file) fully
   deterministic from `NODE_ENV` alone — no shell-level value can
   shadow it, in dev or test.

2. **Deterministic runtime backstop.** `resetDb()` now calls
   `assertIsolatedTestDatabase(resolvedTestUrl, devUrl)`
   (`server/src/config/dbSafety.ts`) before touching any table. It
   throws if the resolved test `DATABASE_URL` is identical to the
   dev `DATABASE_URL` read directly from `server/.env`. This is a
   second, independent gate: even if `override: true` were ever
   removed, misconfigured, or bypassed by some future change, a test
   run can never wipe a database that is provably the same URL as
   dev. The comparison function is a pure function of two strings
   (no fs/env access), so it is directly unit-testable without
   needing to reproduce shell-level env pollution.

Not chosen:

- Weakening or deleting any existing test — rejected by the
  hardening brief.
- Manually reseeding after every test run — treats the symptom, not
  the cause, and does nothing for the next developer who hits it.
- Forcing `DATABASE_URL` via `vitest.config.ts`'s `test.env` —
  would duplicate `.env.test` as a second source of truth for the
  same value and could drift from it. `override: true` fixes the
  actual defect (dotenv's non-override default) at its origin
  instead.
- Naming-convention sniffing (e.g. "URL must contain `_test`") —
  rejected in favor of an exact comparison against the real
  configured dev URL, which needs no convention and can't produce a
  false negative for an oddly-named test DB.

## Scope

In scope:

- `server/src/config/env.ts` — `override: true`.
- `server/src/config/dbSafety.ts` — new pure `assertIsolatedTestDatabase` helper.
- `server/test/setup.ts` — wire the helper into `resetDb()`, reading
  the dev URL from `server/.env` (best-effort; skips the check if
  the file doesn't exist, e.g. in CI where dev `.env` is never
  created).
- `server/test/dbSafety.test.ts` — new regression coverage for the
  pure helper (throws on match, passes on mismatch, passes when no
  dev URL is available).
- `README.md` — document the invariant and the fix.

Out of scope:

- Any change to how `DATABASE_URL` is provisioned in a real
  production deployment (production has no `.env` file; env vars
  come from the hosting platform and are unaffected by this dotenv
  change since there is nothing in a nonexistent file to override
  from).
- Rewriting `resetDb()`'s existing `NODE_ENV` guard — it remains a
  correct, cheap first check; the new helper is an additional gate,
  not a replacement.

## Invariant restored

```
TEST SUITE  → test DB only  (env.ts override + dbSafety assertion)
DEV SERVER  → dev DB only   (unaffected; override only ever pulls
                              from the same NODE_ENV-selected file
                              dev already used)
PRODUCTION  → prod DB only  (unaffected; no .env file present)
```
