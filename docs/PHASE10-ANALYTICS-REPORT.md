# Phase 10 — Usage & Contact Analytics: Execution Report

Implements GitHub Issue #8 ("Phase 10 — Usage & Contact Analytics"), whose
own framing is the governing constraint throughout: "Keep this phase
focused on measurement; do not build an analytics dashboard product beyond
what is necessary for verification/admin visibility." Read
`docs/BRAND_UI_SPEC.md` first; the one new UI surface (an admin analytics
section) reuses the existing yellow-brand register from Phase 8, no new
visual language introduced.

## Implementation summary

- **Built on the existing `contact_events` model** (`0008_contact_events.sql`,
  Phase 6) exactly as Issue #8 asks ("Use the existing `contact_events`
  model ... where present") — no new table. Extended it in one migration:
  - `event_type` CHECK widened to add `'website'` — closing a gap
    disclosed since Phase 6 (website-link clicks were the one contact
    channel with no event_type to report through).
  - New `contractors.profile_view_count integer not null default 0 check
    (>= 0)` — the "maintain/increment contractor profile view counts
    using real database-backed data" requirement, as a denormalized
    counter (same shape as `rating_avg`/`review_count` since Phase 2)
    rather than a live `count(*)` on an unbounded table on every read.
  - New trigger `update_contractor_view_count()`, firing after
    INSERT/DELETE on `contact_events` where `event_type = 'profile_view'`,
    recomputing the counter from a real `COUNT(*)` query.
- **Every existing contact CTA on the profile page** (phone, LINE,
  Facebook, and now website) fires the same best-effort, non-blocking
  `recordContactEvent()` beacon already built in Phase 6
  (`src/components/ContactLink.tsx`) — Issue #8's "record meaningful
  contractor contact actions (e.g. phone, LINE, Facebook/contact link)"
  is now complete across all four channels, not three.
- **Admin-only minimal visibility**, per Issue #8's explicit anti-scope-
  creep instruction: the existing Phase 8 admin contractor detail route
  (`app/api/admin/contractors/[id]/route.ts`) now also returns
  `profileViewCount` plus a same-request tally of contact_events by
  `event_type`; `AdminContractorDetail.tsx` renders it as one small
  "สถิติการเข้าชม" (usage stats) section. No new page, no new route, no
  time-series, no admin-wide analytics listing — a tally on the page an
  admin already visits to review one contractor.

## Schema / migration changes

**`supabase/migrations/0016_contact_events_analytics.sql`** — the only
migration this phase:
1. `alter table contact_events drop/add constraint` — widens
   `event_type` to `('phone', 'line', 'facebook', 'website',
   'profile_view')` (previously no `'website'`).
2. `contractors.profile_view_count integer not null default 0 check (>=
   0)` — new denormalized column.
3. A one-time backfill (`update contractors set profile_view_count =
   (select count(*) from contact_events where ... event_type =
   'profile_view')`) — **a real gap I found and fixed while building
   this**, not part of the original design. Adding the column with a
   bare default of `0` would have silently under-counted every
   contractor that already had `profile_view` rows from Phase 6 onward,
   until their next real view triggered a recompute. Verified against
   real seed data before/after: seeded fixtures went from `0` (wrong) to
   their true historical count.
4. `update_contractor_view_count()` — **`security definer set search_path
   = public` from the start**, with direct `EXECUTE` revoked from
   `public`/`anon`/`authenticated`. This is the proactive application of
   the exact bug class Phase 9 found reactively (see
   `0015_fix_review_stats_trigger_privileges.sql`): the trigger's
   internal `UPDATE contractors ... WHERE id = contractor_id` touches a
   row the caller essentially never owns — the realistic caller here is
   an anonymous site visitor (`anon`), who `contractors_update_own`
   (0013) never authorizes to update that row at all. Without `security
   definer`, this counter would have quietly never incremented for a
   real anonymous profile view — the same silent-zero-rows failure mode
   Phase 9 hit for `rating_avg`/`review_count`. Applied here before
   shipping, not after finding it broken (confirmed empirically — see
   Security tests, I8).
