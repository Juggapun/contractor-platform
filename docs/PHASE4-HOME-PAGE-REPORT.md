# Phase 4 — Home Page report

Built the first real customer-facing Home Page for
ศูนย์รวมผู้รับเหมาไทย on top of the Phase 2 database and Phase 3
authentication foundation, both unmodified. Next.js (App Router) + React
+ Tailwind CSS, chosen so the Home Page renders as static/server HTML
with minimal client JavaScript (only the mobile-nav toggle and the
auth-state widget are client components) — a natural fit for the
Performance requirement and for the SEO foundation's need for real
per-page `<title>`/meta description via Next's `metadata` API.

## 1. What was implemented

- Site chrome: `Header` (brand, nav, responsive mobile menu, auth-state
  widget) and `Footer`, both rendered once in the root layout.
- Home Page sections: `Hero`, `SearchEntry` (province/category/keyword
  form — navigation only), `CategoryGrid` (real DB categories),
  `HowItWorks` (3-step journey), `TrustSection` (portfolio/reviews/
  ratings/approval concepts, no fabricated numbers), `ContractorCta`.
- Minimal `/login` and `/signup` pages wired to the existing Phase 3
  `signIn`/`signUpCustomer` — built to satisfy the header's "authentication
  entry points" and "sign-in/sign-out behavior" requirements with real,
  working navigation targets rather than links to nowhere. `/signup`
  creates **customer accounts only**; `?role=contractor` shows a
  "coming soon" note but still only calls `signUpCustomer` — no
  contractor registration logic was implemented (Phase 7 scope).
- `/search` placeholder page: echoes back the selected
  category/province/keyword with a "coming soon" message. Zero
  search/filter business logic — exists only so Home Page navigation
  links resolve instead of 404ing, as explicit foundation for Phase 5.
- `src/lib/data/{categories,provinces}.ts`: RLS-respecting anon-key reads
  of `public.categories`/`public.provinces`, with a documented
  fail-safe (empty array, not fabricated rows) if Supabase isn't
  configured or the query fails.

## 2. Files changed

**New:** `app/{layout,page}.tsx`, `app/{login,signup,search}/page.tsx`,
`app/globals.css`, `next.config.mjs`, `postcss.config.mjs`,
`next-env.d.ts`, `src/components/*.tsx` (10 files: Header, AuthStatus,
Footer, Hero, SearchEntry, CategoryGrid, HowItWorks, TrustSection,
ContractorCta, LoginForm, SignupForm), `src/lib/data/{categories,provinces}.ts`
**Modified:** `package.json`/`package-lock.json` (next/react/tailwind
deps, new `dev`/`build`/`start`/`build:lib` scripts — `build` now means
`next build`, the lib-only tsc build moved to `build:lib`),
`eslint.config.js` (JSX parsing, a second `no-restricted-imports` guard
scoped to `app/**` against importing the admin/service_role client),
`tsconfig.json`/`tsconfig.build.json` (reconciled for Next.js's bundler
resolution — see "Limitations" for the one real snag this caused and how
it was fixed), `.gitignore` (`.next/`, `*.tsbuildinfo`),
`supabase/local-dev/postgrest-shim.mjs` (generalized its GET handler to
also serve `categories`, used for a real smoke test — see §5).
**Untouched:** every file under `supabase/migrations/`,
`docs/PHASE2-EXECUTION-REPORT.md`, `docs/AUTHENTICATION.md`'s
architecture content (no schema or auth-foundation changes this phase).

## 3. Home Page structure

`Header` (brand, Home/Search nav, responsive hamburger menu, auth-state
widget) → `Hero` (headline "ค้นหาผู้รับเหมาที่เหมาะกับงานของคุณ", supporting
copy, primary CTA → search entry, secondary CTA → how-it-works) →
`SearchEntry` (plain GET form: category/province selects sourced from the
real DB + free-text keyword, submits to `/search`) → `CategoryGrid` (real
`public.categories` rows, each linking to `/search?category=<slug>`) →
`HowItWorks` (Search → Compare → Contact directly) → `TrustSection`
(approved-contractor / portfolio / reviews concepts) → `ContractorCta`
(→ `/signup?role=contractor`) → `Footer`.

## 4. Authentication integration

`AuthStatus` (client component) calls Phase 3's `getCurrentUser()` on
mount and subscribes to `onAuthStateChange()`, rendering: a loading
skeleton, then either "เข้าสู่ระบบ"/"สมัครสมาชิก" links (logged out) or a
greeting + "ออกจากระบบ" button calling `signOut()` (logged in). Every call
is wrapped so a missing/unreachable Supabase configuration degrades to
the logged-out state instead of crashing the page — verified by building
and serving the app with no `SUPABASE_URL`/`SUPABASE_ANON_KEY` set at all
(§7) and confirming no runtime error. `/login` and `/signup` call the
exact same `signIn`/`signUpCustomer` functions already unit-tested in
Phase 3; no new auth logic, no client-supplied role, no service_role
anywhere near this code (grep-verified, same as Phase 3).

