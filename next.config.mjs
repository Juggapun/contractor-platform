/**
 * Issue #35 security audit — baseline security response headers.
 * next.config.mjs previously set none at all. These four are safe,
 * well-understood defaults that apply uniformly to every route without
 * touching any page/component behavior:
 *   - X-Frame-Options: DENY — this app never embeds itself or expects to
 *     be embedded in an iframe, so clickjacking protection costs nothing.
 *   - X-Content-Type-Options: nosniff — stops a browser from executing
 *     an uploaded/served file as something other than its declared
 *     Content-Type (relevant given user-uploaded images in Storage).
 *   - Referrer-Policy: strict-origin-when-cross-origin — a reasonable,
 *     widely-used default that avoids leaking full URLs (which can
 *     contain no secrets here, but this is standard practice regardless)
 *     to third-party sites a visitor clicks through to.
 *   - Permissions-Policy: disables browser features (camera/microphone/
 *     geolocation) this app never uses, so an XSS bug elsewhere couldn't
 *     abuse them.
 *
 * Deliberately NOT adding a Content-Security-Policy here: getting one
 * right requires auditing every inline script/style this app actually
 * emits (Next.js's own hydration script, the JsonLd component's inline
 * `<script>`, Tailwind's runtime if any) and testing every page against
 * it — a real risk of breaking the site if rushed through as part of
 * this audit rather than done as its own careful, tested change.
 * Recorded as a follow-up recommendation in the audit report instead.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
