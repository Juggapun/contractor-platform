# Phase 11 — SEO & Google Discoverability: Execution Report

Implements GitHub Issue #9 ("Phase 11 — SEO & Google Discoverability"),
whose own scope guard is the governing constraint throughout: don't
invent new routes, don't rewrite marketing copy, don't fabricate content,
don't build "hundreds of thin doorway pages." Read `docs/BRAND_UI_SPEC.md`
first — no page copy was rewritten; the only new user-visible text is
real-data-driven metadata (page titles, meta descriptions) that follows
the same plain, friendly Thai already used everywhere else in the app.

## Implementation summary

Every requirement in Issue #9 is implemented using Next.js's standard
Metadata API (`generateMetadata`/static `metadata` exports, `app/sitemap.ts`,
`app/robots.ts`) against real database data — no new schema, no new
routes beyond the two special SEO files Next.js itself expects.

- **Titles/descriptions** on every public page (already existed on most
  from earlier phases; the homepage and search page needed the most
  work — see below).
- **Canonical URLs**: home, search (conditionally — see "Duplicate
  content" below), contractor profile, and the registration page.
- **Open Graph / Twitter metadata**: site-wide defaults in the root
  layout (`siteName`, `locale: th_TH`, card type), overridden per-page
  with real data on the homepage and contractor profile page.
- **Dynamic sitemap** (`app/sitemap.ts`): real approved-contractor URLs,
  real category/province filter-landing URLs, plus the static public
  pages. Nothing fabricated, nothing private.
- **robots.txt** (`app/robots.ts`): disallows `/admin` and `/api`,
  references the sitemap.
- **Unique profile metadata**: unchanged from Phase 6's existing
  `generateMetadata` (already built from real `business_name`/
  `description`/location), extended this phase with canonical/OG/Twitter/
  robots and a LocalBusiness JSON-LD block.
- **Province/category landing pages**: implemented via `/search`'s own
  `generateMetadata`, not new routes — see "Duplicate content" below for
  why, and how the routing constraint ("where the current routing
  supports them") was honored rather than worked around.
- **Non-public pages excluded from indexing**: `/login`, `/signup`,
  `/admin/contractors`, `/admin/contractors/[id]` — all marked
  `robots: { index: false, follow: false }`. Pending/rejected/suspended
  contractor URLs were already unreachable (see "404 behavior" below) and
  now also carry an explicit `noindex` on that response.
- **Duplicate-content avoidance for `/search`**: a new pure-logic module,
  `src/lib/seo/searchIndexability.ts`, decides indexability per filter
  combination — see its own section below.
- **Structured data**: one `WebSite` block (homepage, with a real
  `SearchAction` matching the site's actual search feature) and one
  `LocalBusiness` block per contractor profile page, built only from
  fields already rendered on that same page. Nothing added to the search
  results page or anywhere else — kept conservative per Issue #9's own
  instruction.

## Duplicate-content strategy for `/search` (the most involved part of this phase)

Issue #9 asks for two things that pull in opposite directions unless
resolved carefully:

> "Ensure province/category landing/filter pages can have unique
> indexable URLs/content where the current routing supports them."
>
> "Avoid duplicate-content problems from query-string/filter variants;
> use canonicalization or noindex appropriately."
>
> Scope guard: "Do not create hundreds of thin doorway pages merely to
> target keywords."

The current routing has no dedicated `/categories/[slug]` or
`/provinces/[slug]` routes — only `/search`'s own query string. Inventing
those routes would be exactly the kind of new-route scope creep Issue
#9's own scope guard and this project's phase discipline both rule out
("where the current routing supports them" — it doesn't support
dedicated routes, so this phase didn't build any). Instead,
`src/lib/seo/searchIndexability.ts` classifies every `/search` request
against the *existing* query-string routing:

- **Indexable, canonical to itself**: no filters at all, OR exactly one
  of (a category slug that matches a real category) / (a province slug
  that matches a real province), on page 1. These are real, unique,
  worthwhile landing pages — the title/description are built from the
  real category/province name (`ผู้รับเหมาไฟฟ้า`, `ผู้รับเหมาในกรุงเทพมหานคร`),
  never fabricated copy.
- **`noindex, follow`, no canonical override**: a free-text keyword
  (`q=`), category+province combined, page > 1, or a slug that doesn't
  match any real category/province. These are either combinatorial-
  explosion variants (exactly the "hundreds of thin doorway pages" Issue
  #9 says not to create) or broken/duplicate content — `follow` is kept
  so link equity still flows through them, only indexing is suppressed.

This is a pure, synchronous function (`getSearchIndexability()`) — the
search page already has the real category/province lists in hand from
the same `getCategories()`/`getProvinces()` calls it needs for the filter
UI, so it never fetches anything on its own. It has its own unit tests
(`tests/searchIndexability.test.ts`, 10 tests) rather than only being
verified through the page — the same "pure logic gets its own test file"
pattern already established by `src/lib/validation/reviewSubmission.ts`
(Phase 9).

**Verified directly against real served HTML**, not just reasoned about
— see "SEO-specific verification" below.

## 404 / non-public-page behavior

`getContractorProfile()` (Phase 6, unchanged) already correctly returns
`null` — and thus a real HTTP 404 via `notFound()` — for a slug that
either doesn't exist or exists but isn't `status = 'approved'`, and
**deliberately never distinguishes the two cases** (its own header
comment: distinguishing them would leak which slugs correspond to a
pending/rejected/suspended contractor). This phase extended the
early-return branch in `generateMetadata` to also set
`robots: { index: false, follow: false }` on that same response, so a
crawler gets both the real 404 status *and* an explicit noindex signal —
verified directly (see below) that a nonexistent slug and a real pending
contractor's slug produce byte-identical `<title>`/`<meta name="robots">`
output, not just the same HTTP status.

## Files changed

New:
- `app/sitemap.ts`, `app/robots.ts` — see below.
- `src/lib/seo/searchIndexability.ts` + `tests/searchIndexability.test.ts`.
- `src/components/JsonLd.tsx` — see "A real XSS vector considered and
  closed" below.

Modified:
- `src/lib/env.ts` — new `getSiteUrl()`, non-throwing (see below).
- `.env.example` — documents `NEXT_PUBLIC_SITE_URL`.
- `app/layout.tsx` — `metadataBase`, site-wide default `openGraph`/`twitter`.
- `app/page.tsx` (home) — canonical, OG url, `WebSite` JSON-LD with a
  `SearchAction`.
- `app/search/page.tsx` — static `metadata` replaced with
  `generateMetadata()`; see "Duplicate-content strategy" above.
- `app/contractors/[slug]/page.tsx` — canonical, OG (incl. the profile
  image when set), Twitter, explicit `robots` on both branches,
  `LocalBusiness` JSON-LD.
- `app/contractors/register/page.tsx` — canonical (stays indexable — a
  real public conversion page, not an auth/admin page).
- `app/login/page.tsx`, `app/signup/page.tsx` — `robots: {index:false,
  follow:false}` (auth pages, per Issue #9's own list).
- `app/admin/contractors/page.tsx`, `app/admin/contractors/[id]/page.tsx`
  — same, for admin pages.
- `src/lib/data/contractors.ts` — new
  `getApprovedContractorSlugsForSitemap()`.
- `supabase/local-dev/postgrest-shim.mjs` — local-dev-only, see below.

No schema or migration changes this phase — Issue #9 needed none, and
none were made.

## Site URL configuration

`getSiteUrl()` (`src/lib/env.ts`) is the one new environment-config
surface: `NEXT_PUBLIC_SITE_URL`, used for `metadataBase` (which every
canonical/OG/Twitter URL resolves against) and for building absolute
URLs in the sitemap, robots.txt, and the two JSON-LD blocks (JSON-LD is
raw JSON this code controls directly — it is never resolved against
`metadataBase` the way the Metadata API's own fields are, so those two
call sites build absolute URLs from `getSiteUrl()` explicitly).
Deliberately **non-throwing**, unlike `requireEnv()` in the same file —
this project's established convention (`getCategories()`, `getProvinces()`,
etc.) is that a missing/unconfigured env var degrades gracefully rather
than failing the build, and there is no real deployment yet (Issue #8's
own scope guard explicitly excludes deployment from this project's
scope). Falls back to `http://localhost:3000` — `npm run build` keeps
succeeding without it configured, exactly like every other env-dependent
data fetch in this codebase already does. A real deployment **must** set
`NEXT_PUBLIC_SITE_URL` or every canonical/OG URL and the sitemap will
silently point at localhost — stated here explicitly as a disclosed
limitation, not silently assumed away.

## A real XSS vector considered and closed

Next.js's Metadata API has no built-in structured-data field — JSON-LD
is conventionally injected via a raw `<script type="application/ld+json"
dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />`. Some of
what this phase puts into that JSON — a contractor's own `business_name`
and `description`, entered during Phase 7 registration — is **end-user-
supplied, not developer-controlled**. A `business_name` containing the
literal substring `</script>` would close that script tag early and let
arbitrary following markup execute: a real stored-XSS vector via the
registration form, not a theoretical one, and specific to this phase
(no earlier phase injected raw JSON into a `<script>` tag). `src/components/JsonLd.tsx`
escapes every `<` in the stringified JSON to its Unicode escape sequence
before injection — the standard mitigation for this exact JSON-in-HTML
pattern, which defuses `</script>` without changing the JSON's parsed
meaning. Both JSON-LD call sites (homepage, contractor profile) go
through this one component rather than either inlining
`dangerouslySetInnerHTML` itself.

## Local-dev shim extension (not production code)

`handleContractorsSearch()`'s fixed SELECT column list (used for every
`GET /rest/v1/contractors` call, since — per the Phase 10 report's own
disclosed local-dev-only gap — this handler doesn't actually parse the
real `select=` query string) now also returns `c.updated_at`, needed for
the sitemap's real `lastModified` values. Same fix shape as Phase 10's
`profile_view_count` addition to this same list.

## SEO-specific verification (Issue #9: "inspect generated HTML metadata rather than relying only on component-level tests")

Ran a real `next build` + `next start` production server against the
local Postgres + extended shim, then `curl`'d actual served HTML/XML —
not component tests, not reasoning about the code:

| Page / URL | Verified |
|---|---|
| `/` | `<title>`, meta description, `<link rel="canonical">`, `og:*`, `twitter:*`, valid `WebSite` JSON-LD with an absolute `SearchAction` target |
| `/search` (no filters) | `robots: index, follow`; canonical to itself |
| `/search?category=<real, existing category>` | `robots: index, follow`; canonical to itself; title built from the real category name (`ผู้รับเหมาสร้างบ้าน`) |
| `/search?province=<real, existing province>` | same, for a real province (`ผู้รับเหมาในกรุงเทพมหานคร`) |
| `/search?category=fake-electric-work` (unknown slug) | `robots: noindex, follow` |
| `/search?q=test` | `robots: noindex, follow` |
| `/search?page=2` | `robots: noindex, follow` |
| `/search?category=<real>&province=<real>` (combined) | `robots: noindex, follow` — confirms the combined-filter case is suppressed even when *both* individual filters are real |
| `/contractors/<real approved slug>` | title, description, canonical, `og:*` (incl. `og:image` when the contractor has a profile photo), `twitter:*`, `robots: index, follow`; valid `LocalBusiness` JSON-LD with real `name`/`telephone`/`address`/`description` |
| same, for a contractor **with real reviews** | JSON-LD additionally includes `aggregateRating` with the real `ratingValue`/`reviewCount` |
| `/contractors/<nonexistent slug>` | real HTTP **404**, `robots: noindex` |
| `/contractors/<a real PENDING contractor's slug>` | real HTTP **404**, `robots: noindex` — **byte-identical** `<title>`/`<meta name="robots">` output to the nonexistent-slug case, confirming existence of a pending contractor still cannot be inferred |
| `/login`, `/signup`, `/admin/contractors` | `robots: noindex, nofollow` |
| `/contractors/register` | canonical present, stays indexable |
| `/robots.txt` | `Disallow: /admin`, `Disallow: /api`, correct `Sitemap:` line |
| `/sitemap.xml` | valid XML (parsed successfully with Python's `xml.etree`), **102 real URLs**; the same pending contractor's slug **absent**; a real approved contractor's slug **present** with a real `lastmod` from `updated_at`, plus real category/province landing URLs matching exactly what `/search`'s own metadata treats as indexable |

`node supabase/local-dev/run-security-tests.mjs` — **70/70 pass**, zero
regressions (this phase touches no RLS/schema, as expected — the
regression run is a sanity check, not a new-coverage need).

## Other tests

- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run test:unit` — **77/77 pass** (67 pre-existing + 10 new
  `getSearchIndexability` tests).
- `npm run build` — succeeds (exit 0). One real bug found and fixed
  during this: `sitemap.ts`/`sitemap.xml` is **cached/statically
  generated by default** by Next.js (documented in Next's own
  `sitemap.md`: "cached by default unless it uses a Request-time API or
  dynamic config option") — without `export const dynamic =
  'force-dynamic'`, the sitemap would have baked in whichever
  contractors were approved *at build time*, permanently, until the next
  redeploy, silently missing every contractor approved afterward. Caught
  by inspecting the build's own route table (`ƒ` vs `○` markers), not by
  reading the code — the same category of "verify against real build
  output, not just what the code looks like it should do" this project's
  reports have flagged before. Fixed by adding the same
  `force-dynamic` export already used by the registration and admin
  pages for the identical reason.

## Limitations / disclosed gaps

1. **No dedicated `/categories/[slug]` or `/provinces/[slug]` routes** —
   deliberate; see "Duplicate-content strategy" above for why the
   existing `/search` query-string routing was used instead, per Issue
   #9's own "where the current routing supports them."
2. **No generated OG images** (`next/og`'s `ImageResponse`) — Issue #9
   asks for "Open Graph/Twitter metadata where appropriate," not
   generated images; the contractor profile page's `og:image` uses the
   contractor's own real `profile_image_url` when set, nothing
   generated or fabricated when it isn't.
3. **`NEXT_PUBLIC_SITE_URL` must be set on real deployment** — see "Site
   URL configuration" above; unset, every canonical/OG/sitemap URL
   points at `localhost:3000`. Not a code bug — deployment itself is out
   of this project's scope (Issue #8's scope guard).
4. **Sitemap capped at 5,000 contractor URLs** (`SITEMAP_CONTRACTORS_LIMIT`
   in `getApprovedContractorSlugsForSitemap()`) — far above real MVP
   scale and well under Google's own 50,000-URL sitemap limit, but a
   defensive bound rather than an unbounded fetch; would need
   `generateSitemaps()`-based splitting if the platform ever grows past
   it.
5. **`contractors.updated_at` also changes on non-content updates** —
   pre-existing Phase 2 behavior (`set_updated_at()`, unrelated to this
   phase): any `UPDATE` to a contractors row bumps `updated_at`,
   including the Phase 10 view-count trigger's own internal `UPDATE`
   from an anonymous profile view. This means a contractor's
   `lastModified` in the sitemap can be more recent than their last
   actual content edit. Noted rather than silently assumed correct; not
   a Phase 11 regression and not something this phase's scope covers
   fixing (`set_updated_at()` predates this phase and Issue #9 doesn't
   ask for it).
6. Sign-in/session mechanics remain the same local-dev-only, unsigned
   token described in Phase 8's report — unchanged this phase, unrelated
   to SEO.

No other blockers.

## Commit

`bcda4b2` on `claude/thai-contractor-db-migration-q7byw6`, pushed to
`origin`.

## Verdict

**READY FOR REVIEW.**

Per Issue #9: **STOP after Phase 11. Do not start Phase 12 or unrelated
work.**