## 5. Database data used

`public.categories` (`id, name_th, name_en, slug, icon`, ordered by
`sort_order`) and `public.provinces` (`id, name_th, slug`), both read
through the anon-key client — respecting `categories_select_all` and
`provinces_select_all` (0013_rls_policies.sql), no admin-only table or
column touched. No second/hard-coded category list exists anywhere in
this code.

**Real-data smoke test executed:** extended
`supabase/local-dev/postgrest-shim.mjs` with a generic read route for
`provinces`/`categories`, started it against the same local Postgres 16
database from Phases 2-3 (still holding the real seeded 77
provinces/10 categories), built and ran the Next.js app with
`SUPABASE_URL`/`SUPABASE_ANON_KEY` pointed at that shim, and `curl`ed the
rendered HTML — confirmed all 10 real Thai category names
(สร้างบ้าน, ต่อเติม, รีโนเวท, โครงสร้าง, ไฟฟ้า, ประปา, หลังคา, …) and real
provinces (กรุงเทพมหานคร, นนทบุรี, …) render on the page, not placeholder
data. Also confirmed the **absence** of that configuration (the default
state for anyone else who clones this repo, since no hosted Supabase
project exists — same disclosed gap as Phases 2-3) builds and serves the
page correctly with an honest empty category grid instead of a crash or
invented rows.

## 6. Responsive behavior

Tailwind's mobile-first utilities throughout: single-column stacked
layout with a hamburger-triggered nav below the `md` breakpoint,
multi-column nav/grids above it (category grid: 2 cols mobile → 3 →
5 at `md`; how-it-works/trust: 1 col mobile → 3 at `sm`; footer:
1 col mobile → 3 at `md`). Verified structurally by build output and by
inspecting the generated Tailwind CSS for the expected `sm:`/`md:`
responsive utility classes (not verified in an actual visual browser —
see Limitations).

## 7. Accessibility work

- Semantic landmarks: `header`, two labeled `nav` (`aria-label`), `main`
  (target of a skip link), `footer` — verified present in rendered HTML.
- Heading hierarchy: exactly one `h1` per page, `h2` for every major
  section, `h3` only nested under an `h2` section — verified by
  extracting every heading tag from the rendered Home Page HTML (§ below
  shows the exact sequence found).
- Every form input (search entry's 3 fields, login's 2, signup's 3) has
  a `<label htmlFor>` bound to the input's `id` — verified via HTML
  inspection.
- Visible `:focus-visible` outline defined globally in `app/globals.css`
  (never suppressed anywhere).
- All interactive elements are native `<button>`/`<a>`/`<select>`/
  `<input>` — no custom clickable `<div>`s — so keyboard operability
  (Tab/Enter/Space) is the browser's native behavior, not something this
  code has to reimplement.
- Mobile nav toggle button has `aria-expanded`/`aria-controls` and an
  `sr-only` label that changes with state ("เปิดเมนู"/"ปิดเมนู").
- Decorative icons (emoji) are `aria-hidden="true"`, paired with visible
  text as the real accessible name — never the sole content of a control.
- A "ข้ามไปยังเนื้อหาหลัก" (skip to main content) link is the first
  focusable element on every page.
- No `<img>` elements exist in Phase 4 (no real portfolio/contractor
  images exist in the database yet) — the "useful alt text" requirement
  has nothing to attach to yet; noted here rather than silently skipped.

## 8. SEO foundation

Per-page `title`/`description` via Next's `metadata` export: home
("ศูนย์รวมผู้รับเหมาไทย | ค้นหาผู้รับเหมาที่เหมาะกับงานของคุณ"), `/search`
("ค้นหาผู้รับเหมา | ..."), `/login` ("เข้าสู่ระบบ | ..."), `/signup`
("สมัครสมาชิก | ..."), each with its own meaningful description — all
four verified distinct in the actual rendered `<head>` (§9). `<html
lang="th">` set once in the root layout. Clean URL structure is
Next.js App Router's default (`/`, `/search`, `/login`, `/signup`, no
query-string routing for the pages themselves). No `sitemap.xml`,
`robots.txt`, structured data, or Open Graph tags were added — that's
explicitly Phase 12's full SEO system, not this phase's foundation.

## 9. Tests executed and exact results

