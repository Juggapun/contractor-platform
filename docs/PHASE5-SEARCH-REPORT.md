# Phase 5 — Search + Filter report

Implements Issue #2: the real customer-facing contractor search and
filtering flow, replacing the Phase 4 `/search` placeholder. Journey:
**Home Page search entry → `/search` (province/category/keyword,
results, pagination) → placeholder contractor link (Phase 6 will build
the real profile)**. No contractor profile, registration, portfolio,
reviews, dashboards, ranking/AI, or database redesign was implemented —
strictly Search + Filter.

## 1. What was implemented

- `src/lib/data/contractors.ts` — `searchContractors()`: the real,
  RLS-respecting, single-query contractor search (see §3), plus
  `getContractorNameBySlug()` for the Phase 6 placeholder link target.
- `src/lib/search/params.ts` — sanitizes raw `searchParams` (page
  clamping, filter length capping, array-param coercion), unit-tested.
- `app/search/page.tsx` — the real search page: filter form, result
  count, result grid, empty/error states, pagination.
- `app/search/loading.tsx` / `app/search/error.tsx` — Next.js's native
  route-segment loading skeleton and error boundary.
- `src/components/{SearchFilters,ContractorCard,SearchPagination}.tsx`
  — the filter form, a result card, and prev/next pagination controls.
- `app/contractors/[slug]/page.tsx` — Phase 6 placeholder (existence
  check by slug only, zero profile business logic), giving every result
  card a real, non-broken link target.
- `app/icon.svg` — a minor, in-scope-adjacent fix: testing surfaced a
  pre-existing (pre-Phase-5) 404 on `/favicon.ico` as a browser console
  error; a one-line static icon file closes it cleanly.
- `supabase/local-dev/postgrest-shim.mjs` — extended with a purpose-
  built `GET /rest/v1/contractors` handler so the real query could be
  smoke-tested against real Postgres (see §7 for a real bug this caught).

## 2. Search/filter behavior

All 8 combinations required by Issue #2 were individually exercised
against real seeded data (§7) and behave deterministically:

| Filters | Result |
|---|---|
| none | all approved contractors, paginated |
| category only | approved + has that category |
| province only | approved + in that province |
| keyword only | approved + keyword in business_name or description |
| category + province | AND of both |
| category + keyword | AND of both |
| province + keyword | AND of both |
| all three | AND of all three |

Filters combine with AND semantics (never OR) — this was a deliberate,
consistent design choice, matching how filter UIs conventionally behave
and avoiding any ambiguity Issue #2 didn't specify. No ranking, scoring,
or "best match" logic exists anywhere — results are always ordered
deterministically by `business_name`, then `id` as a stable tiebreak.

The filter form and pagination links are **plain HTML `<form method="get">` /
`<a>` elements** — every filter combination and page number is a real,
shareable, bookmarkable URL (`/search?category=...&province=...&q=...&page=...`),
and back/forward navigation works natively since nothing is client-state-only.
Changing filters always resets to page 1 (the form omits `page`); paginating
preserves the active filters (`SearchPagination` builds each link from the
current parsed params). "ล้างตัวกรอง" (clear filters) is a plain link to
`/search` with no query string, shown only when a filter is active.

## 3. Database/query approach

One single Supabase query per search (no N+1, no separate slug-resolution
round-trips), using PostgREST's embedded-resource select/filter syntax —
standard, idiomatic supabase-js usage:

```
contractors
  .select(`id, business_name, slug, description, profile_image_url,
            rating_avg, review_count, verification_status,
            provinces(id,name_th,slug),        -- or provinces!inner(...) + .eq('provinces.slug', x)
            districts(id,name_th,slug),
            contractor_categories(categories(id,name_th,slug))  -- or !inner(...) + .eq(...) chain
           `, { count: 'exact' })
  .eq('status', 'approved')
  .or('business_name.ilike.%kw%,description.ilike.%kw%')  -- when keyword present
  .order('business_name').order('id')
  .range(from, to)
```

- **RLS, not app logic, is the security boundary.** The anon-key client
  is the only client used (grep-verified — `service_role` appears
  nowhere in `src/lib/data/contractors.ts`, `SearchFilters.tsx`,
  `ContractorCard.tsx`, `SearchPagination.tsx`, or `app/search/**`,
  `app/contractors/**`). `contractors_select_approved_public`
  (0013_rls_policies.sql, already verified in Phases 2/3) is what
  actually restricts every result to `status = 'approved'` rows —
  the explicit `.eq('status', 'approved')` here is an index-usage/
  defense-in-depth choice (matches `idx_contractors_status_province`),
  not the enforcement mechanism. No RLS policy was touched.
- **Explicit column list**, never `select('*')` — a search result card
  gets exactly what it displays, nothing more.
