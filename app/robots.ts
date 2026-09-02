import type { MetadataRoute } from 'next';
import { getSiteUrl } from '../src/lib/env';

/**
 * Phase 11 (Issue #9) — "Provide robots.txt with sensible crawl/index
 * rules."
 *
 * Only `/admin` and `/api` are Disallowed here. `/login` and `/signup`
 * are deliberately NOT blocked here even though they're marked noindex
 * on the page itself (app/login/page.tsx, app/signup/page.tsx) — a
 * robots.txt Disallow stops a page from ever being *crawled*, which
 * means a crawler would never see that page's own noindex meta tag in
 * the first place; Google's own guidance is to use noindex (not
 * robots.txt) for exactly this reason when a page is cheap/harmless to
 * crawl but not worth indexing. `/admin` and `/api` are different: they
 * gate real (session-checked, not just hidden-in-the-UI) functionality
 * and API routes with no page content for a crawler to usefully fetch at
 * all, so blocking the crawl itself is the right call there, in addition
 * to (not instead of) the admin pages' own noindex meta tag.
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api'],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