| Check | Command | Result |
|---|---|---|
| TypeScript | `npm run typecheck` (`tsc --noEmit`) | ✅ pass, 0 errors |
| ESLint | `npm run lint` | ✅ pass, 0 errors |
| Unit tests | `npm run test:unit` (vitest) | ✅ **24/24 pass** (unchanged from Phase 3 — no auth logic changed) |
| Production build (no Supabase configured) | `npm run build` | ✅ succeeds; `getCategories`/`getProvinces` log the expected "not configured" error and return `[]`, page still renders |
| Production build (real local Postgres via the local-dev shim) | `SUPABASE_URL=... SUPABASE_ANON_KEY=... npm run build` | ✅ succeeds; static `/` prerendered with real category/province data embedded |
| Home Page loads | `curl http://localhost:3000/` after `npm run start` | ✅ HTTP 200 |
| Other routes load | `curl` `/login`, `/signup`, `/search`, `/search?category=<real-category>` | ✅ all HTTP 200 (a stray HTTP 400 on first attempt was my own test script sending un-percent-encoded Thai text in the URL — confirmed by retesting with proper `encodeURIComponent`, which is what the app's own links actually generate) |
| Nonexistent route | `curl /nonexistent-page` | ✅ HTTP 404 (Next.js default) |
| Real category data renders | `grep` the 10 real Thai category names in the served HTML | ✅ all 10 present |
| Real province data renders | `grep` for กรุงเทพมหานคร/นนทบุรี in the served HTML | ✅ present |
| Per-page title/description/lang | `grep` `<title>`/`<meta name="description">`/`<html lang>` on all 4 pages | ✅ all 4 distinct and correct |
| Heading hierarchy | `grep -oE '<h[1-6][^>]*>'` on the Home Page | ✅ exactly one `h1`, then `h2`s, `h3`s only under `h2`s — no skipped levels |
| Landmarks | `grep -oE '<(header\|nav\|main\|footer\|section)[^>]*>'` | ✅ header/nav(×2, labeled)/main/footer/sections all present |
| Form label association | `grep` `<label for="...">` against each input's `id` | ✅ all 3 search-entry fields, login, signup fields correctly bound |
| No console/server errors on legitimate requests | server stdout during the curl sweep above | ✅ empty (only the two expected, intentional `console.error` lines from the no-env-configured build, which is the fallback path working as designed, not a bug) |
| Server-side error scan | `grep -i "error\|warn"` on the `next start` log during the smoke test | ✅ none |
| No protected data exposed | reviewed every query issued by `getCategories`/`getProvinces` — both are plain `select` on RLS-`select_all` public tables, no `admin_actions`/`reports`/`system_settings`/other-user `profiles` touched | ✅ confirmed by code review, consistent with Phase 2/3's already-tested RLS matrix |
| DB/RLS regression check | `node supabase/local-dev/run-security-tests.mjs` | ✅ **54/54 pass**, unchanged from Phase 3 (no migration/RLS/trigger files touched this phase) |
| Standalone lib build | `npm run build:lib` | ✅ pass, 0 errors |

Every result above was actually executed in this session, not asserted from reading the code.

## 10. Build result

`next build` — **clean, 0 errors**, in both the no-Supabase-configured
state and the real-local-data state (§9). Output: `/` and `/login`
statically prerendered; `/search` and `/signup` server-rendered on
demand (they read `searchParams`).

## 11. Limitations

- **Same disclosed gap as Phases 2-3, unchanged:** no real hosted
  Supabase project exists in this environment (org egress policy blocks
  the Docker images needed for a local GoTrue/PostgREST stack). The
  auth-state widget, `/login`, and `/signup` call the real Phase 3
  `authService` functions, but end-to-end verification against a live
  GoTrue/PostgREST was not possible here — only against the local-dev
  Postgres shim (real Postgres, real RLS, a hand-built REST shim, not
  real PostgREST/GoTrue). This is a pre-production requirement carried
  forward from Phase 2/3, not new to this phase.
- **One integration snag, found and fixed:** TypeScript's `bundler`
  moduleResolution accepts `.js`-suffixed relative imports as pointing to
  `.ts` source files (why `tsc --noEmit` looked clean at first), but
  Next.js's actual bundler (Turbopack/webpack) does not do that
  remapping and failed to resolve every such import at build time. Fixed
  by standardizing on extensionless relative imports across `src/`,
  `app/`, and `tests/`, and relaxing `tsconfig.build.json` (the
  standalone lib-only build, not consumed by anything at runtime today)
  off of `NodeNext` accordingly. Caught by actually running `next build`,
  not just the typechecker — worth remembering for later phases.
- **No automated visual/browser testing.** Responsive behavior and
  keyboard navigation were verified structurally (correct Tailwind
  responsive classes present in the build output; only native,
  inherently keyboard-operable elements used) and via HTTP-level
  smoke tests, not by driving an actual browser (no visual regression
  tool was added, consistent with "avoid unnecessary dependencies").
- **No automated component/UI tests** were added for the new React
  components — Phase 3's vitest suite (24 tests, still passing
  unchanged) covers `authService`/`guards` logic; the Home Page itself
  was verified via the build + HTTP smoke tests in §9, not unit tests,
  since no component-testing library (e.g. Testing Library) was added
  to keep the dependency footprint minimal.
- **`eslint-plugin-jsx-a11y`/`eslint-plugin-react` could not be
  installed** — they don't yet support the ESLint 10 line already
  pinned in this repo (same class of version-frontier friction as
  Phase 3's TypeScript/`@typescript-eslint` pin). Accessibility was
  instead verified by manual, executed HTML inspection (§9/§7) rather
  than automated lint rules.

## 12. Ready for review

**Yes — Phase 4 is ready for review.**