5. Two triggers, not one: `trg_update_contractor_view_count_ins` (AFTER
   INSERT, `WHEN (new.event_type = 'profile_view')`) and
   `_del` (AFTER DELETE, `WHEN (old.event_type = 'profile_view')`).
   Postgres rejects a single AFTER-INSERT-OR-DELETE trigger whose WHEN
   clause references `NEW` at all (even behind `coalesce(new.x, old.x)`)
   once DELETE is one of the firing events — found by running the
   migration against the live local database, not by inspection; fixed
   by splitting into two triggers, each referencing only the row
   variable that actually exists for its own event.

No other schema changes. `contact_events`' existing RLS policies
(`0013_rls_policies.sql`) needed **no changes** — `contact_events_select_
owner_or_admin` already correctly scoped SELECT to the contractor's owner
or an admin, and `contact_events_insert_anyone` already correctly allowed
anonymous inserts with no read-back. Verified this directly (see Security
tests) rather than assuming it from Phase 6.

## Event types (after this phase)

| `event_type` | Meaning | Fired from |
|---|---|---|
| `phone` | Clicked the phone contact CTA | `ContactLink` (profile page) |
| `line` | Clicked the LINE contact CTA | `ContactLink` (profile page) |
| `facebook` | Clicked the Facebook contact CTA | `ContactLink` (profile page) |
| `website` | Clicked the website contact CTA (**new this phase**) | `ContactLink` (profile page) |
| `profile_view` | Loaded the contractor's profile page | Server Component on `app/contractors/[slug]/page.tsx` (unchanged, Phase 6) |

Each row is `{ id, contractor_id, event_type, created_at }` and nothing
else — "which contractor was viewed/contacted, what contact method was
used, and when" (Issue #8) is fully answerable from that shape alone.

## Privacy / security model

- **No identity is ever recorded** — no user id, no session id, no IP
  address. This was a founder decision from Phase 1, restated in the
  original migration's own table comment and unchanged here. Issue #8
  asks to "prevent a caller from submitting analytics for arbitrary
  unrelated identities **if identity is recorded**" — this is **vacuously
  satisfied**: there is no identity field in `contact_events` for a
  caller to spoof in the first place. Stated explicitly here rather than
  silently skipped, per this project's own reporting convention.
- **No PII of any kind** is stored — no phone numbers, emails, LINE IDs,
  Facebook identifiers. `event_type` is a fixed enum naming the *channel*
  category, never the contact detail itself.
- **Write authorization is entirely RLS/database-side**, not hidden UI:
  `contact_events_insert_anyone` (unchanged, 0013) lets anyone insert an
  event row for any *existing* contractor (an anonymous visitor has no
  session to scope this by, and the whole point is to measure anonymous
  interest) — but the foreign key to `contractors` and the `event_type`
  CHECK constraint are real, unspoofable bounds a direct API caller
  cannot route around (verified — see I5/I6 below).
- **Read authorization is entirely RLS/database-side**:
  `contact_events_select_owner_or_admin` (unchanged, 0013) — a
  contractor's own events are visible only to that contractor's owner or
  an admin; ordinary public users, and any other logged-in user, get
  zero rows back, regardless of what filter they send. Verified directly
  against a real seeded row for all four roles (I1–I4), not reasoned
  about from the policy text alone.
- **Aggregate integrity**: `update_contractor_view_count()` is `security
  definer` with `EXECUTE` revoked from every non-owning role — it can
  only ever run via its own trigger, and always recomputes correctly
  regardless of which role's action fired it (see the migration section
  above and I8/I9 below).
- **Service-role boundary preserved**: the admin analytics tally reads
  through the existing Phase 8 `getSupabaseAdminClient()` path, gated by
  the existing `requireAdmin()` check — no new service-role usage
  pattern introduced, no new bypass.

## Files changed

New:
- `supabase/migrations/0016_contact_events_analytics.sql` — see above.

