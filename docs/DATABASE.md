# Database Documentation — ศูนย์รวมผู้รับเหมาไทย

This document explains the database created in PHASE 2. It is written for
a founder without a programming background, and for any future
programmer who needs to understand the schema quickly.

## How to read this document

- **ERD** — a text diagram of how tables connect.
- **Table descriptions** — what each table is for, in plain language.
- **Relationships** — which tables depend on which.
- **RLS summary** — who can see/edit what, and why it's safe.
- **Important constraints** — rules the database enforces automatically.
- **Seed data** — what data comes pre-loaded, and from where.

## ERD (text diagram)

```
provinces ──1:N── districts
provinces ──1:N── contractors (province_id)
districts ──1:N── contractors (district_id)

auth.users ──1:1── profiles ──1:1── contractors

contractors ──1:N── portfolio_images
contractors ──N:M── categories   (via contractor_categories)
contractors ──1:N── reviews
contractors ──1:N── contact_events
contractors ──0:N── reports      (contractor_id, nullable FK)
reviews     ──0:N── reports      (review_id, nullable FK — exactly one of the two is set per report)

profiles (role=admin) ──1:N── admin_actions
```

## Table descriptions

| Table | Purpose |
|---|---|
| `provinces` | Thailand's 77 provinces. Reference data, rarely changes. |
| `districts` | ~928 amphoe/khet, each belonging to one province. |
| `categories` | The 10 contractor work categories (สร้างบ้าน, ต่อเติม, ...). |
| `profiles` | One row per signed-up user (customer, contractor, or admin). Created automatically when someone signs up. |
| `contractors` | One row per contractor business. Only visible publicly when `status = 'approved'`. |
| `contractor_categories` | Which categories a contractor works in (many-to-many). |
| `portfolio_images` | Photos of a contractor's past work. |
| `reviews` | Customer ratings/comments on a contractor. One per (contractor, reviewer). |
| `contact_events` | Anonymous log of "someone clicked call/LINE/Facebook/viewed this profile" — no identity stored. |
| `reports` | Flags raised by anyone against a contractor or a review, for admin to review. |
| `admin_actions` | Audit log of everything an admin does (approve, suspend, remove review, etc). |
| `system_settings` | Admin-editable config values (e.g. portfolio image limit) so limits can change without a code deploy. |

## Relationships (dependency order — this is also the migration file order)

1. `provinces`, `districts` (districts depends on provinces)
2. `categories`
3. `profiles` (depends on `auth.users`, which Supabase manages)
4. `contractors` (depends on `profiles`, `provinces`, `districts`)
5. `contractor_categories` (depends on `contractors`, `categories`)
6. `portfolio_images` (depends on `contractors`)
7. `reviews` (depends on `contractors`, `profiles`)
8. `contact_events` (depends on `contractors`)
9. `reports` (depends on `profiles`, `contractors`, `reviews` — a real nullable foreign key to each, not a polymorphic reference; see "Security review fixes" below)
10. `admin_actions` (depends on `profiles`)
11. `system_settings` (standalone)
12. Denormalized-field triggers (depend on `contractors`, `reviews`, `portfolio_images` all existing)
13. RLS policies (depend on every table above existing)

## RLS summary

Every table has Row Level Security **enabled** — there is no table where
permissions are enforced only by the frontend.

| Table | Anonymous | Logged-in customer | Contractor (own row) | Admin |
|---|---|---|---|---|
| `provinces`/`districts`/`categories` | read | read | read | read + write |
| `profiles` | — | read/write own | read/write own | all |
| `contractors` | read `approved` only | read `approved` only | read/write own (status/verification/plan_tier locked) | all |
| `contractor_categories` | read via approved contractor | same | read/write own | all |
| `portfolio_images` | read via approved contractor | same | read/write own | all |
| `reviews` | read `active` only | read `active` + insert own | read `active` only | moderate (update/delete) |
| `contact_events` | insert (anonymous) | insert | read own contractor's events | all |
| `reports` | insert | insert | insert | read + moderate |
| `admin_actions` | — | — | — | read + insert |
| `system_settings` | — (only via `get_setting()` function) | same | same | all |

