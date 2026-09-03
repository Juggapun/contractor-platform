# Phase 13 — Performance & Production Hardening: Execution Report

Implements GitHub Issue #11 ("Phase 13 — Performance & Production
Hardening"). Its own scope guard is the governing constraint throughout:
"prepare the current app for realistic beta/production traffic by
measuring and fixing meaningful performance issues without changing
product scope or redesigning the UI." Every change below is backed by a
real measurement — either an `EXPLAIN ANALYZE` plan, a real build/runtime
artifact (route table, response headers), or a live browser check — not
inferred from reading the code. Where a suspected issue turned out, on
measurement, not to be real or not to be worth fixing, that's reported
too, per Issue #11's own "do not claim production performance is
guaranteed from local tests; document limitations."

## Method

1. **Static audit** of every public critical path Issue #11 names —
   homepage, search/filter, contractor profile, login/auth, contractor
   registration, admin — across indexes, image loading, client-component/
   bundle usage, and caching/revalidation.
2. **Real measurement** against a production build (`next build` +
   `next start`) and the live local Postgres: `EXPLAIN ANALYZE` on every
   filter/search query shape, real per-page JS transfer sizes via
   Playwright's network tracking, and a direct "insert a row, re-request
   the page without rebuilding" staleness test.
3. **Fix only what measurement justified**, then **re-measure the same
   way** to get a genuine before/after, not a predicted one.

## Bottlenecks found

### 1. The homepage was frozen at build time (real bug, fixed)

`app/page.tsx` had no `revalidate`/`dynamic` config. Next.js's default
fetch caching made it fully static (`○` in the build's route table).
**Proven, not assumed**: after building, I inserted a brand-new category
directly into Postgres and re-requested `/` with no rebuild — the new
category did not appear. Any real change to categories/provinces (rare,
but not never) would have been invisible on the highest-traffic page
until the next full redeploy.

### 2. Free-text keyword search had no viable index (real, previously-disclosed gap, fixed)

`searchContractors()`'s keyword filter is a leading-wildcard
`ILIKE '%kw%'` — structurally un-acceleratable by any btree index,
including the ones this schema already has. Documented as an accepted
MVP limitation since Phase 5's own report; this is the phase explicitly
scoped to revisit it.

### 3. Portfolio/search-card images had no `loading` attribute (real, fixed)

Three raw `<img>` tags (profile hero image, portfolio thumbnails, search-
result cards) had no `loading`/`decoding` attributes — every image on a
page loaded eagerly regardless of viewport position, competing for
bandwidth with whatever the real LCP resource is.

### Audited and found NOT to need a fix (measured, not assumed)

- **Existing indexes for province/category/slug filters and joins**:
  already correctly in place (`idx_contractors_status_province`,
  `idx_contractors_status_district`, `idx_contractor_categories_category`,
  unique indexes on `contractors.slug`/`categories.slug`/`provinces.slug`).
  `EXPLAIN ANALYZE` on the real seeded data (15 rows) showed Postgres
  choosing `Seq Scan` even for these already-indexed paths — correct,
  expected planner behavior at this table size (a 15-row table fits in
  one page; scanning it directly is genuinely cheaper than an index
  lookup). This is not "the indexes aren't working" — it's proof the
  planner will pick them up automatically once the table is large enough
  to make them worthwhile, without any code change needed now. Adding
  *more* indexes to these already-covered paths would have been exactly
  what Issue #11 says not to do ("add only indexes that are justified by
  actual query usage").
- **`reviews`/`portfolio_images`/`districts` query patterns**: filtered
  reads with small, `LIMIT`-bounded result sets (20 reviews max, ~10
  portfolio images, ~12 districts per province) — already covered by
  existing single-column indexes for the equality filter; the trailing
  `ORDER BY` sorts a handful of rows, not worth a wider composite index
  at any realistic per-contractor row count.
- **Client-component/bundle usage**: measured real per-page JS transfer
  via Playwright on home/search/profile/login. ~630KB of JS is identical
  across *every* page including the simplest one (`/login`) — this is
  React + Next.js framework runtime plus the Supabase JS SDK, unavoidable
  baseline overhead for any page using this stack, not something specific
  to this app's own component structure. Page-specific incremental JS
  was already small (1–7KB) — confirming the existing Server/Client
  Component split (`Footer`, `Hero`, `SearchFilters`, `ContractorCard`,
  etc. all correctly stay server-only; only genuinely-interactive pieces
  like `AuthStatus`, `ReviewForm`, `ContractorRegistrationForm` are
  client) is already doing its job. I specifically considered splitting
  `Header.tsx`'s client boundary (only its mobile-menu toggle truly needs
  `'use client'`) but the measured evidence shows `AuthStatus` — already
  necessarily client, already inside the root layout — dominates whatever
  marginal byte count Header itself would contribute; restructuring it
  now would have real regression risk against the mobile-nav fixes Phase
  12 just made, for a benefit the numbers say is negligible. Documented
  here as a considered-and-declined change, not silently skipped.
