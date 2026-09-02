/**
 * Renders a `<script type="application/ld+json">` for structured data
 * (Phase 11, Issue #9: "Keep structured data conservative and accurate;
 * only add schema markup where the existing page content genuinely
 * supports it").
 *
 * `JSON.stringify`'s output is otherwise injected verbatim via
 * `dangerouslySetInnerHTML` — Next.js's Metadata API has no built-in
 * structured-data field, so this direct-script-tag pattern is the
 * standard approach. Some of the data this renders (a contractor's own
 * `business_name`/`description`, Phase 7 registration input) is
 * end-user-supplied, not developer-controlled. A value containing the
 * literal substring `</script>` would otherwise close this script tag
 * early and let arbitrary following HTML/script execute — a real stored-
 * XSS vector, not a theoretical one. Every `<` character is escaped to
 * its Unicode escape sequence (the standard mitigation for this exact
 * JSON-in-HTML pattern), which defuses `</script>` without changing the
 * JSON's parsed meaning (a Unicode escape inside a JSON string decodes
 * identically to the literal character).
 */
export function JsonLd({ data }: { data: object }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