Key protections worth calling out:

- A contractor **cannot** approve their own listing, mark themselves
  verified, or set their own `plan_tier`/`featured_until`. RLS allows
  a contractor to `UPDATE` their own row, but a `BEFORE UPDATE` trigger
  (`trg_contractors_lock_admin_fields`) silently forces `status`,
  `verification_status`, `plan_tier`, and `featured_until` back to their
  previous value unless the caller is an admin or a trusted service-role
  context — everything else about their own profile remains editable.
- A user **cannot** change their own `profiles.role` to `'admin'`. A
  similar `BEFORE UPDATE` trigger (`trg_profiles_lock_role`) protects this
  column the same way. See "Security review fixes" below — this was found
  and fixed in an external review after the initial PHASE 2 build.
- `reviews` cannot be edited or deleted by the person who wrote them —
  only an admin can moderate — which prevents a reviewer from quietly
  changing a bad rating into a good one after a dispute, or vice versa.
- `contact_events` has no identity fields at all (see PHASE 1 founder
  decision), so there's nothing sensitive in that table to protect
  beyond making sure only the contractor and admin can read the
  aggregated data.

## Security review fixes (post-PHASE-2)

An external review (ChatGPT, reading the actual PHASE 2 files) found several
issues in the first version of this schema. All were fixed before PHASE 3.
Documented here so the security model is traceable, not just "trust the code":

1. **Contractor admin-field lock could have blocked legitimate service-role
   operations.** `trg_contractors_lock_admin_fields` originally gated on
   `is_admin()` alone, which depends on `auth.uid()` — a service-role
   (server-side) call may have no `auth.uid()` even though it legitimately
   bypasses RLS. Fixed by introducing `public.is_trusted_context()`
   (`is_admin() OR auth.role() = 'service_role'`), used by every
   field-locking trigger from here on.

2. **Profile role escalation (blocker).** The `profiles_update_own` RLS
   policy let any user update their own `profiles` row, and `role` was not
   excluded — meaning a user could set their own `role` to `'admin'` via a
   direct API call, silently defeating every `is_admin()`-gated policy in
   the schema. Fixed with `trg_profiles_lock_role`, a `BEFORE UPDATE`
   trigger that forces `role` back to its previous value unless the caller
   passes `is_trusted_context()`. This is the single most important fix in
   this review — everything else in the schema's security model assumes
   `profiles.role` can only be set by an admin or the server.

3. **`get_setting()` had no allowlist.** Originally any caller could request
   any `system_settings` key by name. Fixed by adding `system_settings.is_public`
   (default `false`) and filtering `get_setting()` to only return a value
   when `is_public = true` or the caller is trusted — so a future
   admin-only setting can be added to the same table without needing a new
   function. The four MVP settings (portfolio limit, project limit, upload
   size limit, review rate limit) are seeded with `is_public = true` since
   the frontend needs to read them for unauthenticated/contractor users.
   `EXECUTE` on `get_setting()` and the new `is_trusted_context()` helper
   is explicitly granted only to `anon`, `authenticated`, `service_role`
   (not a blanket `public` grant) as defense in depth.

4. **`handle_new_user()` could be called directly.** `SECURITY DEFINER`
   functions are callable by any role unless explicitly revoked, regardless
   of "intended" use via a trigger. `handle_new_user()` has no legitimate
   direct-call use case, so direct `EXECUTE` was revoked from
   `public`/`anon`/`authenticated` — the `AFTER INSERT` trigger on
   `auth.users` still invokes it normally; Postgres's trigger mechanism is
   unaffected by function-level `REVOKE`.

