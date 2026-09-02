/**
 * Phase 12 (Issue #10) fix: /login previously always redirected to `/`
 * after a successful sign-in, no matter what page the user was on or
 * what they were trying to do — confirmed via a real browser test that a
 * customer clicking "เข้าสู่ระบบ" from the review form on a contractor's
 * profile got sent to the homepage instead of back to that profile,
 * losing their place. The fix is a `?redirect=` param carrying the
 * page the user came from.
 *
 * This validates that value before ever handing it to
 * `window.location.href` — an unvalidated redirect target is a classic
 * open-redirect vector (`/login?redirect=https://evil.com` or
 * `//evil.com`, exploitable for phishing since the link visibly points
 * at this site's own real login page). Only a same-origin, path-only
 * value is accepted; anything else falls back to `/`.
 */
export function isSafeRedirectPath(path: string | null | undefined): path is string {
  if (!path) return false;
  if (path[0] !== '/') return false; // must be a path, not an absolute URL
  // Some browsers normalize a leading backslash the same as a forward
  // slash, so `/\evil.com` can become `//evil.com` (protocol-relative)
  // by the time it's actually navigated to — reject both forms of a
  // second leading slash-like character, not just a literal `//`.
  if (path[1] === '/' || path[1] === '\\') return false;
  if (path.includes('://')) return false; // an absolute URL smuggled in after the leading slash
  return true;
}

export function resolveRedirectPath(raw: string | null | undefined): string {
  return isSafeRedirectPath(raw) ? raw : '/';
}
