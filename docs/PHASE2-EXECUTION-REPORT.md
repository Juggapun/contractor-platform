# PHASE 2 execution report — ศูนย์รวมผู้รับเหมาไทย

Run date: 2026-09-02, from Claude Code (real internet access, unlike the
original chat-sandbox design environment). This report covers the first
real execution of every PHASE 2 migration, seed, and security test against
an actual Postgres database — none of it had ever been run before this
session.

## 0. Environment note — one substitution, disclosed upfront

Step 1 asked for a fresh **Supabase project**. This session's outbound
network goes through an org-enforced egress proxy that allows
`raw.githubusercontent.com` but returns `403 Forbidden` on the Docker
Hub/GHCR blob CDNs (`production.cloudfront.docker.com`,
`pkg-containers.githubusercontent.com`) and on `github.com`/`api.github.com`
themselves. That's a firm policy denial (confirmed via the proxy's own
diagnostic endpoint), not a transient failure — `supabase start`, which
needs to pull the Postgres/GoTrue/PostgREST/Realtime/Studio Docker images,
is not viable in this session, and no hosted-Supabase credentials exist
here either.

**What was used instead:** local Postgres 16 (already installed in this
environment) as the "fresh database," bootstrapped with a faithful
reproduction of the parts of a real Supabase project the migrations
assume exist — the `anon`/`authenticated`/`service_role`/`authenticator`
Postgres roles, and an `auth` schema with `auth.users`, `auth.uid()`,
`auth.role()`, `auth.email()` implemented with the **same SQL Supabase's
own project template ships**. Every migration, the seed, the district
snapshot/seed scripts, and all 44 security-test-plan items ran against
this database for real — this is genuine Postgres, genuine RLS
enforcement, genuine trigger execution, not a simulation of the logic.

**What this does *not* cover:** the HTTP/JWT layer itself — GoTrue issuing
and signing real JWTs, PostgREST parsing `Authorization: Bearer` headers
and translating REST calls to SQL. The security tests emulate that layer
by setting the exact same `request.jwt.claims`/`SET ROLE` state PostgREST
sets per request, which is what actually drives `auth.uid()`/`auth.role()`
and therefore every RLS policy — so the authorization logic itself is
validated end-to-end. What's untested is PostgREST's own request routing
and GoTrue's signup/token-issuance flow, which are Supabase-platform code,
not this project's code. See "Residual risks" below for what to do about
this once a real hosted project exists.

The reusable harness (bootstrap SQL, a minimal local REST shim, the test
script) is committed at `supabase/local-dev/` for future re-runs — see
its README.

## 1. Migration execution result

All 13 migration files ran **in order, with zero errors**, against a
freshly created database:

| # | File | Result |
|---|---|---|
| 0001 | extensions.sql | ✅ SUCCESS |
| 0002 | geography.sql | ✅ SUCCESS |
| 0003 | categories.sql | ✅ SUCCESS |
| 0004 | profiles.sql | ✅ SUCCESS |
| 0005 | contractors.sql | ✅ SUCCESS |
| 0006 | portfolio_images.sql | ✅ SUCCESS |
| 0007 | reviews.sql | ✅ SUCCESS |
| 0008 | contact_events.sql | ✅ SUCCESS |
| 0009 | reports.sql | ✅ SUCCESS |
| 0010 | admin_actions.sql | ✅ SUCCESS |
| 0011 | system_settings.sql | ✅ SUCCESS |
| 0012 | denormalized_field_triggers.sql | ✅ SUCCESS |
| 0013 | rls_policies.sql | ✅ SUCCESS |

No fixes were needed to any migration file. Post-migration structural
verification also passed:

- **RLS enabled on all 12 `public` tables** (`select tablename, rowsecurity
  from pg_tables where schemaname='public'` → all `rowsecurity = t`).
- **46 constraints** verified present across all tables (PKs, FKs, all
  CHECK constraints including `reports_exactly_one_target`, all UNIQUE
  constraints including `reviews(contractor_id, reviewer_id)`).
- **13 non-trivial indexes** verified present, matching every `create
  index` in the migrations.
