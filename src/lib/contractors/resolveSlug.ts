/**
 * Issue #18 follow-up: a Thai business name (this project's own slug
 * convention -- see app/api/contractors/register/route.ts's slugify())
 * produces a percent-encoded URL segment, e.g. `%E0%B8%94...` for
 * `ดีบั๊กทดสอบ`. `app/contractors/[slug]/page.tsx`'s `generateMetadata`
 * and its page component were found (via direct instrumentation) to
 * resolve the SAME dynamic `params.slug` differently for the SAME
 * request -- one already decoded, one still percent-encoded -- so
 * querying with the raw encoded value correctly matched zero rows and
 * the page rendered a false notFound() for a genuinely approved
 * contractor.
 *
 * Decoding unconditionally is safe even on an already-decoded string:
 * slugify() strips `%` from every slug at creation time, so a real slug
 * can never contain a literal `%` for decodeURIComponent to
 * misinterpret. Malformed input (a stray `%` some other way) falls back
 * to the raw value rather than throwing.
 */
export function resolveSlug(rawSlug: string): string {
  try {
    return decodeURIComponent(rawSlug);
  } catch {
    return rawSlug;
  }
}