Modified:
- `src/lib/data/contactEvents.ts` — `ContactEventType` widened to include
  `'website'`; stale Phase 6/7 doc comment describing the website gap
  updated to reflect it's now closed.
- `src/components/ContactLink.tsx` — doc comment updated (no functional
  change; `eventType` was already optional and generic).
- `app/contractors/[slug]/page.tsx` — the website `ContactLink` now
  passes `eventType="website"` (previously rendered untracked).
- `app/api/admin/contractors/[id]/route.ts` — selects
  `profile_view_count`, plus a bounded `event_type`-only read of that
  contractor's `contact_events`, tallied server-side; returns
  `profileViewCount` and `contactEventsTally` alongside the existing
  `contractor` payload.
- `src/lib/data/adminContractors.ts` — `AdminContractorDetailResult` /
  `AdminContactEventTally` types; `fetchAdminContractorDetail()` now
  returns the tally alongside the contractor.
- `src/components/AdminContractorDetail.tsx` — new "สถิติการเข้าชม"
  section rendering `profileViewCount` and the per-channel tally.
- `supabase/local-dev/postgrest-shim.mjs` — local-dev-only, see below.
- `supabase/local-dev/run-security-tests.mjs` — new section I, 9 tests
  (see Security tests).

## Local-dev shim extensions (not production code)

- `contact_events` added to the shim's generic RLS-enforced GET handler
  (`filterable: ['contractor_id', 'event_type']`), which runs *after*
  `applyRequestRole()` sets the connection's role/claims for the request
  — real RLS decides what comes back, the shim does no authorization of
  its own. This table previously had a POST-only handler (Phase 6);
  nothing needed to read it back until the admin analytics tally.
- **A real bug found by manual verification, not by inspection**: the
  shim's purpose-built `handleContractorsSearch()` (used for every
  `GET /rest/v1/contractors` call, including the admin detail route's
  select) returns a *fixed* column list regardless of the actual
  `select=` query string sent — it does not parse `select=` at all. The
  admin detail route's new `select(...)` asks for `profile_view_count`,
  which silently would have come back `undefined` on every request
  without a corresponding fix on the shim side. Added `c.profile_view_
  count` to that fixed column list. This is a local-dev-emulation-only
  gap (a real PostgREST server does honor `select=`) — noted so it isn't
  mistaken for a production bug.

## Security tests (Issue #8's explicit requirements — each verified directly, live)

New **Section I** in `supabase/local-dev/run-security-tests.mjs`, run as
real SQL under `SET LOCAL ROLE`/`request.jwt.claims` (the same mechanism
real PostgREST uses per-request), against the live local database:

| # | Test | Result |
|---|---|---|
| I1 | Anonymous `SELECT` of a real, seeded `contact_events` row | `0` rows — RLS blocks it entirely |
| I2 | A logged-in user who owns no contractor tries to `SELECT` another contractor's events | `0` rows |
| I3 | The contractor who owns the profile `SELECT`s its own events | `1` row — sees it |
| I4 | Admin `SELECT`s events for a contractor it does not own | `1` row — sees it |
| I5 | `INSERT` with a non-existent `contractor_id` | Rejected — foreign key violation |
| I6 | `INSERT` with an invalid `event_type` (`'bogus'`) | Rejected — `contact_events_event_type_check` violation |
| I7 | `INSERT` with `event_type='website'` (the new value) | Succeeds — `1` row |
| I8 | A real anonymous `profile_view` `INSERT`, checking `contractors.profile_view_count` before/after in the same transaction | Incremented by exactly `1` — confirms the `security definer` trigger actually fires correctly for `anon`, the realistic caller |
| I9 | `INSERT` a `profile_view` then `DELETE` it, checking the counter at each step | Increments then returns exactly to baseline |

`node supabase/local-dev/run-security-tests.mjs` — **70/70 pass**
(61 pre-existing + 9 new section I tests), zero regressions.

