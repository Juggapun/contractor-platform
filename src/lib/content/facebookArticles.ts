/**
 * Home Page "บทความ" section (Issue #42) — curated Facebook Page post
 * links, MVP scope. Deliberately NOT automatic Graph API ingestion (the
 * issue explicitly asks not to build that here): this is a plain,
 * hand-maintained array, the same "config module, not a database table"
 * pattern already used elsewhere in this codebase for small curated
 * content (see src/lib/search/categorySynonyms.ts) — no migration, no
 * admin UI, no new dependency; adding/removing a post is a one-line edit
 * to this file, and ArticlesSection.tsx never needs to change to pick it
 * up.
 *
 * Every field except `facebookPostUrl` and `title` is optional on
 * purpose: this MVP must never fabricate a cover image, excerpt, or
 * publish date for a real Facebook post that isn't actually known — an
 * omitted field renders as a safe empty state in ArticlesSection, never
 * a made-up value (see that component's own header comment).
 *
 * Starts EMPTY: no real curated post URLs exist in this repository/
 * session to add honestly (this environment has no access to the
 * project's actual Facebook Page). The Project Owner (or a future
 * trusted maintainer) adds real entries here directly — see the
 * `CuratedFacebookArticle` shape below for the exact fields to fill in.
 */
export interface CuratedFacebookArticle {
  /** The original Facebook post URL — clicking the card opens exactly this. */
  facebookPostUrl: string;
  /** Short title for the card. Real text describing the actual post, never invented. */
  title: string;
  /** Optional short excerpt/summary of the real post content. */
  excerpt?: string;
  /** Optional cover image URL (e.g. the post's own photo), shown if provided. */
  coverImageUrl?: string;
  /** Optional ISO 8601 date string — the real post's publish date, if known. */
  publishedAt?: string;
}

export const CURATED_FACEBOOK_ARTICLES: CuratedFacebookArticle[] = [];
