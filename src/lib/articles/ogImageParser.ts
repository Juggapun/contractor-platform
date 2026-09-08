/**
 * Issue #42 (Articles) — extracts a Facebook post's og:image meta tag
 * content from the post page's raw HTML. Pure/synchronous string
 * parsing, no network access, no HTML parser dependency — a small
 * tolerant regex is enough for these specific, well-known meta tag
 * shapes, and avoids adding a new dependency for something this narrow
 * (matches this codebase's existing preference for plain built-ins over
 * new libraries where a simple approach suffices).
 *
 * Handles both attribute orders (`property` before `content` and vice
 * versa) and either quote style, since real-world HTML isn't
 * consistent about this. Deliberately does NOT use a full DOM/HTML
 * parser — this only ever runs against Facebook's own og:image-family
 * meta tags, not arbitrary attacker-controlled markup structure.
 *
 * Follow-up (comment 5584109190): the Owner reported real Production
 * `/photo/?fbid=...&set=...` URLs failing with "no og:image found."
 * Facebook's real markup for a photo post is not always exactly
 * `og:image` — it can also carry `og:image:url` alongside or instead of
 * `og:image:secure_url`, so `secure_url` is tried first (it's the most
 * specific/reliable when present), then `og:image:url`, then the bare
 * `og:image` tag as the final fallback. This sandbox has no network
 * access to facebook.com to observe the actual HTML Facebook served for
 * the Owner's failing URLs (see docs/DEPLOYMENT.md's established
 * network-blocker constraint) — this widens what's recognized based on
 * Open Graph's own documented tag variants, not a confirmed root cause.
 */
function buildMetaTagRegexes(property: string): [RegExp, RegExp] {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [
    new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["'][^>]*>`, 'i'),
  ];
}

const TAG_PRIORITY = ['og:image:secure_url', 'og:image:url', 'og:image'];

export function extractOgImageUrl(html: string): string | null {
  for (const property of TAG_PRIORITY) {
    const [propertyFirst, contentFirst] = buildMetaTagRegexes(property);
    const match = html.match(propertyFirst) ?? html.match(contentFirst);
    if (match && match[1]) {
      // HTML attribute values commonly carry entity-encoded `&` in real
      // Facebook markup (query-string separators inside the image URL) —
      // decode just that one entity, the only one that would otherwise
      // break URL parsing downstream.
      return match[1].replace(/&amp;/g, '&');
    }
  }
  return null;
}

/**
 * Best-effort detection of Facebook's own "you must log in to view this
 * content" interstitial — served instead of the real post markup for
 * some content Facebook considers gated (private posts, some photo
 * permalinks accessed without a session, rate-limited/blocked traffic).
 * Checked only when `extractOgImageUrl` already found nothing, purely to
 * give the Admin an honest, specific reason instead of a generic "no
 * og:image" message that reads as if the post itself has no image.
 * These markers are stable, well-known fragments of Facebook's actual
 * login-wall page; matching none of them just means "unrecognized," not
 * "definitely not gated" — this is a diagnostic aid, not a security
 * boundary, and never changes what is/isn't fetched.
 */
export function looksLikeFacebookLoginWall(html: string): boolean {
  const lower = html.toLowerCase();
  return (
    /<title>\s*log\s*(in|into)\s*(to\s*)?facebook/i.test(html) ||
    lower.includes('id="login_form"') ||
    lower.includes('id="loginbutton"') ||
    (lower.includes('name="login"') && lower.includes('name="pass"'))
  );
}