- **`/search` and `/contractors/[slug]` caching**: both already correctly
  render dynamically (`ƒ` in the route table) — `/search` because it
  reads `searchParams` (Next.js infers dynamic rendering automatically),
  `/contractors/[slug]` likewise. Neither risks serving stale contractor
  data. Admin pages (`/admin/contractors`, `/admin/contractors/[id]`)
  already carry an explicit `force-dynamic` from Phase 8. No admin data
  can go stale.
- **Loading/error states causing layout instability**: `app/search/
  loading.tsx` (Phase 5) and `app/contractors/[slug]/loading.tsx` (Phase
  12) both already use fixed-dimension skeleton blocks matching their
  real content's approximate shape — checked directly, no fix needed.
- **CLS from the three `<img>` tags fixed for lazy-loading (above)**: on
  inspection, each already sits inside a CSS-fully-constrained parent
  (`h-24 w-24`, `h-32 w-full`, `h-32` + `h-full w-full`) — the box is
  already reserved by CSS independent of the image loading, so these were
  never actually causing a layout shift. `width`/`height` attributes were
  still added as a correct defensive practice (a real ratio hint if that
  CSS ever changes), but the report does not claim they fixed an observed
  CLS bug, because they didn't — there wasn't one to fix.
- **`next/image` migration**: considered and explicitly deferred, not
  silently skipped. This Next.js version's `Image` component's `src`
  supports only an internal path, an absolute external URL (needs
  `remotePatterns`), or a static import — confirmed by reading this
  pinned version's own docs, not assumed from training data. The current
  seed/test data's `profile_image_url`/`thumbnail_url` are `data:` URIs
  (no real image host exists yet in this environment), which `next/image`
  structurally cannot take as `src`. Building a conditional dual-path
  wrapper now would ship a real-URL code path with **zero** ability to
  exercise it end-to-end against an actual remote host — this project's
  own standing rule is not to claim a test passed that wasn't actually
  run. Recorded as a concrete recommendation for whenever real image
  hosting (Supabase Storage or similar) is provisioned, not attempted now.

## Changes made

| # | File(s) | Change |
|---|---|---|
| 1 | `app/page.tsx` | Added `export const revalidate = 3600` — ISR instead of either "frozen forever" (the bug) or `force-dynamic` (which would burn a DB round-trip on every visit to the highest-traffic page for data that "rarely changes" by its own schema comments). |
| 2 | `supabase/migrations/0017_search_keyword_trigram_index.sql` (new) | `create extension pg_trgm` + two partial GIN indexes (`business_name`, `description`), scoped to `where status = 'approved'` — matching `searchContractors()`'s own query exactly, so pending/rejected/suspended rows are never indexed for nothing. |
| 3 | `app/contractors/[slug]/page.tsx`, `src/components/ContractorCard.tsx` | Added `loading="lazy"`/`decoding="async"` to the portfolio-grid and search-card images (below-the-fold, potentially many); the profile hero image stays eager (near the top of the page). Added `width`/`height` to all three as a defensive best practice — explicitly not claimed as a CLS fix, since none of the three was ever actually causing layout shift (see above). |

No schema changes beyond the one new migration; no RLS changes at all —
Issue #11's "preserve existing security boundaries and RLS" is satisfied
by construction (nothing in this phase touches an RLS policy), confirmed
by an unchanged security regression result (below).

## Measurements — concrete before/after

### Keyword search query plan

`EXPLAIN ANALYZE` against the real seeded data (15 rows) — no meaningful
wall-clock difference at this scale, reported honestly rather than
oversold:
- Before: `Seq Scan on contractors ... Filter: (status = 'approved' AND
  (business_name ~~* ... OR description ~~* ...))` — **0.118ms**.
- After: same shape at 15 rows (the planner correctly still prefers a
  seq scan on a 15-row table over any index — expected, not a bug).