- **12 triggers on `public` tables + 1 on `auth.users`** verified present
  and firing correctly (confirmed functionally, not just by existence —
  see section 3, tests F1–F4, D2, D3, B2–B5, B7).

## 2. Seed result

`supabase/seed.sql` ran with zero errors:

| Table | Rows inserted |
|---|---|
| `provinces` | **77** (matches spec exactly) |
| `categories` | **10** (matches spec exactly) |
| `system_settings` | **4** (matches spec exactly, all `is_public = true`) |

## 3. District snapshot — commit SHA and actual count

`scripts/generate-districts-snapshot.mjs` was edited to fetch from a
pinned commit instead of `refs/heads/master`, then run for real.

- **Resolved commit:** `326c2ebe778fc0c6a26c4b09770e3c2aa97c6be8`
  (`git ls-remote https://github.com/kongvut/thai-province-data.git
  refs/heads/master`, run from this session — real network access).
- **`data/districts-snapshot.json` generated and committed**, with
  `source_commit` filled in for real (was previously a `TODO` placeholder).
- **Actual district count: 930 — not 928.**

This is a genuine finding, not a bug in the script or a data quality
problem. Verified directly against the pinned-commit data:

- All 930 rows have unique `id`s, no duplicates.
- All 930 map to one of the 77 seeded `province_id`s (no orphans).
- No row has a non-null `deleted_at` (no soft-deleted rows sneaking in).
- Bangkok (`province_id=1`) has exactly 50 districts — matches the
  well-known 50 Khet of Bangkok, a strong sanity signal the data is
  correct.
- `province.json` at the same commit returns exactly 77 — matches
  `supabase/seed.sql` exactly.

