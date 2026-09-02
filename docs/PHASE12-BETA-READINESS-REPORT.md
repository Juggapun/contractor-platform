# Phase 12 — Pre-Launch UX & Beta Readiness: Execution Report

Implements GitHub Issue #10 ("Phase 12 — Pre-Launch UX & Beta Readiness"). This
phase's own framing is the governing constraint throughout: "Fix concrete
usability/readiness issues in the existing MVP" — not a redesign. Every fix
below is a small, targeted change to something a real, live browser
walkthrough showed was actually broken or actually missing; nothing was
rewritten, restyled, or re-architected. No schema/migration changes, no
new pages, no new routes beyond one loading-state file.

Read `docs/BRAND_UI_SPEC.md` first, as required. No brand copy was
rewritten; the few new UI strings (the header's new nav link, the
contractor status badges) match the existing plain, friendly Thai and
yellow-accent register already used everywhere else.

## Method

Two passes, in order:
1. **Static review** — read every page (`app/**`) and component
   (`src/components/**`) end to end, looking for broken links, missing
   loading/error states, and auth-state inconsistencies.
2. **Live verification** — a real `next dev` server against local
   Postgres + the extended local-dev shim, driven by Playwright at both
   a desktop (1280×900) and a real mobile viewport (375×812, iPhone-size).
   Every finding below was confirmed broken with a screenshot or a
   failing assertion *before* being fixed, then re-confirmed fixed with
   the same script afterward — findings are not assumed from reading the
   code alone. Per Issue #10's explicit instruction, **nothing below is
   reported as tested unless it was actually executed.**

## 1. UX/readiness issues found

Five real, concrete issues, each confirmed via a live browser test:

1. **No persistent way to reach contractor registration.** The only
   links to `/contractors/register` were the homepage's `ContractorCta`
   section and the footer. A visitor already on `/search` or a
   contractor's profile page had no path to it without scrolling all the
   way down or going back to the homepage. Confirmed: the header's nav
   links, read directly from the live page, were only `["หน้าแรก",
   "ค้นหาผู้รับเหมา"]`.
2. **Mobile nav hid the logged-in user's name AND (for an admin) the
   only way to reach the admin queue.** `AuthStatus.tsx`'s authenticated
   branch had `hidden ... sm:inline`/`sm:inline-block` on the greeting
   and the admin link — a leftover from before `Header.tsx` split into
   two separate `AuthStatus` instances (one already wrapped in `hidden
   md:block`, one inside the `md:hidden` mobile nav). Net effect at a
   real 375px width: an admin's mobile menu showed only a logout
   button — no name, and **no way to reach `/admin/contractors` from the
   navigation UI at all** on a phone. Confirmed with a real screenshot
   (`p12-screenshots/07-mobile-nav-admin.png`, before) showing exactly
   that.
3. **Signing in always redirected to `/`, losing the user's place.**
   `LoginForm.tsx` hardcoded `window.location.href = '/'` after a
   successful sign-in. Confirmed: a customer clicking "เข้าสู่ระบบ" from
   the review form on a contractor's profile page, signing in, and
   landing back on `http://localhost:3000/` instead of the profile they
   were trying to review.
4. **No loading feedback on the contractor profile page.**
   `app/contractors/[slug]/` had no `loading.tsx` (unlike `/search`,
   which has had one since Phase 5) despite doing three parallel
   queries (profile + portfolio + reviews) before any HTML streams.
5. **A contractor had no way to check their application status after
   the one-time registration success message.** Logging in later as a
   pending contractor showed nothing indicating "still pending"
   anywhere; logging in as an approved contractor showed no link to
   their own public profile. Confirmed via a full live registration →
   admin-approval loop: before the fix, neither a pending nor an
   approved contractor's logged-in session showed any status text or
   profile link anywhere on the page.

**Also checked and confirmed already correct** (no fix needed, verified
live rather than assumed): the full registration → pending → admin
approval → public-search-visibility pipeline works end to end; a
pending/rejected contractor's profile URL returns a real 404
indistinguishable from a nonexistent slug; `/admin/contractors` is
correctly blocked for both an anonymous visitor and a logged-in non-admin
(and the header never shows the admin link to a non-admin); logout
correctly clears the session (re-verified after a page reload, not just
in local UI state); the review-submission, contact-CTA-click, and
search-filter flows all work with zero console errors on every tested
path.

