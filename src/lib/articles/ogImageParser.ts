/**
 * Issue #42 (Articles) — extracts a Facebook post's `og:image` (or the
 * more specific `og:image:secure_url`, when present) meta tag content
 * from the post page's raw HTML. Pure/synchronous string parsing, no
 * network access, no HTML parser dependency — a small tolerant regex is
 * enough for one specific, well-known meta tag shape, and avoids adding
 * a new dependency for something this narrow (matches this codebase's
 * existing preference for plain built-ins over new libraries where a
 * simple approach suffices).
 *
 * Handles both attribute orders (`property` before `content` and vice
 * versa) and either quote style, since real-world HTML isn't
 * consistent about this. Deliberately does NOT use a full DOM/HTML
 * parser — this only ever runs against Facebook's own og:image meta
 * tag, not arbitrary attacker-controlled markup structure.
 */
const PROPERTY_FIRST =
  /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["'][^>]*>/i;
const CONTENT_FIRST =
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["'][^>]*>/i;

export function extractOgImageUrl(html: string): string | null {
  const match = html.match(PROPERTY_FIRST) ?? html.match(CONTENT_FIRST);
  if (!match || !match[1]) return null;

  // HTML attribute values commonly carry entity-encoded `&` in real
  // Facebook markup (query-string separators inside the image URL) —
  // decode just that one entity, the only one that would otherwise
  // break URL parsing downstream.
  return match[1].replace(/&amp;/g, '&');
}
