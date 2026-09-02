# Security Test Plan — ศูนย์รวมผู้รับเหมาไทย

Manual (or scripted, later) tests to run against a real Supabase project
before trusting the RLS/trigger security model in production. Every test
below should be run with the actual `anon` key, a real `authenticated`
session, and the `service_role` key respectively — **not** just read as
a description of intended behavior.

## ✅ EXECUTED — 2026-09-02, from Claude Code

All 44 checklist items below were run for real and **all passed (44/44)**
— zero schema, RLS, or trigger bugs were found. See
`docs/PHASE2-EXECUTION-REPORT.md` for full detail, two real discrepancies
from design-time assumptions surfaced along the way (not bugs — documented
there), and the one environment substitution this run required: the real
Supabase/PostgREST/GoTrue Docker
images could not be pulled in this session (organization egress policy
blocks the GHCR/Docker Hub blob CDNs), so tests ran against local
Postgres 16 with a faithful reproduction of Supabase's `auth` schema
(`auth.uid()`, `auth.role()`, exact same SQL as Supabase ships) and the
same `anon`/`authenticated`/`service_role` Postgres roles, driving each
test through the identical `SET ROLE` + `request.jwt.claims` mechanism
PostgREST itself uses per request. This validates every RLS policy,
trigger, and constraint at the database level exactly as production would
evaluate it. It does **not** exercise the HTTP/JWT-signature layer itself
(GoTrue token issuance, PostgREST's HTTP routing) — see the execution
report for why that's a low-risk gap and what to do once a real hosted
Supabase project exists.

The reusable test harness lives in `supabase/local-dev/` (bootstrap SQL +
a minimal local PostgREST-shim + the test script) so this checklist can be
re-run after any future migration change without needing a hosted project.

## A. Anonymous user (no session, `anon` key)

- [x] Cannot `INSERT`/`UPDATE`/`DELETE` on `contractors` for any row — **PASS**
- [x] Cannot `INSERT`/`UPDATE`/`DELETE` on `profiles` for any row — **PASS**
- [x] Cannot `SELECT` a `profiles` row (own or anyone else's — there is no "own" without a session) — **PASS**
- [x] Cannot `SELECT` a `contractors` row where `status != 'approved'` — **PASS**
- [x] **Can** `SELECT` `contractors` rows where `status = 'approved'` — **PASS**
- [x] **Can** `INSERT` into `contact_events` (any `event_type`) — **PASS** (see report: works as a plain insert; chaining `.select()` on this call from the frontend would itself error under RLS since anon has no read-back policy — client-side note, not a schema bug)
- [x] **Can** `INSERT` into `reports` (with exactly one of `contractor_id`/`review_id` set) — **PASS** (same `.select()` note as above)
- [x] Cannot `SELECT` from `reports` (admin-only) — **PASS**
- [x] Cannot `SELECT` from `system_settings` directly (table has no anon select policy) — but **can** call `get_setting('free_contractor_portfolio_limit')` and get a value back (it's marked `is_public`) — **PASS**
- [x] Calling `get_setting()` with a made-up/non-`is_public` key returns `null`, not an error and not the value — **PASS**

## B. Normal contractor (authenticated, owns one `contractors` row)

- [x] **Can** `UPDATE` own `contractors` row's `business_name`, `description`, `phone`, `line_id`, `facebook_url`, `province_id`, `district_id`, `address`, `years_experience`, `profile_image_url` — **PASS**
- [x] **Cannot** approve own contractor — set `status = 'approved'` via direct `UPDATE`, then re-`SELECT` the row and confirm `status` is unchanged — **PASS**
- [x] **Cannot** change own `verification_status` — same pattern — **PASS**
- [x] **Cannot** change own `plan_tier` — same pattern — **PASS**
- [x] **Cannot** change own `featured_until` — same pattern — **PASS**
- [x] **Cannot** `UPDATE` a *different* contractor's row (attempt with a known other `contractor_id`, expect 0 rows affected / RLS denial) — **PASS**
- [x] **Cannot** change own `profiles.role` from `'contractor'` to `'admin'` — attempt the `UPDATE`, then re-`SELECT` and confirm `role` is unchanged — **PASS**
- [x] **Can** `INSERT`/`UPDATE`/`DELETE` own `portfolio_images` (via owning `contractor_id`) — **PASS**
- [x] **Cannot** touch another contractor's `portfolio_images` — **PASS**
- [x] **Can** `INSERT` a `reviews` row for a *different* contractor (as the reviewer) — **PASS**
- [x] **Cannot** `INSERT` a second `reviews` row for the same contractor they already reviewed (expect a unique-constraint violation) — **PASS**
- [x] **Cannot** `UPDATE`/`DELETE` their own posted review afterward (no policy grants this to a non-admin) — **PASS**

## C. Admin (authenticated, `profiles.role = 'admin'`)

- [x] **Can** set any contractor's `status` to `approved`/`suspended`/`rejected` — **PASS**
- [x] **Can** set any contractor's `verification_status` — **PASS**
- [x] **Can** set any contractor's `plan_tier` — **PASS**
- [x] **Can** set any contractor's `featured_until` — **PASS**
- [x] **Can** `UPDATE`/`DELETE` any `reviews` row (moderation) — **PASS**
- [x] **Can** `SELECT`/`UPDATE` any `reports` row — **PASS**
- [x] **Can** `SELECT`/`INSERT`/`UPDATE` on `system_settings` directly, including non-`is_public` rows — **PASS**
- [x] **Can** `SELECT` from `admin_actions` (their own inserted rows and others') — **PASS**
- [x] `is_admin()` returns `true` for this session and `false` once the same query is re-run as a different, non-admin authenticated user — **PASS**

## D. Service role (`service_role` key — bypasses RLS entirely)

- [x] Can perform trusted administrative operations (e.g. bulk-approve, data migration/backfill scripts) without any RLS denial — expected, since `service_role` bypasses RLS by design — **PASS**
- [x] Updating `contractors.status`/`verification_status`/`plan_tier`/`featured_until` via `service_role` is **not** blocked by `trg_contractors_lock_admin_fields` — this is the specific edge case the trigger was fixed for; confirm `public.is_trusted_context()` returns `true` in a `service_role` context by checking the field actually changes after the update — **PASS**
- [x] Updating `profiles.role` via `service_role` is **not** blocked by `trg_profiles_lock_role` — same pattern, confirm the change persists — **PASS**

## E. Reports

- [x] Cannot `INSERT` a `reports` row referencing a `contractor_id` that doesn't exist (expect FK violation) — **PASS**
- [x] Cannot `INSERT` a `reports` row referencing a `review_id` that doesn't exist (expect FK violation) — **PASS**
- [x] Cannot `INSERT` a `reports` row with **both** `contractor_id` and `review_id` set (expect `reports_exactly_one_target` CHECK violation) — **PASS**
- [x] Cannot `INSERT` a `reports` row with **neither** set (expect the same CHECK violation) — **PASS**
- [x] Deleting a `contractors` row cascades to delete any `reports` rows that pointed at it (documented, intentional — confirm it actually happens) — **PASS**
- [x] Deleting a `reviews` row cascades to delete any `reports` rows that pointed at it (same) — **PASS**

## F. Denormalized field integrity

- [x] After inserting an `active` review, the parent contractor's `rating_avg`/`review_count` update to reflect it — **PASS**
- [x] After an admin sets a review's `status` to `'flagged'` or `'removed'`, the parent contractor's `rating_avg`/`review_count` recompute to exclude it — **PASS**
- [x] Directly `UPDATE`-ing `contractors.rating_avg` to an arbitrary value, then triggering any review change on that contractor, confirms the trigger overwrites the manual value back to the correct computed average (proves the "cannot silently drift" guarantee) — **PASS**
- [x] Adding a `portfolio_images` row for a contractor with no prior images increases `profile_completeness` — **PASS**