- **Keyword search is an unindexed `ILIKE` scan** on the existing
  `business_name`/`description` columns — no schema change (no
  `pg_trgm`, no generated `tsvector` column, no new index). This is a
  genuine, disclosed limitation (see §9), not silently worked around:
  fine at MVP data volumes, would need a trigram/GIN index or full-text
  search to stay fast at scale. Adding that is a real future
  optimization, not a blocker to correctness today, so it wasn't added
  without being asked (per Issue #2's "don't redesign unless a genuine
  blocker").
- **Keyword sanitization**: `%`/`_` (ILIKE wildcards) are escaped and
  `(`/`)`/`,` (meaningful to PostgREST's `or=` mini-language) are
  stripped from user input before it's interpolated into the `.or()`
  filter string — see `sanitizeKeywordForIlike()`. This was verified
  against an actual `<script>...</script>` payload and a 300-character
  string in the keyword/category params (§7) — both handled safely,
  no injection, no crash.

## 4. Pagination/result-limit approach

Fixed page size of 12 (`CONTRACTORS_PAGE_SIZE`), via Supabase's
`.range(from, to)` + `{ count: 'exact' }` — never an unbounded fetch.
`page` is clamped to `[1, 100000]` and defaults to 1 for anything
non-numeric or out of range (§8). An out-of-range page (beyond the last
real page) returns zero rows and renders the normal empty state — safe,
deterministic, no crash, no need to auto-redirect. Prev/Next links are
rendered only when a previous/next page actually exists; the page
indicator ("หน้า X จาก Y") only appears when there's more than one page.
The schema didn't need anything added to support this — offset/limit
pagination on the existing `idx_contractors_status_province` index is
sufficient at MVP scale; no limitation to document here.

## 5. Security considerations

- **anon users can only see intended public contractor data**: verified
  both by code review (anon-key client only, RLS policy unmodified,
  already covered by Phases 2/3's 46 RLS tests) and by a live test —
  a *pending* (non-approved) contractor's slug (`/contractors/contractor-two`)
  correctly renders "not found" through the placeholder page, exactly
  like a nonexistent slug (§7) — status gating holds even under a direct
  URL guess, not just from the search list.
- **protected/private fields are not exposed**: the select column list
  is explicit and was reviewed field-by-field against what a result
  card actually renders; no `phone`/`line_id`/`facebook_url`/`address`/
  `plan_tier`/`featured_until` in the query at all.
- **service_role remains server-only**: grep-verified absent from every
  Phase 5 file (§3).
- **search parameters cannot be used for authorization bypass**: every
  filter (`category`, `province`, `q`, `page`) only narrows the
  RLS-already-restricted result set further — there is no code path
  where a query parameter changes *which role* the request runs as or
  bypasses the `status = 'approved'` condition.
- **malformed/hostile query parameters are handled safely**: see §8 for
  the exact cases executed (bad page numbers, unknown slugs, an XSS
  payload, an oversized parameter) — all handled without a crash, an
  error leak, or unexpected data exposure.
- **No RLS policy or migration file was changed.** No blocker requiring
  one was found.

## 6. Responsive/accessibility work

- Mobile: filter form stacks to one column, result grid goes
  1 → 2 → 3 columns (`sm`/`lg` breakpoints), pagination controls remain
  tappable, no horizontal overflow — verified via a real mobile-viewport
  (390px) screenshot of live search results (§7).
- Semantic structure preserved/extended: one `h1` per page, each result
  card's business name is an `h2` (a directory-listing pattern, not a
  heading-hierarchy violation), result count and empty/error states use
  `role="status"`/`role="alert"` so assistive tech announces state
  changes, pagination is a labeled `<nav aria-label="หน้าผลการค้นหา">`,
  every filter input has an associated `<label>`, disabled Prev/Next
  states use `aria-disabled` rather than being silently missing.
- Kept the Phase 4 yellow brand system exactly (`bg-brand-400`/
  `text-slate-900` buttons, `focus-visible` outline, `text-[15px]
  leading-relaxed` body copy) — no new colors, no redesign.

## 7. Tests executed with exact results

All executed in this session against real Postgres 16 (same database
used since Phase 2), through an extended local-dev PostgREST shim (real
SQL, real joins, real RLS-equivalent role switching — see
`supabase/local-dev/README.md` for what this substitution does and
doesn't prove; the usual hosted-Supabase gap from Phases 2-4 is
unchanged, disclosed again in §9).

**Test fixtures added** (5 approved contractors with deliberately varied
shapes + 10 minimal filler rows to exceed one page): a verified
electrician in Nonthaburi with zero reviews, a Bangkok "ต่อเติม"/
"โครงสร้าง" contractor with one review, a Bangkok contractor with **no
categories at all** (empty-array edge case), the existing Phase 2/3
approved contractor, and the existing *pending* contractor (must stay
invisible). See `supabase/local-dev/run-security-tests.mjs`'s `IDS`/setup
pattern — these fixtures live only in the local dev database, never
committed to a migration.

| Check | Result |
|---|---|
| `npm run typecheck` | ✅ pass, 0 errors |
| `npm run lint` | ✅ pass, 0 errors |
| `npm run test:unit` (vitest) | ✅ **35/35 pass** (24 prior + 11 new `parseSearchParams` tests) |
| `next build`, no Supabase configured | ✅ succeeds; graceful "not configured" fallback (unchanged from Phase 4) |
| `next build`, real local data via shim | ✅ succeeds |
| No filters | ✅ 14 results, "พบ 14 ผู้รับเหมา — หน้า 1 จาก 2" |
| category=ไฟฟ้า | ✅ 1 result (the electrician) |
| province=นนทบุรี | ✅ 1 result (same contractor — only Nonthaburi one) |
| q=ต่อเติม | ✅ 1 result (keyword match) |
| category=ต่อเติม&province=กรุงเทพมหานคร | ✅ 1 result (AND, correct) |
| category=ไฟฟ้า&q=ครัว | ✅ 0 results → empty state (AND correctly excludes) |
| province=เชียงใหม่ (no contractors there) | ✅ 0 results → empty state |
| category=nonexistent-slug | ✅ 0 results → empty state, no crash |
| page=2 (of 2) | ✅ 2 results, "หน้า 2 จาก 2" |
| page=999 (past the end) | ✅ 0 results → empty state, no crash |
| page=-1, page=abc | ✅ both silently default to page 1 |
| q=`<script>alert(1)</script>` | ✅ treated as a literal (non-matching) keyword — 0 results, no injection, no crash |
| category = 300-char string | ✅ truncated to 100 chars by `parseSearchParams`, 0 results, no crash |
| `/contractors/<real approved slug>` | ✅ shows the real business name |
| `/contractors/<real PENDING slug>` | ✅ "not found" — status gating holds even by direct URL guess |
| `/contractors/does-not-exist` | ✅ "not found" |
| Desktop screenshot (1440px), populated results | ✅ captured, reviewed |
| Desktop screenshot, empty state | ✅ captured, reviewed |
| Mobile screenshot (390px), populated results incl. pagination | ✅ captured, reviewed (first attempt caught the loading skeleton mid-stream — re-captured with an explicit wait; noted so the method is honest) |
| Browser console errors, all 7 routes | ✅ zero (one pre-existing favicon 404 found and fixed — §1) |
| `supabase/local-dev/run-security-tests.mjs` | ✅ **54/54 pass — no regressions** (Phase 5 touched no migration/RLS/trigger file) |

**A real bug was found and fixed during this testing**, not just
described as possible: the shim initially parsed Supabase's `.range()`
pagination as an HTTP `Range` header (matching PostgREST's documented
mechanism), but this project's installed `@supabase/supabase-js` version
actually sends pagination as `offset`/`limit` **query parameters**
instead. The shim silently ignored the real params and always returned
page 1's data regardless of the requested page — caught specifically by
testing `page=999` end-to-end and getting page-1 results back instead of
empty, not by reading the code. Fixed by parsing `offset`/`limit` from
the query string (with the header as a documented fallback), then
re-verified with real 2-page pagination (§ table above). This affected
only the local test shim, not `src/lib/data/contractors.ts`'s actual
query-building code, which was correct throughout.

## 8. Build result

`next build` — **clean, 0 errors**, in both the no-Supabase-configured
state and the real-local-data state. Routes: `/`, `/login`, `/icon.svg`
static; `/search`, `/signup`, `/contractors/[slug]` server-rendered on
demand (all read dynamic input — searchParams or route params).

## 9. Blockers/limitations

No blocker required changing the Phase 2 schema or any RLS policy —
none was found. Two disclosed, non-blocking limitations:

- **Keyword search has no index** (§3) — correct and safe today, would
  need `pg_trgm`/GIN indexing (or full-text search) to stay fast as the
  `contractors` table grows well beyond MVP scale. Not implemented here
  since it's not required for correctness and wasn't asked for.
- **Same hosted-Supabase gap as every prior phase, unchanged**: this
  session cannot pull the real Supabase/GoTrue/PostgREST Docker images
  (org egress policy), so Phase 5 was verified against real Postgres 16
  through the local-dev shim (real RLS-equivalent behavior, real SQL,
  real data) rather than a live hosted PostgREST. The shim bug found and
  fixed in §7 is itself evidence this substitution is doing real,
  meaningful verification work, not rubber-stamping — but it is still
  not the same as testing against the actual hosted stack, which
  remains the pre-launch gate already on record from Phase 2.

## 10. Commit SHA

See the end of this session's reply for the exact pushed commit SHA.

## 11. READY FOR REVIEW

**Yes — Phase 5 is ready for review.**
