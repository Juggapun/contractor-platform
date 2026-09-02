# Security Test Plan — ศูนย์รวมผู้รับเหมาไทย

Manual (or scripted, later) tests to run against a real Supabase project
before trusting the RLS/trigger security model in production. Every test
below should be run with the actual `anon` key, a real `authenticated`
session, and the `service_role` key respectively — **not** just read as
a description of intended behavior.

None of these have been executed yet (see PHASE 2 security review report
— migrations have not run against a real database in this environment).
This file is the checklist to run through once a real Supabase project
exists, ideally in Claude Code.

## A. Anonymous user (no session, `anon` key)

- [ ] Cannot `INSERT`/`UPDATE`/`DELETE` on `contractors` for any row
- [ ] Cannot `INSERT`/`UPDATE`/`DELETE` on `profiles` for any row
- [ ] Cannot `SELECT` a `profiles` row (own or anyone else's — there is no "own" without a session)
- [ ] Cannot `SELECT` a `contractors` row where `status != 'approved'`
- [ ] **Can** `SELECT` `contractors` rows where `status = 'approved'`
- [ ] **Can** `INSERT` into `contact_events` (any `event_type`)
- [ ] **Can** `INSERT` into `reports` (with exactly one of `contractor_id`/`review_id` set)
- [ ] Cannot `SELECT` from `reports` (admin-only)
- [ ] Cannot `SELECT` from `system_settings` directly (table has no anon select policy) — but **can** call `get_setting('free_contractor_portfolio_limit')` and get a value back (it's marked `is_public`)
- [ ] Calling `get_setting()` with a made-up/non-`is_public` key returns `null`, not an error and not the value

## B. Normal contractor (authenticated, owns one `contractors` row)

- [ ] **Can** `UPDATE` own `contractors` row's `business_name`, `description`, `phone`, `line_id`, `facebook_url`, `province_id`, `district_id`, `address`, `years_experience`, `profile_image_url`
- [ ] **Cannot** approve own contractor — set `status = 'approved'` via direct `UPDATE`, then re-`SELECT` the row and confirm `status` is unchanged
- [ ] **Cannot** change own `verification_status` — same pattern
- [ ] **Cannot** change own `plan_tier` — same pattern
- [ ] **Cannot** change own `featured_until` — same pattern
- [ ] **Cannot** `UPDATE` a *different* contractor's row (attempt with a known other `contractor_id`, expect 0 rows affected / RLS denial)
- [ ] **Cannot** change own `profiles.role` from `'contractor'` to `'admin'` — attempt the `UPDATE`, then re-`SELECT` and confirm `role` is unchanged
- [ ] **Can** `INSERT`/`UPDATE`/`DELETE` own `portfolio_images` (via owning `contractor_id`)
- [ ] **Cannot** touch another contractor's `portfolio_images`
- [ ] **Can** `INSERT` a `reviews` row for a *different* contractor (as the reviewer)
- [ ] **Cannot** `INSERT` a second `reviews` row for the same contractor they already reviewed (expect a unique-constraint violation)
- [ ] **Cannot** `UPDATE`/`DELETE` their own posted review afterward (no policy grants this to a non-admin)

## C. Admin (authenticated, `profiles.role = 'admin'`)

- [ ] **Can** set any contractor's `status` to `approved`/`suspended`/`rejected`
- [ ] **Can** set any contractor's `verification_status`
- [ ] **Can** set any contractor's `plan_tier`
- [ ] **Can** set any contractor's `featured_until`
- [ ] **Can** `UPDATE`/`DELETE` any `reviews` row (moderation)
- [ ] **Can** `SELECT`/`UPDATE` any `reports` row
- [ ] **Can** `SELECT`/`INSERT`/`UPDATE` on `system_settings` directly, including non-`is_public` rows
- [ ] **Can** `SELECT` from `admin_actions` (their own inserted rows and others')
- [ ] `is_admin()` returns `true` for this session and `false` once the same query is re-run as a different, non-admin authenticated user

## D. Service role (`service_role` key — bypasses RLS entirely)

- [ ] Can perform trusted administrative operations (e.g. bulk-approve, data migration/backfill scripts) without any RLS denial — expected, since `service_role` bypasses RLS by design
- [ ] Updating `contractors.status`/`verification_status`/`plan_tier`/`featured_until` via `service_role` is **not** blocked by `trg_contractors_lock_admin_fields` — this is the specific edge case the trigger was fixed for; confirm `public.is_trusted_context()` returns `true` in a `service_role` context by checking the field actually changes after the update
- [ ] Updating `profiles.role` via `service_role` is **not** blocked by `trg_profiles_lock_role` — same pattern, confirm the change persists

## E. Reports

- [ ] Cannot `INSERT` a `reports` row referencing a `contractor_id` that doesn't exist (expect FK violation)
- [ ] Cannot `INSERT` a `reports` row referencing a `review_id` that doesn't exist (expect FK violation)
- [ ] Cannot `INSERT` a `reports` row with **both** `contractor_id` and `review_id` set (expect `reports_exactly_one_target` CHECK violation)
- [ ] Cannot `INSERT` a `reports` row with **neither** set (expect the same CHECK violation)
- [ ] Deleting a `contractors` row cascades to delete any `reports` rows that pointed at it (documented, intentional — confirm it actually happens)
- [ ] Deleting a `reviews` row cascades to delete any `reports` rows that pointed at it (same)

## F. Denormalized field integrity

- [ ] After inserting an `active` review, the parent contractor's `rating_avg`/`review_count` update to reflect it
- [ ] After an admin sets a review's `status` to `'flagged'` or `'removed'`, the parent contractor's `rating_avg`/`review_count` recompute to exclude it
- [ ] Directly `UPDATE`-ing `contractors.rating_avg` to an arbitrary value, then triggering any review change on that contractor, confirms the trigger overwrites the manual value back to the correct computed average (proves the "cannot silently drift" guarantee)
- [ ] Adding a `portfolio_images` row for a contractor with no prior images increases `profile_completeness`
