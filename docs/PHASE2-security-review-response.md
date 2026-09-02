# PHASE 2 Security Review — Fixes Applied

Response to ChatGPT's PHASE 2 security review. All 7 required items addressed.

---

## 1. Files changed

- `supabase/migrations/0004_profiles.sql` — added `is_trusted_context()`, `trg_profiles_lock_role` (role-escalation fix), explicit `REVOKE`/`GRANT` on `handle_new_user()` and `is_trusted_context()`
- `supabase/migrations/0009_reports.sql` — rewritten: `contractor_id`/`review_id` real nullable FKs + `CHECK` constraint, replacing polymorphic `target_type`/`target_id` + trigger
- `supabase/migrations/0011_system_settings.sql` — added `is_public` column, `get_setting()` now filters by it, explicit `REVOKE`/`GRANT EXECUTE`
- `supabase/migrations/0012_denormalized_field_triggers.sql` — `trg_contractors_lock_admin_fields` now gated on `is_trusted_context()` instead of `is_admin()` alone (service-role fix)
- `supabase/seed.sql` — the 4 seeded settings marked `is_public = true`
- `scripts/seed-districts.mjs` — rewritten to read a committed local snapshot instead of fetching from GitHub at seed time
- `scripts/generate-districts-snapshot.mjs` — **new**, generates that snapshot (run once with real network access)
- `docs/DATABASE.md` — updated ERD, dependency order, RLS summary, new "Security review fixes" section, updated districts known-risk section
- `docs/SECURITY_TEST_PLAN.md` — **new**

## 2. Exact security issues fixed

| # | Issue | Fix |
|---|---|---|
| 1 | `trg_contractors_lock_admin_fields` could incorrectly block a legitimate `service_role` update (no `auth.uid()` in that context) | New `is_trusted_context()` helper (`is_admin() OR auth.role() = 'service_role'`), used by the trigger instead of `is_admin()` alone |
| 2 | **Blocker**: any authenticated user could set their own `profiles.role` to `'admin'` via `UPDATE`, defeating every admin check in the schema | New `trg_profiles_lock_role` trigger forces `role` back to its previous value unless caller is trusted |
| 3 | `get_setting()` let any caller read any `system_settings` key, with no allowlist for future admin-only config | Added `system_settings.is_public` (default `false`); `get_setting()` only returns a value when `is_public = true` or caller is trusted; explicit `REVOKE`/`GRANT EXECUTE` on the function |
| 3b | `handle_new_user()` (SECURITY DEFINER) was directly callable by any authenticated user, not just via its trigger | `REVOKE EXECUTE ... FROM public, anon, authenticated` — trigger invocation is unaffected by this |
| 4 | `reports.target_id` had no real referential integrity (trigger-only validation) | Migrated to `contractor_id`/`review_id` explicit nullable FKs with `CHECK (contractor_id IS NOT NULL) <> (review_id IS NOT NULL)` |
| 5 | District seeding depended on a live GitHub fetch at every seed run — reproducibility risk if upstream changes/disappears | Split into `generate-districts-snapshot.mjs` (run once, commits a pinned local snapshot) + `seed-districts.mjs` (reads the committed snapshot, no network dependency at seed time) |

## 3. Remaining known risks

1. **🔴 `data/districts-snapshot.json` has not been generated yet.** `generate-districts-snapshot.mjs` needs to run somewhere with real network access — this sandbox has none. This is a required step before districts can actually be seeded. Recommend running it from Claude Code as the first action once you move there.
2. **🔴 None of the 13 migrations (nor the security fixes above) have been executed against a real Postgres/Supabase database.** Everything was verified by careful manual/static review only — see item 4 below. This is the single biggest open risk carried out of PHASE 2.
3. **🟠 `docs/SECURITY_TEST_PLAN.md` is a checklist, not yet a completed test run.** None of its checkboxes have been ticked — it needs to actually be executed against a real project with real `anon`/`authenticated`/`service_role` credentials.
4. **🟡 The commit SHA placeholder in `generate-districts-snapshot.mjs`** (`source_commit: 'TODO...'`) needs to be filled in with the actual commit used, the first time that script runs — this is a manual step, not automated, by design (so it's an explicit, auditable record of what was pinned and when).

## 4. Were migrations actually executed against PostgreSQL/Supabase?

**No.** Per the review's instruction to be explicit rather than claim
otherwise: this environment has no network access and no local Postgres
instance, so all fixes above were done by careful manual review of the
SQL (dependency order, trigger execution order, RLS policy logic, FK/CHECK
constraint correctness) — **not** by running `supabase db reset` or
equivalent against a real database. **NOT VERIFIED BY EXECUTION.**

This needs to happen — ideally in Claude Code, which has real Supabase
access — before PHASE 3 begins: run all 13 migrations in order against a
fresh project, run `seed.sql`, generate and commit the districts snapshot,
run `seed-districts.mjs`, then work through `docs/SECURITY_TEST_PLAN.md`
with real credentials.

## 5. Is PHASE 2 now ready for approval?

**Conditionally.** All 6 substantive issues ChatGPT found have been fixed
in the code and documented. But per item 4 above, none of it has been
proven against a real database yet — approval at this point means
"the design and code are believed correct after two rounds of review,"
not "this has been tested and works." Recommend one of:

- **(A)** Approve PHASE 2 conditional on running the migrations + snapshot
  generation + security test plan in Claude Code as the very next step,
  before any PHASE 3 UI work begins, or
- **(B)** Treat "run against real Supabase + complete the security test
  plan" as the true remaining scope of PHASE 2, and hold formal approval
  until that's done.

Either way: **not starting PHASE 3 yet**, per the review's instruction.