Since the whole point of this index is future scale, not today's 15
rows, I built a **temporary, synthetic 8,000-row dataset** (realistic
beta-scale, ~0.3% keyword match rate to stay representative of a real
selective search rather than a worst-case "every row matches" test) to
get an honest answer to "does this actually help," then deleted every
row afterward — confirmed via `select count(*)` back to the original 15
real contractors, zero leftover synthetic data:
- **Before** (index dropped): `Seq Scan on contractors`, **20.309ms**,
  scanning all 8,000+27 rows.
- **After** (index restored, planner's own unforced choice — nothing
  disabled to make it pick this): `Bitmap Heap Scan` via `BitmapOr` over
  `idx_contractors_business_name_trgm` + `idx_contractors_description_trgm`,
  **0.274ms**.
- **~74x faster** at a realistic scale, chosen automatically by the query
  planner with no query changes needed on the application side.

### Homepage caching

- **Before**: real DB insert (`INSERT INTO categories ...`), re-requested
  `/` without rebuilding — new category **did not appear**. Route table:
  `○ /` with no revalidate window shown.
- **After**: build output explicitly shows `○ / — Revalidate: 1h, Expire:
  1y`; a live request's response headers confirm it:
  `Cache-Control: s-maxage=3600, stale-while-revalidate=31532400`,
  `x-nextjs-cache: HIT`. Bounded staleness (≤1 hour) instead of "frozen
  until next deploy," with zero added DB load on ordinary visits.

### Image loading attributes

Rendered HTML verified directly (not just the source diff) via a real
`curl` against a running production build:
```
<img ... width="300" height="200" loading="lazy" decoding="async"/>
```
Confirms the attributes reach real output, not just source — an earlier
verification attempt initially showed *no* attributes in the response,
traced to a stale `next start` process still running from before the
fix (`EADDRINUSE` on the real rebuild's own start attempt); killing it
and confirming a fresh server was actually serving the new build is what
produced the result above. Recorded here because it's a real thing that
went wrong during this phase's own verification, not to be repeated
silently.

### JS bundle / page weight

See "Audited and found NOT to need a fix" above for the full reasoning;
in short: ~630KB shared baseline (React/Next/Supabase SDK) identical on
every page, 1–7KB page-specific — measured via Playwright network
tracking on `/`, `/search`, `/contractors/[slug]`, `/login`.

## Tests / build results

- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run test:unit` — **88/88 pass** (no new pure-logic modules this
  phase, so no new unit tests were needed).
- `npm run build` — succeeds (exit 0); route table shape unchanged
  (still 3 static routes, 13 dynamic — no route was added or removed).
- `node supabase/local-dev/run-security-tests.mjs` — **70/70 pass**, zero
  regressions. Expected: no RLS policy was touched.
- Representative desktop (1280×900) and mobile (375×812) browser checks
  across `/`, `/search`, `/contractors/[slug]`, `/login`,
  `/contractors/register` (10 checks total) — all loaded with **zero
  console/page errors**; profile page screenshot confirmed no visual
  regression from the image attribute changes.

## Remaining risks / limitations (stated explicitly, not implied)

- **Local measurements are not a production guarantee.** The 74x query
  speedup, the JS bundle numbers, and the browser checks all ran against
  local Postgres and a local `next start` — real production infrastructure
  (network latency, a real Supabase-hosted Postgres, real CDN/edge
  caching, real device/connection diversity) will produce different
  absolute numbers. The *query plan shape* change (seq scan → indexed
  bitmap scan) is the durable, portable evidence; the specific millisecond
  figures are this-environment-specific.
- **`next/image`/real remote image optimization is deferred**, not done —
  see "Audited and found NOT to need a fix" above. This is the most
  concrete recommended follow-up once real image hosting exists.
- **The 1-hour homepage revalidation window** is a judgment call, not a
  measured optimum — chosen because categories/provinces are documented
  as "rarely changes" reference data; it could be tuned shorter or longer
  without any code restructuring if real usage patterns suggest otherwise.
- **No load/concurrency testing was performed** — Issue #11 asks for
  "practical local/browser measurements," which is what was done; this
  is not the same as a load test under concurrent traffic, and isn't
  claimed to be.

## Commit

<!-- SHA filled in after commit below -->

## Verdict

**READY FOR REVIEW.**

Per Issue #11: **STOP after Phase 13.**
