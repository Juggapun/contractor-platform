/**
 * Centralized environment variable access. See .env.example for the full
 * list and docs/AUTHENTICATION.md#environment-variables for what's safe
 * to expose to a browser bundle vs. server-only.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `Missing required environment variable: ${name}. See .env.example.`
    );
  }
  return value;
}

/**
 * Client-safe config: the Supabase project URL and the `anon`
 * (publishable) key. Both are DESIGNED to be shipped to a browser —
 * every authorization decision is enforced by RLS on the database side,
 * never by keeping this key secret.
 *
 * Uses the `NEXT_PUBLIC_` prefix and **literal, static**
 * `process.env.NEXT_PUBLIC_...` property access deliberately — Next.js
 * only inlines `NEXT_PUBLIC_*` variables into a browser bundle when it
 * can statically find that exact member-access expression at build
 * time; a dynamic `process.env[name]` lookup (like requireEnv() above,
 * which is fine for server-only code) is invisible to that static
 * analysis and would silently resolve to `undefined` in the browser.
 * This is a real bug that existed from Phase 3 through Phase 5 — every
 * client-side Supabase call (the Phase 3/4 header auth-state widget,
 * this phase's contact-click tracking) was silently failing in an
 * actual browser bundle and falling back to its error path, which for
 * the auth widget looked like a correct "logged out" state and went
 * unnoticed until Phase 6 surfaced it as a visible console error — see
 * docs/PHASE6-CONTRACTOR-PROFILE-REPORT.md.
 */
const DEFAULT_SITE_URL = 'http://localhost:3000';

/**
 * The public site origin (no trailing slash), used for `metadataBase`,
 * canonical/Open Graph URLs, and the sitemap/robots.txt — all Phase 11
 * (Issue #9). Deliberately non-throwing, unlike `requireEnv()` above:
 * this project's established convention (see `getCategories()`/
 * `getProvinces()` etc.) is that a missing/unconfigured env var degrades
 * gracefully rather than failing the build — `npm run build` must keep
 * succeeding without a real deployment domain configured.
 *
 * Issue #47 STEP 3 (Owner Production QA, 2026-09-18): Production's
 * `og:url`/canonical were confirmed pointing at `localhost:3000` because
 * `NEXT_PUBLIC_SITE_URL` was never set in Vercel — this session has
 * never had Vercel dashboard access to set it directly. Rather than
 * depend on that manual step, this now also tries Vercel's own
 * automatically-injected deployment env vars before giving up to
 * localhost: `VERCEL_PROJECT_PRODUCTION_URL` (the stable production
 * domain Vercel assigns, present whenever "Automatically expose System
 * Environment Variables" is on — the default for new projects) and
 * `VERCEL_URL` (that specific deployment's own URL, present on every
 * deployment unconditionally). Neither is `NEXT_PUBLIC_`-prefixed, so
 * Next.js never inlines them into a browser bundle — this fallback is a
 * pure no-op (falls straight through) in the one client component that
 * also calls this function (`FacebookLoginButton.tsx`), which is
 * unaffected either way, and only ever actually resolves during
 * server-side metadata/sitemap/robots generation, which is exactly
 * where it's needed. An explicit `NEXT_PUBLIC_SITE_URL` still always
 * wins when set, so this is additive, never a behavior change for a
 * deployment that already configures it.
 */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit && explicit.trim() !== '') {
    return normalizeSiteUrl(explicit.trim());
  }
  const vercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProductionUrl && vercelProductionUrl.trim() !== '') {
    return normalizeSiteUrl(`https://${vercelProductionUrl.trim()}`);
  }
  const vercelDeploymentUrl = process.env.VERCEL_URL;
  if (vercelDeploymentUrl && vercelDeploymentUrl.trim() !== '') {
    return normalizeSiteUrl(`https://${vercelDeploymentUrl.trim()}`);
  }
  return DEFAULT_SITE_URL;
}

function normalizeSiteUrl(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

/**
 * Supabase's own dashboard shows the project URL in two places that look
 * similar but aren't interchangeable: Settings -> API -> "Project URL"
 * (what `NEXT_PUBLIC_SUPABASE_URL` must be) and the "REST" row right next
 * to it, which is that same URL with `/rest/v1/` already appended (a
 * copy-paste target for `curl`, not for this config). Pasting the latter
 * here is a one-character-looking mistake with a total-failure blast
 * radius: supabase-js always appends its own `/rest/v1` when building a
 * request, so a URL that already ends in it produces a doubled,
 * nonexistent path (`/rest/v1/rest/v1/provinces`) and every single query
 * fails — verified directly against supabase-js's own URL construction.
 * Every one of getProvinces()/getCategories()/getDistrictsByProvince()
 * catches that failure and degrades to an empty array rather than
 * throwing (by design, see those files), so the only visible symptom is
 * silently empty dropdowns with no error shown anywhere in the browser —
 * exactly the Issue #12 Beta report. Stripping a trailing `/rest/v1`
 * defensively here means this specific, easy-to-make mistake can't
 * silently break every reference-data query again.
 */
function stripTrailingRestPath(url: string): string {
  return url.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
}

export function getPublicSupabaseConfig(): { url: string; anonKey: string } {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!rawUrl || !anonKey) {
    throw new Error(
      'Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL and/or ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY. See .env.example.'
    );
  }
  return { url: stripTrailingRestPath(rawUrl), anonKey };
}

/**
 * Server-only config: the `service_role` key bypasses Row Level Security
 * entirely. This function — and anything that calls it — must never run
 * in browser-bundled code. See src/lib/supabase/admin.ts. Deliberately
 * NOT `NEXT_PUBLIC_`-prefixed — that prefix is exactly what would make
 * Next.js inline it into the browser bundle, which must never happen.
 */
export function getServiceRoleSupabaseConfig(): { url: string; serviceRoleKey: string } {
  if (typeof window !== 'undefined') {
    throw new Error(
      'getServiceRoleSupabaseConfig() was called in a browser context. ' +
        'The service_role key must never be loaded client-side.'
    );
  }
  return {
    url: stripTrailingRestPath(requireEnv('NEXT_PUBLIC_SUPABASE_URL')),
    serviceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  };
}