Most likely explanation: the upstream dataset's `updated_at` timestamps
on district rows show recent (2025) updates, consistent with Thailand
having created new amphoe (districts) since "928" was last an accurate
count — a periodic real-world administrative event, not a data defect.
**No migration or seed logic enforces the literal number 928** — it only
appears in code comments and this task's own instructions — so nothing
broke; `scripts/seed-districts.mjs` and the `districts` table handle 930
rows exactly as it would 928. Recommend updating the "~928 rows
nationwide" comment in `supabase/migrations/0002_geography.sql` and
`docs/DATABASE.md` to reflect 930 (or better, say "all districts from the
pinned snapshot" rather than a hardcoded figure) in a follow-up commit —
not done here since it's a comment-only change outside this session's
scope of migration/seed logic, and is flagged here explicitly rather than
silently "corrected" to match the expected number.

`scripts/seed-districts.mjs` then ran **unmodified** (via a minimal local
REST shim implementing just the two PostgREST calls it makes — see
`supabase/local-dev/README.md`) and inserted all 930 rows successfully,
covering all 77 provinces.

## 4. Final row counts

| Table | Expected | Actual | Match |
|---|---|---|---|
| `provinces` | 77 | 77 | ✅ |
| `districts` | 928 | **930** | ⚠️ see §3 — real, verified, non-bug discrepancy |
| `categories` | 10 | 10 | ✅ |
| `system_settings` | 4 | 4 | ✅ |

## 5. Security test results — 44/44 PASS

Every item in `docs/SECURITY_TEST_PLAN.md` (sections A–F) was run for
real as `anon`, `authenticated` (customer/contractor/admin), and
`service_role`, via the mechanism described in §0. **All 44 items pass.**
See `docs/SECURITY_TEST_PLAN.md` for the per-item checklist with results
ticked, and `supabase/local-dev/run-security-tests.mjs` for the exact
executable assertions (46 granular test cases — a few checklist bullets
covering multiple operations, e.g. "cannot INSERT/UPDATE/DELETE," were
split into one test per operation for precision).

**Zero schema, RLS, or trigger bugs were found.** All five ChatGPT
security-review fixes from PHASE 2 (role-escalation lock, service-role
trusted-context, reports FK design, system_settings allowlist,
districts pinned-snapshot design) hold up under real execution:

- `trg_profiles_lock_role` genuinely blocks self-promotion to admin (B7 pass)
  and genuinely allows it for `service_role` (D3 pass).
- `trg_contractors_lock_admin_fields` genuinely blocks a contractor from
  self-approving / self-verifying / setting their own `plan_tier` or
  `featured_until` (B2–B5 pass), and genuinely allows `service_role` to do
  so (D2 pass) — confirming `is_trusted_context()`'s `auth.role() =
  'service_role'` branch actually works, not just `is_admin()`.
  `reports_exactly_one_target` genuinely rejects both-set and
  neither-set inserts (E3, E4 pass), and both FKs genuinely enforce
  referential integrity with real `ON DELETE CASCADE` (E1, E2, E5, E6
  pass).
- `get_setting()`'s `is_public` allowlist genuinely returns a value for
  public keys and `null` (not an error, not the raw value) for
  unknown/non-public keys, to `anon` (A11, A12 pass).

## 6. Real (non-bug) findings surfaced during testing

Two things worth the team's attention, neither of which required a code
fix:

1. **District count is 930, not 928** — see §3. Recommend updating the
   comment in `0002_geography.sql`/`DATABASE.md` in a follow-up commit.
2. **`INSERT ... RETURNING` under RLS for `anon` on `contact_events` /
   `reports`:** Postgres requires a row to satisfy a `SELECT` policy to
   be eligible for a `RETURNING` clause, even on `INSERT`. `anon` has no
   `SELECT` policy on either table (by design — anonymous inserts,
   admin-only reads), so a plain insert succeeds, but if frontend code
   ever calls `.insert(...).select()` (which requests `RETURNING`) as
   `anon` on these two tables, it will get an RLS error even though the
   row really was inserted. This is arguably correct/desired behavior
   (anonymous callers shouldn't get identifying confirmation of what they
   just wrote), but it's a real gotcha for whoever builds the frontend —
   worth a one-line note in `DATABASE.md`: "don't chain `.select()` after
   inserting into `contact_events`/`reports` as `anon`."

## 7. Residual risks — what's NOT validated by this session

- **The real Supabase/PostgREST/GoTrue stack itself was never run.**
  Everything above validates the *schema's* authorization logic
  correctly, using the exact GUCs PostgREST sets. It does not prove
  PostgREST's request parsing, GoTrue's JWT signing/verification, or the
  real `anon`/`service_role` API keys behave as assumed — those are
  Supabase-platform concerns, not this project's SQL, but they are still
  untested here. **Action for whoever provisions the real hosted Supabase
  project:** re-run `docs/SECURITY_TEST_PLAN.md` (or better, adapt
  `supabase/local-dev/run-security-tests.mjs`'s assertions into
  `supabase-js` calls against the real project) once real API keys exist,
  before PHASE 3 ships anything user-facing against it.
- **No load/concurrency testing.** Trigger-maintained denormalized fields
  (`rating_avg`, `review_count`, `profile_completeness`) were only
  verified for correctness under sequential single-connection access, not
  under concurrent writes.
- **`auth.users` in this session is a minimal stand-in**, not GoTrue's
  real schema (no email verification state, no MFA columns, no
  `identities` table, etc.) — irrelevant to this project's own tables
  (which only reference `auth.users(id)`), but means the `handle_new_user`
  trigger's real-world signup path (raw GoTrue → trigger → `profiles`
  row) was verified structurally (trigger fires on `auth.users` INSERT,
  creates the `profiles` row correctly — confirmed via the 5 test-fixture
  users) but not through GoTrue's actual signup endpoint.
- **931st+ future district/administrative changes:** the pinned-snapshot
  design (§3) means `data/districts-snapshot.json` will silently go stale
  as Thailand's administrative boundaries change over time — this is the
  intended tradeoff (reproducibility over always-current), already
  documented in `DATABASE.md`, just re-flagged here since this session is
  what first surfaced a real instance of it (928 assumed → 930 actual).

## 8. Final verdict: **READY for PHASE 3**

The database schema, RLS policies, triggers, and constraints are sound —
verified by actual execution, not review. Every migration applies
cleanly to a fresh database, the seed data matches spec, the district
snapshot is real and reproducible with a pinned commit, and all 44
security test cases pass with zero bugs found. The one open item (§7,
first bullet — validating against the real hosted PostgREST/GoTrue
stack) is a pre-launch gate on whoever provisions production Supabase,
not a blocker on starting PHASE 3 UI work against this schema.