## 2. Fixes made

| # | File(s) | Fix |
|---|---|---|
| 1 | `src/components/Header.tsx` | Added "เข้าร่วมเป็นผู้รับเหมา" to the persistent nav links (desktop + mobile). |
| 2 | `src/components/AuthStatus.tsx` | Removed the `hidden`/`sm:inline`/`sm:inline-block` modifiers from the greeting and admin-link elements — the outer per-instance wrappers already control mobile vs. desktop visibility, so these inner elements can just always render. |
| 3 | `src/lib/navigation/safeRedirect.ts` (new), `src/components/LoginForm.tsx`, `app/login/page.tsx`, `src/components/ReviewForm.tsx`, `src/components/AuthStatus.tsx`, `src/components/AdminContractorQueue.tsx`, `src/components/AdminContractorDetail.tsx` | Every "please sign in" link across the app now carries `?redirect=<the page the user was on>`; `LoginForm` reads it back via `useSearchParams()` and returns there after a successful sign-in — see "A real open-redirect vector considered and closed" below for why this needed its own validation, not just a raw pass-through. |
| 4 | `app/contractors/[slug]/loading.tsx` (new) | Skeleton loading state matching the profile page's own section layout, same pattern as `app/search/loading.tsx` (Phase 5). |
| 5 | `src/lib/data/contractorSelfStatus.ts` (new), `src/components/AuthStatus.tsx` | A logged-in contractor now sees a small status badge next to their name (⏳ pending / ✅ approved + a link to their own public profile / ❌ rejected / ⛔ suspended). Uses the **existing** `contractors_select_approved_public` RLS policy (0013, unchanged) — that policy already lets a contractor read their own row regardless of status (`user_id = auth.uid()`); this was simply never read by any UI before. **No RLS/schema change.** |

## A real open-redirect vector considered and closed

Item #3's `redirect` param is exactly the shape of a classic open-redirect
vector: `/login?redirect=https://evil.com` or `/login?redirect=//evil.com`
is a link that visibly points at this site's own real login page (so it's
trustworthy-looking and phishing-usable) but, if honored uncritically,
would send a user who just typed their real password into this site's
real form off to an attacker's page immediately after. `src/lib/navigation/safeRedirect.ts`'s
`isSafeRedirectPath()` rejects anything that isn't a same-origin, path-only
value — including a bare `//host` (protocol-relative) and a leading
backslash (`/\evil.com`), which some browsers normalize the same way a
literal `//` would be by the time it's actually navigated to. 11 unit
tests (`tests/safeRedirect.test.ts`) cover the accepted and rejected
shapes, including both of those bypass attempts specifically. This is a
new, real security consideration this phase introduced by adding the
redirect feature at all — closed before shipping it, not found
afterward.

## 3. Customer journey verification

Live, via Playwright, both desktop and mobile:
homepage → homepage search → `/search` results → click a result card →
contractor profile → (signed out) see the sign-in prompt on the review
form → sign in → **land back on the same profile** (post-fix) → submit a
real review (star rating + comment) → thank-you message shown → the new
review appears on the page → aggregate rating updates (trigger-maintained,
unchanged since Phase 2/9) → all four contact CTAs (phone/LINE/Facebook/
website) present and clickable without a console error. Zero unexpected
console/page errors on any step. Test review cleaned up afterward.

## 4. Contractor journey verification

Live, via Playwright: filled and submitted the real registration form →
success message correctly explains pending-review status → the new
(pending) business does **not** appear in public search → logging in as
that pending contractor shows the "⏳ ใบสมัครรอตรวจสอบ" badge (post-fix) →
logging in as an admin, the application appears in the admin queue →
opened its detail page → approved it → admin detail reflects "อนุมัติแล้ว" →
the same business **now** appears in public search → logging back in as
that now-approved contractor shows "✅ ผู้รับเหมา" with a working "ดูโปรไฟล์ของคุณ"
link to their real public profile (post-fix). Also directly verified
against Postgres (not just the UI) that a non-owner, non-admin session
querying by another user's `user_id` (the same query shape the new
status feature uses) gets an empty result — the fix reuses existing RLS,
it doesn't create a new access path. Test contractor/account cleaned up
afterward.