5. **`reports.target_id` was polymorphic, not a real foreign key.** The
   original design used `target_type` + `target_id` validated only by a
   trigger — workable, but without true referential integrity (a
   contractor or review deleted elsewhere would silently orphan a report).
   Migrated to two explicit nullable columns, `contractor_id` and
   `review_id`, each a real `REFERENCES ... ON DELETE CASCADE`, with
   `CHECK (contractor_id IS NOT NULL) <> (review_id IS NOT NULL)` enforcing
   exactly one target. See table description above for the deletion-
   behavior tradeoff this implies.

## Important constraints

- `contractors.status` can only be `pending`, `approved`, `suspended`,
  or `rejected` — enforced by a `CHECK` constraint, not just application
  code.
- `contractors.slug` and `provinces.slug` / `categories.slug` are
  `UNIQUE` — the database will reject a duplicate slug outright.
  `districts.slug` is unique only *within* a province (two provinces
  can have a district with the same slug).
- `reviews` has `UNIQUE (contractor_id, reviewer_id)` — the database
  physically cannot store two reviews from the same person for the
  same contractor.
- `reviews.rating` must be between 1 and 5 — enforced by `CHECK`.
- `contractors.rating_avg` and `contractors.review_count` are
  **maintained automatically by a trigger** every time a review is
  added, edited, or removed. The application should never write to
  these columns directly — the trigger will overwrite any manual value
  on the next review change anyway.
- `contractors.profile_completeness` is also trigger-maintained,
  recalculated from a simple weighted checklist every time a
  contractor's profile or portfolio changes.

## Seed data

- **Provinces (77 rows):** sourced from
  [kongvut/thai-province-data](https://github.com/kongvut/thai-province-data)
  (MIT license), a community-maintained dataset of Thailand's official
  administrative divisions. Included directly in `supabase/seed.sql`
  with **Thai-language slugs** generated from `name_th` (founder decision,
  updated after PHASE 2 — the team meets and works in Thai, so slugs use
  the Thai name directly rather than an English transliteration).
- **Categories (10 rows):** the exact 10 categories specified in the
  PHASE 2 founder decision, included directly in `supabase/seed.sql`.
- **Districts (928 rows):** **not** hardcoded in `supabase/seed.sql`.
  See "Known risk — districts seed data" below.
- **System settings:** starting defaults for portfolio limits and
  upload size limits, included in `supabase/seed.sql`. All are
  editable by an admin without a code deploy.

### Known risk — districts seed data

Thailand has 928 districts (amphoe/khet). All 928 names were verified
against the same source used for the 77 provinces
([kongvut/thai-province-data](https://github.com/kongvut/thai-province-data),
MIT license) — hand-transcribing all 928 Thai/English name pairs into a
static SQL file was judged too high-risk for typo/copy errors in what is
effectively government-adjacent reference data, which conflicts directly
with the founder instruction not to invent or guess administrative names.

**Design (updated after the PHASE 2 security review):** seeding districts
is a **two-step, reproducible** process rather than a live network fetch
at deploy time:

1. `scripts/generate-districts-snapshot.mjs` — run once (or to
   intentionally refresh) with real internet access. Fetches the verified
   district list from a pinned upstream source and writes
   `data/districts-snapshot.json`, which is then **committed to the
   repo** like any other seed data.
2. `scripts/seed-districts.mjs` — reads that committed snapshot and
   inserts it into `public.districts`. **No network dependency at
   seed/deploy time** — a fresh deployment is reproducible from the
   repo alone.

This addresses the original design's reproducibility risk (depending on
an external GitHub repo staying available/unchanged forever) while still
avoiding hand-transcription of 928 rows.

**⚠️ `data/districts-snapshot.json` does not exist yet in this
deliverable.** Generating it requires running
`generate-districts-snapshot.mjs` somewhere with real network access —
this development sandbox has none. This is a required step (ideally in
Claude Code) before `seed-districts.mjs` can actually be run — flagged
explicitly here and in the PHASE 2 security review report, not silently
worked around.