Issue #8's "IDOR/BOLA-style manipulation, invalid contractor IDs, and
unauthorized analytics reads/writes" is covered by I1/I2 (unauthorized
reads), I4 (confirms admin visibility isn't accidentally broader than
intended in the *other* direction — a false negative would also be a
bug), and I5/I6 (invalid writes). "Prevent a caller from submitting
analytics for arbitrary unrelated identities if identity is recorded" is
vacuously satisfied (see Privacy/security model above) — stated, not
silently skipped.

## Other tests

- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run test:unit` — **67/67 pass**, no regressions (this phase added
  no new pure-logic module needing unit tests — the only new logic is a
  SQL trigger, covered by I8/I9, and a server-side tally loop simple
  enough that the security-test/smoke-test coverage above is the
  meaningful verification for it).
- `npm run build` — succeeds (exit 0).
- **Real end-to-end verification, not direct test inserts** (Issue #8:
  "Verify events are generated by the real user workflow, not merely by
  direct test inserts") — a Playwright smoke test against `next dev` +
  the local-dev shim:
  1. Captured `profile_view_count` and the `event_type` tally for a real
     seeded contractor directly from Postgres (`14` views; `1` phone
     click; `0` line/facebook/website) **before** the run.
  2. Loaded the contractor's public profile page twice as an anonymous
     browser session (no login).
  3. Clicked all four contact CTAs (phone, LINE, Facebook, website) on
     that same anonymous session, with navigation intercepted so the
     click handlers could be observed without actually leaving the page.
  4. Logged in as that contractor's own owner and confirmed the admin
     detail page correctly returns **403 Forbidden** (non-admin) — reuses
     Phase 8's existing `requireAdmin()` gate, unchanged, re-verified
     here in the analytics context specifically.
  5. Logged in as an admin and loaded the same contractor's admin detail
     page: the new "สถิติการเข้าชม" section rendered, showing the
     profile-view count and all four contact-channel labels including
     the new "🌐 คลิกเว็บไซต์" (website clicks) label.
  6. Re-queried Postgres directly **after** the run: `profile_view_count`
     `14 → 16` (exactly the two real page loads); `phone` `1 → 2`,
     `line` `0 → 1`, `facebook` `0 → 1`, `website` `0 → 1` — every count
     matches exactly what the real browser actions should have produced,
     confirmed against the database independently of what the UI merely
     displayed.
  Zero unexpected console errors on any page (the two logged console
  entries during the forbidden-access test are the browser's own
  network-layer log of the expected `403` response, not a JS error).
- All throwaway local-dev-only artifacts from this test run (the `.env`
  file pointing at the local shim, two test-account password resets on
  shared seed accounts) were removed/are local-dev-only and not part of
  this commit; `.env` was already git-ignored and has been deleted.

## Limitations / disclosed gaps

1. **No admin-wide analytics listing or dashboard** — deliberate, per
   Issue #8's own "do not build an analytics dashboard product beyond
   what is necessary for verification/admin visibility." The tally is
   scoped to one contractor's existing admin detail page.
2. **No time-series or date-range breakdown** — only cumulative totals
   (matching how `rating_avg`/`review_count` already work). Not
   described as in-scope by Issue #8.
3. **The contact-event beacon remains best-effort and non-blocking**
   (unchanged from Phase 6): a click that immediately navigates away
   (`tel:`, `line.me`, an external site) may not always complete its
   insert before the browser unloads the page. This is the same
   accepted trade-off every client-side click-analytics beacon makes,
   not new to this phase or specific to the `website` channel.
4. **Contractors themselves cannot see their own view/contact counts**
   through this phase's UI — only admins, via the existing admin detail
   page. Issue #8 asks for "verification/admin visibility," not a
   contractor-facing feature; adding a contractor-facing stats view
   would be new UI scope beyond what was asked.
5. Sign-in/session mechanics remain the same local-dev-only, unsigned
   token described in Phase 8's report — unchanged this phase.

No other blockers.

## Commit

<!-- SHA filled in after commit below -->

## Verdict

**READY FOR REVIEW.**

Per Issue #8: **STOP after Phase 10. Do not start Phase 11 or unrelated
work.**