## 5. Mobile/desktop verification

Both a 1280×900 desktop viewport and a real 375×812 mobile viewport were
used for the walkthroughs above, plus a dedicated mobile-nav check:
signed-out mobile menu, and — the specific case that was broken — a
logged-in admin's mobile menu, screenshotted before (name and admin link
both invisible) and after (both visible, alongside the new
"เข้าร่วมเป็นผู้รับเหมา" link) the `AuthStatus` fix. Also captured mobile
screenshots of the contractor profile page and the full registration
form — both render cleanly at 375px with no overflow, no unreadable text,
and adequately-sized tap targets; no fix needed there.

## 6. Security regression result

`node supabase/local-dev/run-security-tests.mjs` — **70/70 pass**, zero
regressions. Expected: this phase made no schema or RLS changes. The one
new query path (a contractor reading their own row by `user_id`) was
additionally verified directly against Postgres with real bearer tokens
for both the negative case (a different logged-in user gets `[]`) and the
positive case (the actual owner gets their row) — see "Contractor journey
verification" above. Protected-boundary checks (anonymous and non-admin
access to `/admin/contractors`) were re-verified live and remain
unchanged in behavior; logout was verified to clear the session after a
page reload, not just in local component state.

## 7. TypeScript/ESLint/tests/build results

- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run test:unit` — **88/88 pass** (77 pre-existing + 11 new
  `isSafeRedirectPath`/`resolveRedirectPath` tests).
- `npm run build` — succeeds (exit 0); route table unchanged in shape
  (no new routes besides the loading-state file, which isn't a route).
- Local-dev shim: added `user_id=eq.X` filter support to
  `handleContractorsSearch()` (needed by the new contractor
  self-status read) — local-dev-only, not production code.

## 8. Beta checklist/documentation added

`docs/BETA_CHECKLIST.md` — a plain-Thai, no-code-knowledge-required
manual checklist for the owner/admin, covering: what test accounts to
set up (documentation only — no real credentials or fabricated
production data included); a checkbox walkthrough of all four flows
(customer, contractor, admin, auth) plus a dedicated mobile pass; how to
report a problem (screenshot + "what you expected vs. what happened", no
technical vocabulary required); an explicit "acceptable for beta, don't
re-report it" list; and a separate "treat this as a launch blocker"
list, both stated as concrete, checkable conditions rather than vague
guidance.

## 9. Known limitations and launch blockers

**Acceptable for MVP beta** (documented in `docs/BETA_CHECKLIST.md` for the
owner, not hidden):
- No "forgot password" flow, no Facebook Login (already-planned, not yet
  built — Brand Spec's own "Member login" section mentions Facebook
  Login as planned).
- A rejected contractor sees only the status badge, not the admin's
  written rejection reason — that reason lives in `admin_actions`, which
  RLS currently scopes to admins only. Surfacing it to the contractor
  would need a new RLS policy change, which this phase's own scope guard
  ("Do not weaken RLS/auth boundaries," "no large database redesign")
  argues against doing casually inside a UX-focused phase — flagged here
  as a real, deliberate scope boundary, not an oversight.
- "เกี่ยวกับเรา"/"ติดต่อเรา"/"นโยบายความเป็นส่วนตัว" footer entries remain
  "เร็ว ๆ นี้" placeholders (unchanged, pre-existing, correctly
  non-interactive rather than broken links).
- Sign-in/session mechanics remain the same local-dev-only, unsigned
  token described since Phase 8's report — unchanged this phase.

**No launch blockers found** during this review — every one of the five
issues above was fixed, verified, and re-tested live before this report
was written. The full four-journey walkthrough (customer, contractor,
admin, auth) passes end to end on both desktop and mobile with zero
console errors.

## 10. Commit

<!-- SHA filled in after commit below -->

## 11. Verdict

**READY FOR REVIEW.**

Per Issue #10: **STOP after Phase 12. Do not start Phase 13 or unrelated
work.**
