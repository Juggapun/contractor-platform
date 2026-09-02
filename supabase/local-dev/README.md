# Local-dev RLS test harness

This directory is **not part of the production schema**. It exists so the
checklist in `docs/SECURITY_TEST_PLAN.md` can be re-run against a plain
local Postgres instance whenever `supabase start` (Docker-based, pulls the
real Postgres/GoTrue/PostgREST/Realtime images) isn't available — e.g. an
environment whose egress policy blocks the GHCR/Docker Hub blob CDNs, as
was the case when this harness was first written (see
`docs/PHASE2-EXECUTION-REPORT.md`).

If `supabase start` **is** available in your environment, prefer it —
it's the real thing (real GoTrue-issued JWTs, real PostgREST). Use this
harness only as a fallback.

## What it does

- `00_bootstrap.sql` — creates the `anon` / `authenticated` / `service_role`
  / `authenticator` Postgres roles and a minimal `auth` schema
  (`auth.users`, `auth.uid()`, `auth.role()`, `auth.email()`) reproduced
  verbatim from Supabase's own implementation, so RLS policies evaluate
  identically to a real Supabase project. Run this **before** the numbered
  migrations in `supabase/migrations/` against a fresh database.
- `postgrest-shim.mjs` — a ~100-line HTTP server implementing just the two
  REST calls `scripts/seed-districts.mjs` makes (`GET /rest/v1/provinces`,
  upsert `POST /rest/v1/districts`), so that script can run completely
  unmodified against local Postgres. It is not a PostgREST replacement —
  don't point real application code at it.
- `run-security-tests.mjs` — runs every checklist item in
  `docs/SECURITY_TEST_PLAN.md` as a real SQL statement, wrapping each in
  `SET LOCAL ROLE <anon|authenticated|service_role>` plus
  `SET LOCAL request.jwt.claims = '...'` — the exact mechanism PostgREST
  itself uses per request to establish `auth.uid()`/`auth.role()`. This
  validates every RLS policy, trigger, and constraint at the database
  level. It does **not** exercise the HTTP layer, JWT signing/verification,
  or GoTrue's actual signup flow — those require the real Supabase stack.

## Usage

```bash
# 1. Fresh local database
sudo -u postgres createdb contractor_platform

# 2. Bootstrap roles + auth schema emulation
sudo -u postgres psql -d contractor_platform -f supabase/local-dev/00_bootstrap.sql

# 3. Run the numbered migrations, then supabase/seed.sql, as usual
for f in supabase/migrations/*.sql; do
  sudo -u postgres psql -v ON_ERROR_STOP=1 -d contractor_platform -f "$f"
done
sudo -u postgres psql -v ON_ERROR_STOP=1 -d contractor_platform -f supabase/seed.sql

# 4. Seed districts via the shim (run once you have data/districts-snapshot.json)
sudo -u postgres psql -d contractor_platform -c \
  "alter role authenticator with password 'authenticator_pw';"
node supabase/local-dev/postgrest-shim.mjs &
SUPABASE_URL="http://127.0.0.1:54321" \
  SUPABASE_SERVICE_ROLE_KEY="local-service-role-key" \
  node scripts/seed-districts.mjs

# 5. Insert a handful of test fixtures (see run-security-tests.mjs's IDS
#    constant for the exact ids it expects), then run the checklist:
node supabase/local-dev/run-security-tests.mjs
```

The `authenticator_pw` / `local-service-role-key` values above are
throwaway local-only defaults — never use them, or this harness, against
a real Supabase project.
